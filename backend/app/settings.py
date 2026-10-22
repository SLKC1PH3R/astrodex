"""Paramètres du compte : réglages de confidentialité, clé de connexion, suppression du compte."""
from __future__ import annotations

import json
import secrets

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from . import db
from .common import current_player, hash_token

router = APIRouter()

# réglage → (valeur par défaut, effet)
PRIVACY = {
    "demandes_amis": (True, "On peut m'envoyer des demandes d'ami"),
    "profil_public": (True, "Mon profil est visible par tous (sinon : mes amis seulement)"),
    "defis": (True, "Mes amis peuvent me défier en bataille"),
    "invitations_guilde": (True, "Mes amis peuvent m'inviter dans leur guilde"),
}


def preferences(conn, player_id) -> dict:
    row = conn.execute("SELECT preferences FROM players WHERE id = %s", (player_id,)).fetchone()
    stored = (row["preferences"] if row else None) or {}
    return {k: bool(stored.get(k, default)) for k, (default, _) in PRIVACY.items()}


def allows(conn, player_id, key: str) -> bool:
    return preferences(conn, player_id)[key]


def _out(conn, pid) -> dict:
    p = conn.execute("SELECT pseudo, friend_code, created_at, email, is_admin FROM players WHERE id = %s", (pid,)).fetchone()
    prefs = preferences(conn, pid)
    return {"pseudo": p["pseudo"], "code_ami": p["friend_code"], "inscrit_le": p["created_at"], "email": p["email"], "admin": p["is_admin"],
            "confidentialite": [{"id": k, "libelle": label, "actif": prefs[k]} for k, (_, label) in PRIVACY.items()]}


@router.get("/api/me/parametres")
def get_settings(player: dict = Depends(current_player)):
    with db.connection() as conn:
        return _out(conn, player["id"])


@router.patch("/api/me/parametres")
def update_settings(body: dict[str, bool], player: dict = Depends(current_player)):
    unknown = set(body) - set(PRIVACY)
    if unknown:
        raise HTTPException(422, f"Réglage inconnu : {', '.join(sorted(unknown))}")
    with db.connection() as conn:
        conn.execute("UPDATE players SET preferences = preferences || %s::jsonb WHERE id = %s", (json.dumps(body), player["id"]))
        return _out(conn, player["id"])


@router.post("/api/me/cle")
def rotate_key(player: dict = Depends(current_player)):
    """Remplace la clé de connexion : l'ancienne cesse de fonctionner, et tous les appareils sont déconnectés."""
    token = secrets.token_urlsafe(32)
    with db.connection() as conn, conn.transaction():
        conn.execute("UPDATE players SET token_hash = %s WHERE id = %s", (hash_token(token), player["id"]))
        conn.execute("DELETE FROM sessions WHERE player_id = %s", (player["id"],))
    return {"token": token}


class DeleteIn(BaseModel):
    confirmation: str


@router.delete("/api/me")
def delete_account(body: DeleteIn, player: dict = Depends(current_player)):
    """Supprime le compte et tout ce qui s'y rattache. Il faut retaper son pseudo (ou SUPPRIMER sans pseudo)."""
    pid = player["id"]
    expected = (player.get("pseudo") or "SUPPRIMER").strip().lower()
    if body.confirmation.strip().lower() != expected:
        raise HTTPException(422, "La confirmation ne correspond pas")
    from .guild import leave_guild_conn  # import tardif : guild importe ce module
    with db.connection() as conn, conn.transaction():
        leave_guild_conn(conn, pid)  # passe la main ou dissout la guilde proprement
        conn.execute("DELETE FROM players WHERE id = %s", (pid,))
    return {"supprime": True}
