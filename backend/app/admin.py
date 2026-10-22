"""Administration des comptes : statistiques, liste et recherche, suppression, mot de passe, purge des invités.

Réservé aux joueurs is_admin (donné aux e-mails de ADMIN_EMAILS, voir config.py).
"""
from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from . import db
from .auth import check_new_password, hash_password
from .common import current_admin
from .social import parse_id

router = APIRouter()
DEFAULT_PSEUDO = "Joueur"


@router.get("/api/admin/stats")
def stats(admin: dict = Depends(current_admin)):
    with db.connection() as conn:
        return conn.execute("""
            SELECT count(*) AS comptes,
                   count(*) FILTER (WHERE email IS NOT NULL) AS avec_email,
                   count(*) FILTER (WHERE email IS NULL) AS invites,
                   count(*) FILTER (WHERE email IS NULL AND NOT EXISTS (SELECT 1 FROM player_cards pc WHERE pc.player_id = p.id)) AS invites_vides,
                   count(*) FILTER (WHERE last_seen > now() - interval '7 days') AS actifs_7j,
                   count(*) FILTER (WHERE created_at > now() - interval '24 hours') AS nouveaux_24h
            FROM players p""").fetchone()


SORTS = {"recent": "p.created_at DESC", "actif": "p.last_seen DESC NULLS LAST", "cartes": "cartes DESC", "pseudo": "lower(coalesce(p.pseudo, '')) ASC"}


@router.get("/api/admin/joueurs")
def players(q: str | None = None, type: Literal["tous", "comptes", "invites"] = "tous",
            tri: Literal["recent", "actif", "cartes", "pseudo"] = "recent", page: int = 1, admin: dict = Depends(current_admin)):
    where, params = ["true"], {}
    if q and q.strip():
        where.append("(p.pseudo ILIKE %(q)s OR p.email ILIKE %(q)s OR p.id::text = %(exact)s)")
        params.update(q=f"%{q.strip()}%", exact=q.strip())
    if type == "comptes":
        where.append("p.email IS NOT NULL")
    elif type == "invites":
        where.append("p.email IS NULL")
    page = max(1, page)
    with db.connection() as conn:
        total = conn.execute(f"SELECT count(*) AS n FROM players p WHERE {' AND '.join(where)}", params).fetchone()["n"]
        rows = conn.execute(f"""
            SELECT p.id, coalesce(p.pseudo, '{DEFAULT_PSEUDO}') AS pseudo, p.email, p.is_admin, p.created_at, p.last_seen, p.eclats,
                   (SELECT count(*) FROM player_cards pc WHERE pc.player_id = p.id) AS cartes,
                   (SELECT count(*) FROM pack_openings po WHERE po.player_id = p.id) AS boosters,
                   (SELECT count(*) FROM sessions s WHERE s.player_id = p.id) AS appareils
            FROM players p WHERE {' AND '.join(where)}
            ORDER BY {SORTS[tri]} LIMIT 50 OFFSET {(page - 1) * 50}""", params).fetchall()
    return {"total": total, "page": page, "pages": max(1, -(-total // 50)), "joueurs": rows}


def _delete(conn, pid) -> None:
    from .guild import leave_guild_conn  # passe la main ou dissout la guilde proprement
    leave_guild_conn(conn, pid)
    conn.execute("DELETE FROM players WHERE id = %s", (pid,))


@router.delete("/api/admin/joueurs/{player_id}")
def delete_player(player_id: str, admin: dict = Depends(current_admin)):
    pid = parse_id(player_id)
    if pid == admin["id"]:
        raise HTTPException(422, "Tu ne peux pas supprimer ton propre compte d'ici")
    with db.connection() as conn, conn.transaction():
        row = conn.execute("SELECT is_admin FROM players WHERE id = %s", (pid,)).fetchone()
        if not row:
            raise HTTPException(404, "Joueur inconnu")
        if row["is_admin"]:
            raise HTTPException(403, "Un compte administrateur ne se supprime pas d'ici")
        _delete(conn, pid)
    return {"supprime": 1}


class BulkDeleteIn(BaseModel):
    ids: list[str] = Field(min_length=1, max_length=200)


@router.post("/api/admin/joueurs/supprimer")
def delete_many(body: BulkDeleteIn, admin: dict = Depends(current_admin)):
    ids = {parse_id(i) for i in body.ids} - {admin["id"]}
    with db.connection() as conn, conn.transaction():
        rows = conn.execute("SELECT id FROM players WHERE id = ANY(%s) AND NOT is_admin", (list(ids),)).fetchall()
        for r in rows:
            _delete(conn, r["id"])
    return {"supprime": len(rows)}


class PurgeIn(BaseModel):
    jours: int = Field(default=7, ge=0, le=3650)
    vides_seulement: bool = True
    confirmer: bool = False


@router.post("/api/admin/purge-invites")
def purge_guests(body: PurgeIn, admin: dict = Depends(current_admin)):
    """Profils invités (sans e-mail) inactifs depuis N jours ; vides_seulement = sans aucune carte.
    Sans confirmer, renvoie seulement le nombre de profils concernés."""
    cond = f"""email IS NULL AND NOT is_admin AND coalesce(last_seen, created_at) < now() - make_interval(days => %s)
               {"AND NOT EXISTS (SELECT 1 FROM player_cards pc WHERE pc.player_id = players.id)" if body.vides_seulement else ""}"""
    with db.connection() as conn, conn.transaction():
        ids = [r["id"] for r in conn.execute(f"SELECT id FROM players WHERE {cond}", (body.jours,)).fetchall()]
        if body.confirmer:
            for pid in ids:
                _delete(conn, pid)
    return {"concernes": len(ids), "supprime": len(ids) if body.confirmer else 0}


class ResetIn(BaseModel):
    nouveau: str = Field(max_length=200)


@router.post("/api/admin/joueurs/{player_id}/mot-de-passe")
def reset_password(player_id: str, body: ResetIn, admin: dict = Depends(current_admin)):
    """Mot de passe oublié : l'admin en fixe un nouveau ; les sessions du joueur sont fermées."""
    pid = parse_id(player_id)
    check_new_password(body.nouveau)
    with db.connection() as conn, conn.transaction():
        row = conn.execute("SELECT email FROM players WHERE id = %s", (pid,)).fetchone()
        if not row:
            raise HTTPException(404, "Joueur inconnu")
        if not row["email"]:
            raise HTTPException(409, "Ce profil invité n'a pas d'e-mail")
        conn.execute("UPDATE players SET password_hash = %s WHERE id = %s", (hash_password(body.nouveau), pid))
        conn.execute("DELETE FROM sessions WHERE player_id = %s", (pid,))
    return {"ok": True}
