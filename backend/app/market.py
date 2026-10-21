"""Éclats (monnaie du jeu) et marché : récompense du jour, recyclage de doubles, annonces, achat."""
from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from . import db
from .common import CARD_SELECT, card_out, current_player
from .inventory import RECYCLE_VALUE, add_eclats, give, owned, take
from .social import DEFAULT_PSEUDO

router = APIRouter()
DAILY_REWARD = 100       # éclats offerts chaque jour
MARKET_FEE = 0.05        # part prélevée sur chaque vente
MAX_ACTIVE_LISTINGS = 20


def _wallet(conn, pid) -> dict:
    r = conn.execute("""SELECT eclats, daily_claimed_at,
        (daily_claimed_at IS NULL OR daily_claimed_at < now() - interval '20 hours') AS recompense_dispo
        FROM players WHERE id = %s""", (pid,)).fetchone()
    return {"eclats": r["eclats"], "recompense_dispo": r["recompense_dispo"], "recompense": DAILY_REWARD,
            "recyclage": RECYCLE_VALUE, "commission": MARKET_FEE}


@router.get("/api/me/eclats")
def wallet(player: dict = Depends(current_player)):
    with db.connection() as conn:
        return _wallet(conn, player["id"])


@router.post("/api/me/eclats/recompense")
def claim_daily(player: dict = Depends(current_player)):
    """Récompense quotidienne (au plus une fois toutes les 20 h, pour ne pas imposer une heure fixe)."""
    with db.connection() as conn, conn.transaction():
        cur = conn.execute("""UPDATE players SET eclats = eclats + %s, daily_claimed_at = now()
            WHERE id = %s AND (daily_claimed_at IS NULL OR daily_claimed_at < now() - interval '20 hours')""",
                           (DAILY_REWARD, player["id"]))
        if not cur.rowcount:
            raise HTTPException(409, "Récompense déjà récupérée : reviens plus tard")
        return _wallet(conn, player["id"])


class RecycleIn(BaseModel):
    carte: int
    quantite: int = Field(default=1, ge=1, le=99)


@router.post("/api/me/eclats/recycler")
def recycle(body: RecycleIn, player: dict = Depends(current_player)):
    """Transforme des doubles en éclats ; le dernier exemplaire d'une carte est toujours conservé."""
    pid = player["id"]
    with db.connection() as conn, conn.transaction():
        card = conn.execute("SELECT rarete FROM cards WHERE id = %s", (body.carte,)).fetchone()
        if not card:
            raise HTTPException(404, "Carte inconnue")
        if owned(conn, pid, body.carte, lock=True) - body.quantite < 1:
            raise HTTPException(409, "Seuls les doubles se recyclent : garde au moins un exemplaire")
        take(conn, pid, body.carte, body.quantite)
        gain = RECYCLE_VALUE[card["rarete"]] * body.quantite
        add_eclats(conn, pid, gain)
        return {**_wallet(conn, pid), "gain": gain}


def _listings(conn, where: str, params: dict, order: str = "l.created_at DESC", limit: int = 60) -> list[dict]:
    rows = conn.execute(CARD_SELECT.replace("SELECT c.id,", f"""SELECT l.id AS annonce, l.prix, l.status AS statut, l.created_at AS cree_le,
            l.sold_at AS vendu_le, l.seller, coalesce(sp.pseudo, '{DEFAULT_PSEUDO}') AS vendeur, c.id,""")
        + f""" JOIN market_listings l ON l.card_id = c.id JOIN players sp ON sp.id = l.seller
               WHERE {where} ORDER BY {order} LIMIT {int(limit)}""", params).fetchall()
    return [{"id": r["annonce"], "prix": r["prix"], "statut": r["statut"], "cree_le": r["cree_le"], "vendu_le": r["vendu_le"],
             "vendeur": {"id": r["seller"], "pseudo": r["vendeur"]}, "carte": card_out(r)} for r in rows]


SORTS = {"recent": "l.created_at DESC", "prix": "l.prix ASC, l.created_at DESC", "prix_desc": "l.prix DESC, l.created_at DESC",
         "rarete": "array_position(ARRAY['L','UR','R','PC','C'], c.rarete), l.prix ASC"}


@router.get("/api/marche")
def market(q: str | None = None, rarete: Literal["C", "PC", "R", "UR", "L"] | None = None, serie: str | None = None,
           tri: Literal["recent", "prix", "prix_desc", "rarete"] = "recent", player: dict = Depends(current_player)):
    where, params = ["l.status = 'active'", "l.seller <> %(me)s"], {"me": player["id"]}
    if q:
        where.append("o.nom ILIKE %(q)s"); params["q"] = f"%{q.strip()}%"
    if rarete:
        where.append("c.rarete = %(r)s"); params["r"] = rarete
    if serie:
        where.append("s.code = %(s)s"); params["s"] = serie
    with db.connection() as conn:
        lots = _listings(conn, " AND ".join(where), params, SORTS[tri])
        trend = conn.execute("""
            SELECT o.nom, c.rarete, '/media/' || c.image AS image_url, count(*) AS ventes, round(avg(l.prix)) AS prix_moyen
            FROM market_listings l JOIN cards c ON c.id = l.card_id JOIN celestial_objects o ON o.id = c.object_id
            WHERE l.status = 'sold' AND l.sold_at > now() - interval '7 days'
            GROUP BY o.nom, c.rarete, c.image ORDER BY ventes DESC, prix_moyen DESC LIMIT 5""").fetchall()
    return {"annonces": lots, "tendances": trend}


@router.get("/api/me/marche")
def my_listings(player: dict = Depends(current_player)):
    with db.connection() as conn:
        return _listings(conn, "l.seller = %(me)s AND (l.status = 'active' OR l.created_at > now() - interval '30 days')",
                         {"me": player["id"]}, "l.status = 'active' DESC, l.created_at DESC")


class ListingIn(BaseModel):
    carte: int
    prix: int = Field(ge=1, le=100000)


@router.post("/api/marche", status_code=201)
def create_listing(body: ListingIn, player: dict = Depends(current_player)):
    """Met une carte en vente : l'exemplaire quitte la collection jusqu'à la vente ou l'annulation."""
    pid = player["id"]
    with db.connection() as conn, conn.transaction():
        n = conn.execute("SELECT count(*) AS n FROM market_listings WHERE seller = %s AND status = 'active'", (pid,)).fetchone()["n"]
        if n >= MAX_ACTIVE_LISTINGS:
            raise HTTPException(409, f"{MAX_ACTIVE_LISTINGS} annonces au plus en même temps")
        take(conn, pid, body.carte, 1)
        lid = conn.execute("INSERT INTO market_listings (seller, card_id, prix) VALUES (%s, %s, %s) RETURNING id",
                           (pid, body.carte, body.prix)).fetchone()["id"]
    return {"id": lid}


@router.post("/api/marche/{listing_id}/acheter")
def buy(listing_id: int, player: dict = Depends(current_player)):
    pid = player["id"]
    with db.connection() as conn, conn.transaction():
        lot = conn.execute("SELECT * FROM market_listings WHERE id = %s FOR UPDATE", (listing_id,)).fetchone()
        if not lot or lot["status"] != "active":
            raise HTTPException(404, "Annonce introuvable ou déjà vendue")
        if lot["seller"] == pid:
            raise HTTPException(422, "Tu ne peux pas acheter ta propre annonce")
        paid = conn.execute("UPDATE players SET eclats = eclats - %s WHERE id = %s AND eclats >= %s RETURNING eclats",
                            (lot["prix"], pid, lot["prix"])).fetchone()
        if not paid:
            raise HTTPException(402, "Pas assez d'éclats")
        add_eclats(conn, lot["seller"], lot["prix"] - int(round(lot["prix"] * MARKET_FEE)))
        give(conn, pid, lot["card_id"], 1)
        conn.execute("UPDATE market_listings SET status = 'sold', buyer = %s, sold_at = now() WHERE id = %s", (pid, listing_id))
        card = card_out(conn.execute(CARD_SELECT + " WHERE c.id = %s", (lot["card_id"],)).fetchone())
        return {"carte": card, **_wallet(conn, pid)}


@router.delete("/api/marche/{listing_id}")
def cancel_listing(listing_id: int, player: dict = Depends(current_player)):
    with db.connection() as conn, conn.transaction():
        lot = conn.execute("SELECT * FROM market_listings WHERE id = %s FOR UPDATE", (listing_id,)).fetchone()
        if not lot or lot["seller"] != player["id"] or lot["status"] != "active":
            raise HTTPException(404, "Annonce introuvable")
        conn.execute("UPDATE market_listings SET status = 'cancelled' WHERE id = %s", (listing_id,))
        give(conn, player["id"], lot["card_id"], 1)  # la carte revient dans la collection
    return {"id": listing_id, "statut": "cancelled"}
