"""Éléments partagés par les routes : identification du joueur et format des cartes."""
from __future__ import annotations

import hashlib

from fastapi import Header, HTTPException

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


# ---------- Authentification légère par jeton ----------
# Un joueur reçoit un jeton aléatoire à sa création ; seul son SHA-256 est stocké.
# À remplacer plus tard par Authentik / NextAuth : il suffira de faire correspondre l'identité à players.id.

def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def current_player(authorization: str | None = Header(default=None)) -> dict:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Jeton manquant : créez un joueur avec POST /api/players")
    with db.connection() as conn:
        row = conn.execute("SELECT id, pseudo, created_at FROM players WHERE token_hash = %s",
                           (hash_token(authorization[7:].strip()),)).fetchone()
        if not row:
            raise HTTPException(401, "Jeton inconnu")
        # dernière activité (statut « en ligne » des amis), au plus une écriture par minute
        conn.execute("UPDATE players SET last_seen = now() WHERE id = %s AND last_seen < now() - interval '1 minute'", (row["id"],))
    return row
