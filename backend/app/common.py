"""Éléments partagés par les routes : identification du joueur et format des cartes."""
from __future__ import annotations

import hashlib

from fastapi import Depends, Header, HTTPException

from . import db

CARD_SELECT = """
    SELECT c.id, c.numero, c.rarete, c.attaque, c.defense, c.vitesse, c.image, c.credit, c.licence, c.variante, c.cadrage,
           o.slug, o.nom, o.type, o.constellation, o.description, o.faits,
           s.code AS serie, t.total
    FROM cards c JOIN celestial_objects o ON o.id = c.object_id JOIN series s ON s.id = c.series_id
    JOIN (SELECT series_id, count(*) AS total FROM cards WHERE NOT retired GROUP BY series_id) t ON t.series_id = c.series_id
"""


def card_out(r: dict) -> dict:
    return {
        "id": r["id"], "numero": r["numero"], "total": r["total"], "serie": r["serie"],
        "slug": r["slug"], "nom": r["nom"], "type": r["type"], "constellation": r["constellation"],
        "description": r["description"], "faits": r["faits"], "rarete": r["rarete"],
        "attaque": r["attaque"], "defense": r["defense"], "vitesse": r["vitesse"],
        "puissance": r["attaque"] + r["defense"] + r["vitesse"],
        "image_url": f"/media/{r['image']}", "credit": r["credit"], "licence": r["licence"], "variante": r["variante"], "cadrage": r["cadrage"],
    }


# ---------- Authentification par jeton ----------
# Chaque appareil connecté reçoit un jeton aléatoire (table sessions) ; seul son SHA-256 est stocké.
# players.token_hash reste accepté : c'est la clé des comptes créés avant les comptes e-mail (et des invités).

def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def bearer(authorization: str | None) -> str | None:
    if authorization and authorization.lower().startswith("bearer ") and authorization[7:].strip():
        return authorization[7:].strip()
    return None


def player_for_token(conn, token: str) -> dict | None:
    h = hash_token(token)
    row = conn.execute("""SELECT p.id, p.pseudo, p.created_at, p.email, p.is_admin FROM sessions s JOIN players p ON p.id = s.player_id
                          WHERE s.token_hash = %s""", (h,)).fetchone()
    if row:
        conn.execute("UPDATE sessions SET last_used = now() WHERE token_hash = %s AND last_used < now() - interval '10 minutes'", (h,))
        return row
    return conn.execute("SELECT id, pseudo, created_at, email, is_admin FROM players WHERE token_hash = %s", (h,)).fetchone()


def current_player(authorization: str | None = Header(default=None)) -> dict:
    token = bearer(authorization)
    if not token:
        raise HTTPException(401, "Non connecté")
    with db.connection() as conn:
        row = player_for_token(conn, token)
        if not row:
            raise HTTPException(401, "Session expirée : reconnecte-toi")
        # dernière activité (statut « en ligne » des amis), au plus une écriture par minute
        conn.execute("UPDATE players SET last_seen = now() WHERE id = %s AND last_seen < now() - interval '1 minute'", (row["id"],))
    return row


def current_admin(player: dict = Depends(current_player)) -> dict:
    if not player.get("is_admin"):
        raise HTTPException(403, "Réservé aux administrateurs")
    return player
