"""Échanges de cartes entre amis : proposition, acceptation (cartes transférées), refus, annulation."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from . import db
from .common import CARD_SELECT, card_out, current_player
from .inventory import give, owned, take
from .social import DEFAULT_PSEUDO, are_friends, parse_id

router = APIRouter()
MAX_SIDE = 5  # cartes au plus de chaque côté


def _cards(conn, ids) -> dict:
    return {r["id"]: card_out(r) for r in conn.execute(CARD_SELECT + " WHERE c.id = ANY(%s)", (list(ids),)).fetchall()} if ids else {}


def _trades_out(conn, rows, me) -> list[dict]:
    """Met en forme des échanges du point de vue du joueur : ce qu'il donne et ce qu'il reçoit."""
    if not rows:
        return []
    items = conn.execute("SELECT trade_id, giver, card_id, quantite FROM trade_items WHERE trade_id = ANY(%s)",
                         ([r["id"] for r in rows],)).fetchall()
    cards = _cards(conn, {i["card_id"] for i in items})
    out = []
    for r in rows:
        mine = [i for i in items if i["trade_id"] == r["id"] and i["giver"] == me]
        theirs = [i for i in items if i["trade_id"] == r["id"] and i["giver"] != me]
        out.append({
            "id": r["id"], "statut": r["status"], "cree_le": r["created_at"], "resolu_le": r["resolved_at"],
            "propose_par_moi": r["proposer"] == me,
            "joueur": {"id": r["other"], "pseudo": r["pseudo"]},
            "je_donne": [{**cards[i["card_id"]], "quantite": i["quantite"]} for i in mine],
            "je_recois": [{**cards[i["card_id"]], "quantite": i["quantite"]} for i in theirs],
        })
    return out


@router.get("/api/me/echanges")
def my_trades(player: dict = Depends(current_player)):
    me = player["id"]
    with db.connection() as conn:
        rows = conn.execute(f"""
            SELECT t.*, o.id AS other, coalesce(o.pseudo, '{DEFAULT_PSEUDO}') AS pseudo
            FROM trades t JOIN players o ON o.id = CASE WHEN t.proposer = %(p)s THEN t.recipient ELSE t.proposer END
            WHERE (t.proposer = %(p)s OR t.recipient = %(p)s)
              AND (t.status = 'pending' OR t.resolved_at > now() - interval '30 days')
            ORDER BY coalesce(t.resolved_at, t.created_at) DESC LIMIT 60""", {"p": me}).fetchall()
        trades = _trades_out(conn, rows, me)
    return {
        "recus": [t for t in trades if t["statut"] == "pending" and not t["propose_par_moi"]],
        "envoyes": [t for t in trades if t["statut"] == "pending" and t["propose_par_moi"]],
        "historique": [t for t in trades if t["statut"] != "pending"][:20],
    }


@router.get("/api/joueurs/{player_id}/collection")
def friend_collection(player_id: str, player: dict = Depends(current_player)):
    """Collection d'un ami (pour choisir quoi lui demander) ; « manque » = carte que je n'ai pas."""
    oid = parse_id(player_id)
    with db.connection() as conn:
        if not are_friends(conn, player["id"], oid):
            raise HTTPException(403, "Seule la collection de tes amis est visible")
        rows = conn.execute(CARD_SELECT.replace("SELECT c.id,", "SELECT pc.quantite, (mine.card_id IS NULL) AS manque, c.id,")
                            + """ JOIN player_cards pc ON pc.card_id = c.id AND pc.player_id = %s
                                  LEFT JOIN player_cards mine ON mine.card_id = c.id AND mine.player_id = %s
                                  ORDER BY (mine.card_id IS NULL) DESC, (c.attaque + c.defense + c.vitesse) DESC""",
                            (oid, player["id"])).fetchall()
    return [{**card_out(r), "quantite": r["quantite"], "manque": r["manque"]} for r in rows]


class TradeIn(BaseModel):
    avec: str
    donne: list[int] = Field(default_factory=list, max_length=MAX_SIDE)
    demande: list[int] = Field(default_factory=list, max_length=MAX_SIDE)


def _counts(ids: list[int]) -> dict[int, int]:
    out: dict[int, int] = {}
    for i in ids:
        out[i] = out.get(i, 0) + 1
    return out


@router.post("/api/me/echanges", status_code=201)
def propose_trade(body: TradeIn, player: dict = Depends(current_player)):
    me, other = player["id"], parse_id(body.avec)
    if not body.donne or not body.demande:
        raise HTTPException(422, "Un échange demande au moins une carte de chaque côté")
    give_n, ask_n = _counts(body.donne), _counts(body.demande)
    with db.connection() as conn, conn.transaction():
        if not are_friends(conn, me, other):
            raise HTTPException(403, "Tu ne peux échanger qu'avec tes amis")
        for cid, n in give_n.items():
            if owned(conn, me, cid) < n:
                raise HTTPException(409, "Tu proposes une carte que tu n'as pas (ou pas en assez d'exemplaires)")
        for cid, n in ask_n.items():
            if owned(conn, other, cid) < n:
                raise HTTPException(409, "Ton ami n'a pas (ou plus) une des cartes demandées")
        tid = conn.execute("INSERT INTO trades (proposer, recipient) VALUES (%s, %s) RETURNING id", (me, other)).fetchone()["id"]
        for giver, counts in ((me, give_n), (other, ask_n)):
            for cid, n in counts.items():
                conn.execute("INSERT INTO trade_items (trade_id, giver, card_id, quantite) VALUES (%s, %s, %s, %s)", (tid, giver, cid, n))
        names = _cards(conn, set(give_n) | set(ask_n))
        txt = (f"Proposition d'échange : {', '.join(names[c]['nom'] for c in give_n)} "
               f"contre {', '.join(names[c]['nom'] for c in ask_n)}. À voir dans l'onglet Échanges.")
        conn.execute("INSERT INTO messages (sender, recipient, body) VALUES (%s, %s, %s)", (me, other, txt[:1000]))
    return {"id": tid, "statut": "pending"}


def _pending(conn, trade_id: int, me, *, as_recipient: bool):
    t = conn.execute("SELECT * FROM trades WHERE id = %s FOR UPDATE", (trade_id,)).fetchone()
    if not t or (t["recipient"] if as_recipient else t["proposer"]) != me:
        raise HTTPException(404, "Échange introuvable")
    if t["status"] != "pending":
        raise HTTPException(409, "Cet échange est déjà clos")
    return t


@router.post("/api/me/echanges/{trade_id}/accepter")
def accept_trade(trade_id: int, player: dict = Depends(current_player)):
    me = player["id"]
    with db.connection() as conn, conn.transaction():
        t = _pending(conn, trade_id, me, as_recipient=True)
        items = conn.execute("SELECT giver, card_id, quantite FROM trade_items WHERE trade_id = %s", (trade_id,)).fetchall()
        for i in items:  # chaque carte part de celui qui la cède vers l'autre joueur
            to = t["recipient"] if i["giver"] == t["proposer"] else t["proposer"]
            take(conn, i["giver"], i["card_id"], i["quantite"],
                 error="Une des cartes n'est plus disponible : l'échange ne peut pas se faire")
            give(conn, to, i["card_id"], i["quantite"])
        conn.execute("UPDATE trades SET status = 'accepted', resolved_at = now() WHERE id = %s", (trade_id,))
    return {"id": trade_id, "statut": "accepted"}


@router.post("/api/me/echanges/{trade_id}/refuser")
def refuse_trade(trade_id: int, player: dict = Depends(current_player)):
    with db.connection() as conn, conn.transaction():
        _pending(conn, trade_id, player["id"], as_recipient=True)
        conn.execute("UPDATE trades SET status = 'refused', resolved_at = now() WHERE id = %s", (trade_id,))
    return {"id": trade_id, "statut": "refused"}


@router.delete("/api/me/echanges/{trade_id}")
def cancel_trade(trade_id: int, player: dict = Depends(current_player)):
    with db.connection() as conn, conn.transaction():
        _pending(conn, trade_id, player["id"], as_recipient=False)
        conn.execute("UPDATE trades SET status = 'cancelled', resolved_at = now() WHERE id = %s", (trade_id,))
    return {"id": trade_id, "statut": "cancelled"}
