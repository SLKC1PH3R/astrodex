"""Amis (code ami, demandes) et messages privés entre amis."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from . import db
from .common import current_player
from .settings import allows

router = APIRouter()
DEFAULT_PSEUDO = "Joueur"
ONLINE = "interval '5 minutes'"  # actif dans les 5 dernières minutes = « en ligne »


def parse_id(player_id: str) -> uuid.UUID:
    try:
        return uuid.UUID(player_id)
    except ValueError:
        raise HTTPException(404, "Joueur inconnu") from None


def are_friends(conn, a, b) -> bool:
    return bool(conn.execute("""SELECT 1 FROM friendships WHERE status = 'accepted'
        AND ((requester = %s AND addressee = %s) OR (requester = %s AND addressee = %s))""", (a, b, b, a)).fetchone())


def friend_ids(conn, pid) -> list:
    return [r["fid"] for r in conn.execute("""
        SELECT CASE WHEN requester = %(p)s THEN addressee ELSE requester END AS fid
        FROM friendships WHERE status = 'accepted' AND (requester = %(p)s OR addressee = %(p)s)""", {"p": pid}).fetchall()]


PLAYER_COLS = f"""p.id, coalesce(p.pseudo, '{DEFAULT_PSEUDO}') AS pseudo, p.titre, p.last_seen AS vu_le,
    p.last_seen > now() - {ONLINE} AS en_ligne,
    (SELECT count(*) FROM player_cards pc WHERE pc.player_id = p.id) AS cartes_uniques"""


# ---------- Amis ----------

@router.get("/api/me/amis")
def my_friends(player: dict = Depends(current_player)):
    pid = player["id"]
    with db.connection() as conn:
        code = conn.execute("SELECT friend_code FROM players WHERE id = %s", (pid,)).fetchone()["friend_code"]
        rows = conn.execute(f"""
            SELECT {PLAYER_COLS}, f.status, f.requester = %(p)s AS envoyee, f.created_at AS depuis
            FROM friendships f JOIN players p ON p.id = CASE WHEN f.requester = %(p)s THEN f.addressee ELSE f.requester END
            WHERE f.requester = %(p)s OR f.addressee = %(p)s
            ORDER BY p.last_seen DESC""", {"p": pid}).fetchall()
    strip = lambda r: {k: r[k] for k in ("id", "pseudo", "titre", "vu_le", "en_ligne", "cartes_uniques", "depuis")}  # noqa: E731
    return {
        "code": code,
        "amis": [strip(r) for r in rows if r["status"] == "accepted"],
        "recues": [strip(r) for r in rows if r["status"] == "pending" and not r["envoyee"]],
        "envoyees": [strip(r) for r in rows if r["status"] == "pending" and r["envoyee"]],
    }


class FriendIn(BaseModel):
    cible: str = Field(min_length=2, max_length=40, description="Code ami (ASTRO-XXXXXX) ou pseudo exact")


@router.post("/api/me/amis", status_code=201)
def add_friend(body: FriendIn, player: dict = Depends(current_player)):
    """Envoie une demande ; si l'autre joueur nous en avait déjà envoyé une, elle est acceptée."""
    pid, target = player["id"], body.cible.strip()
    with db.connection() as conn, conn.transaction():
        found = conn.execute("SELECT id FROM players WHERE upper(friend_code) = upper(%s)", (target,)).fetchall() or \
            conn.execute("SELECT id FROM players WHERE lower(pseudo) = lower(%s)", (target,)).fetchall()
        if not found:
            raise HTTPException(404, "Aucun joueur avec ce code ou ce pseudo")
        if len(found) > 1:
            raise HTTPException(409, "Plusieurs joueurs portent ce pseudo : utilise son code ami")
        fid = found[0]["id"]
        if fid == pid:
            raise HTTPException(422, "Tu ne peux pas t'ajouter toi-même")
        existing = conn.execute("""SELECT requester, status FROM friendships
            WHERE (requester = %s AND addressee = %s) OR (requester = %s AND addressee = %s)""", (pid, fid, fid, pid)).fetchone()
        if existing and existing["status"] == "accepted":
            raise HTTPException(409, "Vous êtes déjà amis")
        if existing and existing["requester"] == pid:
            raise HTTPException(409, "Demande déjà envoyée")
        if existing:  # demande inverse en attente : on accepte
            conn.execute("UPDATE friendships SET status = 'accepted', accepted_at = now() WHERE requester = %s AND addressee = %s", (fid, pid))
            return {"statut": "amis", "id": fid}
        if not allows(conn, fid, "demandes_amis"):
            raise HTTPException(403, "Ce joueur n'accepte pas de demandes d'ami")
        conn.execute("INSERT INTO friendships (requester, addressee) VALUES (%s, %s)", (pid, fid))
        return {"statut": "demande_envoyee", "id": fid}


@router.post("/api/me/amis/{player_id}/accepter")
def accept_friend(player_id: str, player: dict = Depends(current_player)):
    fid = parse_id(player_id)
    with db.connection() as conn:
        cur = conn.execute("""UPDATE friendships SET status = 'accepted', accepted_at = now()
            WHERE requester = %s AND addressee = %s AND status = 'pending'""", (fid, player["id"]))
        if not cur.rowcount:
            raise HTTPException(404, "Aucune demande de ce joueur")
    return {"statut": "amis", "id": fid}


@router.delete("/api/me/amis/{player_id}", status_code=204)
def remove_friend(player_id: str, player: dict = Depends(current_player)):
    """Refuse une demande reçue, annule une demande envoyée ou retire un ami."""
    fid = parse_id(player_id)
    with db.connection() as conn:
        cur = conn.execute("""DELETE FROM friendships
            WHERE (requester = %s AND addressee = %s) OR (requester = %s AND addressee = %s)""", (player["id"], fid, fid, player["id"]))
        if not cur.rowcount:
            raise HTTPException(404, "Aucun lien avec ce joueur")


@router.get("/api/me/amis/activite")
def friends_activity(player: dict = Depends(current_player)):
    """Dernières cartes Ultra rares et Légendaires obtenues par les amis."""
    with db.connection() as conn:
        fids = friend_ids(conn, player["id"])
        if not fids:
            return []
        return conn.execute(f"""
            SELECT p.id AS joueur_id, coalesce(p.pseudo, '{DEFAULT_PSEUDO}') AS pseudo, o.nom AS carte, c.rarete,
                   '/media/' || c.image AS image_url, pc.first_obtained_at AS le
            FROM player_cards pc JOIN players p ON p.id = pc.player_id
            JOIN cards c ON c.id = pc.card_id JOIN celestial_objects o ON o.id = c.object_id
            WHERE pc.player_id = ANY(%s) AND c.rarete IN ('UR', 'L')
            ORDER BY pc.first_obtained_at DESC LIMIT 12""", (fids,)).fetchall()


# ---------- Messages ----------

@router.get("/api/me/messages")
def conversations(player: dict = Depends(current_player)):
    pid = player["id"]
    with db.connection() as conn:
        return conn.execute(f"""
            WITH m AS (
                SELECT *, CASE WHEN sender = %(p)s THEN recipient ELSE sender END AS other
                FROM messages WHERE sender = %(p)s OR recipient = %(p)s),
            last AS (SELECT DISTINCT ON (other) other, body, created_at, sender = %(p)s AS de_moi FROM m ORDER BY other, created_at DESC)
            SELECT {PLAYER_COLS}, last.body AS dernier, last.created_at AS le, last.de_moi,
                   (SELECT count(*) FROM m WHERE m.other = last.other AND m.recipient = %(p)s AND m.read_at IS NULL) AS non_lus
            FROM last JOIN players p ON p.id = last.other
            ORDER BY last.created_at DESC""", {"p": pid}).fetchall()


@router.get("/api/me/messages/{player_id}")
def thread(player_id: str, player: dict = Depends(current_player)):
    """Conversation avec un joueur (200 derniers messages) ; marque les messages reçus comme lus."""
    oid, pid = parse_id(player_id), player["id"]
    with db.connection() as conn:
        other = conn.execute(f"SELECT {PLAYER_COLS} FROM players p WHERE p.id = %s", (oid,)).fetchone()
        if not other:
            raise HTTPException(404, "Joueur inconnu")
        rows = conn.execute("""
            SELECT id, body AS texte, created_at AS le, sender = %(p)s AS de_moi FROM (
                SELECT * FROM messages WHERE (sender = %(p)s AND recipient = %(o)s) OR (sender = %(o)s AND recipient = %(p)s)
                ORDER BY created_at DESC LIMIT 200) t ORDER BY le""", {"p": pid, "o": oid}).fetchall()
        conn.execute("UPDATE messages SET read_at = now() WHERE sender = %s AND recipient = %s AND read_at IS NULL", (oid, pid))
        return {"joueur": other, "amis": are_friends(conn, pid, oid), "messages": rows}


class MessageIn(BaseModel):
    texte: str = Field(min_length=1, max_length=1000)


@router.post("/api/me/messages/{player_id}", status_code=201)
def send_message(player_id: str, body: MessageIn, player: dict = Depends(current_player)):
    oid, pid = parse_id(player_id), player["id"]
    text = body.texte.strip()
    if not text:
        raise HTTPException(422, "Message vide")
    with db.connection() as conn:
        if not are_friends(conn, pid, oid):
            raise HTTPException(403, "Tu ne peux écrire qu'à tes amis")
        return conn.execute("""INSERT INTO messages (sender, recipient, body) VALUES (%s, %s, %s)
            RETURNING id, body AS texte, created_at AS le, true AS de_moi""", (pid, oid, text)).fetchone()


@router.get("/api/me/notifications")
def notifications(player: dict = Depends(current_player)):
    """Compteurs pour le menu : messages non lus, demandes d'ami et propositions d'échange reçues."""
    with db.connection() as conn:
        return conn.execute("""
            SELECT (SELECT count(*) FROM messages WHERE recipient = %(p)s AND read_at IS NULL) AS messages,
                   (SELECT count(*) FROM friendships WHERE addressee = %(p)s AND status = 'pending') AS amis,
                   (SELECT count(*) FROM trades WHERE recipient = %(p)s AND status = 'pending') AS echanges""",
                            {"p": player["id"]}).fetchone()
