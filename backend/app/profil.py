"""Profil, succès et classement des joueurs."""
from __future__ import annotations

import uuid
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from . import db
from .achievements import achievements_for, unlocked_titles
from .common import CARD_SELECT, card_out, current_player
from .settings import allows
from .social import are_friends

router = APIRouter()
DEFAULT_PSEUDO = "Joueur"


def player_stats(conn, player_id) -> dict:
    """Statistiques d'un joueur : base des succès, du profil et du classement."""
    st = conn.execute("""
        SELECT (SELECT count(*) FROM pack_openings WHERE player_id = %(p)s) AS boosters_ouverts,
               count(pc.card_id) AS cartes_uniques,
               coalesce(sum(pc.quantite), 0) AS cartes_total,
               count(pc.card_id) FILTER (WHERE c.rarete = 'L') AS legendaires,
               count(pc.card_id) FILTER (WHERE c.rarete = 'UR') AS ultra_rares,
               count(pc.card_id) FILTER (WHERE pc.first_obtained_at > now() - interval '7 days') AS semaine
        FROM player_cards pc JOIN cards c ON c.id = pc.card_id
        WHERE pc.player_id = %(p)s""", {"p": player_id}).fetchone()
    series = conn.execute("""
        SELECT s.code, s.nom, count(c.id) AS total, count(pc.card_id) AS possedees
        FROM series s JOIN cards c ON c.series_id = s.id AND NOT c.retired
        LEFT JOIN player_cards pc ON pc.card_id = c.id AND pc.player_id = %s
        WHERE s.active GROUP BY s.id ORDER BY s.date_sortie NULLS LAST, s.code""", (player_id,)).fetchall()
    amis = conn.execute("""SELECT count(*) AS n FROM friendships
        WHERE status = 'accepted' AND (requester = %(p)s OR addressee = %(p)s)""", {"p": player_id}).fetchone()["n"]
    commerce = conn.execute("""
        SELECT (SELECT count(*) FROM trades WHERE status = 'accepted' AND (proposer = %(p)s OR recipient = %(p)s)) AS echanges,
               (SELECT count(*) FROM market_listings WHERE status = 'sold' AND seller = %(p)s) AS ventes,
               (SELECT count(*) FROM battles WHERE won AND player_id = %(p)s) AS victoires,
               (SELECT count(*) FROM battles WHERE mode = 'classee' AND won AND player_id = %(p)s) AS victoires_classees,
               (SELECT count(*) FROM guild_members WHERE player_id = %(p)s) AS guilde""", {"p": player_id}).fetchone()
    return {**{k: int(v) for k, v in st.items()}, "amis": amis, **commerce, "series": {s["code"]: s for s in series}}


def _profile(conn, player: dict, *, me: bool) -> dict:
    p = conn.execute("SELECT id, pseudo, created_at, favoris, titre FROM players WHERE id = %s", (player["id"],)).fetchone()
    stats = player_stats(conn, p["id"])
    fav_ids = [i for i in (p["favoris"] or [])]
    favs = {r["id"]: card_out(r) for r in conn.execute(CARD_SELECT + " WHERE c.id = ANY(%s)", (fav_ids,)).fetchall()} if fav_ids else {}
    ach = achievements_for(stats)
    out = {
        "id": p["id"], "pseudo": p["pseudo"] or DEFAULT_PSEUDO, "titre": p["titre"], "inscrit_le": p["created_at"],
        "stats": {k: stats[k] for k in ("boosters_ouverts", "cartes_uniques", "cartes_total", "legendaires", "ultra_rares")},
        "succes": {"debloques": sum(a["debloque"] for a in ach), "total": len(ach)},
        "series": list(stats["series"].values()),
        "favoris": [favs[i] for i in fav_ids if i in favs],
    }
    if me:
        out["titres_disponibles"] = unlocked_titles(stats)
    return out


@router.get("/api/me/profil")
def my_profile(player: dict = Depends(current_player)):
    with db.connection() as conn:
        return _profile(conn, player, me=True)


@router.get("/api/joueurs/{player_id}/profil")
def public_profile(player_id: str, player: dict = Depends(current_player)):
    try:
        pid = uuid.UUID(player_id)
    except ValueError:
        raise HTTPException(404, "Joueur inconnu") from None
    with db.connection() as conn:
        row = conn.execute("SELECT id FROM players WHERE id = %s", (pid,)).fetchone()
        if not row:
            raise HTTPException(404, "Joueur inconnu")
        if pid != player["id"] and not allows(conn, pid, "profil_public") and not are_friends(conn, pid, player["id"]):
            raise HTTPException(403, "Ce joueur réserve son profil à ses amis")
        return _profile(conn, row, me=False)


class ProfileIn(BaseModel):
    pseudo: str | None = Field(default=None, min_length=2, max_length=24)
    titre: str | None = Field(default=None, max_length=60)
    favoris: list[int] | None = Field(default=None, max_length=5)


@router.patch("/api/me/profil")
def update_profile(body: ProfileIn, player: dict = Depends(current_player)):
    with db.connection() as conn, conn.transaction():
        if body.pseudo is not None:
            pseudo = " ".join(body.pseudo.split())
            if len(pseudo) < 2:
                raise HTTPException(422, "Pseudo trop court")
            conn.execute("UPDATE players SET pseudo = %s WHERE id = %s", (pseudo, player["id"]))
        if body.titre is not None:
            if body.titre and body.titre not in unlocked_titles(player_stats(conn, player["id"])):
                raise HTTPException(422, "Ce titre n'est pas encore débloqué")
            conn.execute("UPDATE players SET titre = %s WHERE id = %s", (body.titre or None, player["id"]))
        if body.favoris is not None:
            ids = list(dict.fromkeys(body.favoris))  # sans doublon, ordre conservé
            owned = {r["card_id"] for r in conn.execute(
                "SELECT card_id FROM player_cards WHERE player_id = %s AND card_id = ANY(%s)", (player["id"], ids)).fetchall()}
            if set(ids) - owned:
                raise HTTPException(422, "La vitrine ne peut montrer que des cartes de ta collection")
            conn.execute("UPDATE players SET favoris = %s WHERE id = %s", (ids, player["id"]))
        return _profile(conn, player, me=True)


@router.get("/api/me/succes")
def my_achievements(player: dict = Depends(current_player)):
    with db.connection() as conn:
        ach = achievements_for(player_stats(conn, player["id"]))
    return {"debloques": sum(a["debloque"] for a in ach), "total": len(ach), "succes": ach}


# type → (expression classée, libellé de la valeur) ; « bataille » a sa propre requête (points de rang)
RANKINGS = {
    "collection": ("count(pc.card_id)", "cartes"),
    "semaine": ("count(pc.card_id) FILTER (WHERE pc.first_obtained_at > now() - interval '7 days')", "nouvelles cartes"),
}


@router.get("/api/classement")
def ranking(type: Literal["collection", "semaine", "bataille"] = "collection", limit: int = 50,
            player: dict = Depends(current_player)):
    limit = max(1, min(limit, 100))
    if type == "bataille":
        label = "points de rang"
        with db.connection() as conn:
            rows = conn.execute("""
                WITH scores AS (
                    SELECT p.id, coalesce(p.pseudo, %(def)s) AS pseudo, p.titre, p.points_rang AS valeur,
                           (SELECT count(*) FROM battles b WHERE b.player_id = p.id AND b.won) AS legendaires
                    FROM players p WHERE EXISTS (SELECT 1 FROM battles b WHERE b.player_id = p.id))
                SELECT *, rank() OVER (ORDER BY valeur DESC, legendaires DESC) AS rang
                FROM scores ORDER BY rang, pseudo""", {"def": DEFAULT_PSEUDO}).fetchall()
        return _ranking_out(type, label, rows, player, limit)
    expr, label = RANKINGS[type]
    with db.connection() as conn:
        rows = conn.execute(f"""
            WITH scores AS (
                SELECT p.id, coalesce(p.pseudo, %(def)s) AS pseudo, p.titre, {expr} AS valeur,
                       count(pc.card_id) FILTER (WHERE c.rarete = 'L') AS legendaires
                FROM players p JOIN player_cards pc ON pc.player_id = p.id JOIN cards c ON c.id = pc.card_id
                GROUP BY p.id)
            SELECT *, rank() OVER (ORDER BY valeur DESC, legendaires DESC) AS rang
            FROM scores WHERE valeur > 0 ORDER BY rang, pseudo""", {"def": DEFAULT_PSEUDO}).fetchall()
    return _ranking_out(type, label, rows, player, limit)


def _ranking_out(type: str, label: str, rows: list, player: dict, limit: int) -> dict:
    """Pour « bataille », le champ legendaires porte le nombre de victoires (critère de départage)."""
    me = next((r for r in rows if r["id"] == player["id"]), None)
    fmt = lambda r: {"rang": r["rang"], "id": r["id"], "pseudo": r["pseudo"], "titre": r["titre"],  # noqa: E731
                     "valeur": r["valeur"], "legendaires": r["legendaires"], "moi": r["id"] == player["id"]}
    return {"type": type, "libelle": label, "joueurs": [fmt(r) for r in rows[:limit]],
            "moi": fmt(me) if me else None, "participants": len(rows)}
