"""Comptes : inscription et connexion par e-mail + mot de passe, sessions par appareil, déconnexion.

- Le mot de passe est haché avec scrypt (bibliothèque standard), sel aléatoire par compte.
- Chaque connexion ouvre une session (un jeton par appareil) : changer d'ordinateur retrouve le même compte
  sans déconnecter les autres appareils.
- Un joueur invité (jeton seul, sans e-mail) qui s'inscrit garde sa collection : l'e-mail est rattaché à son compte.
- Les e-mails listés dans ADMIN_EMAILS reçoivent le rôle administrateur.
"""
from __future__ import annotations

import hashlib
import hmac
import re
import secrets
import time

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel, Field

from . import config, db
from .common import bearer, current_player, hash_token, player_for_token

router = APIRouter()
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
MIN_PASSWORD = 8
_SCRYPT = {"n": 2 ** 14, "r": 8, "p": 1}


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, dklen=32, **_SCRYPT)
    return f"scrypt${_SCRYPT['n']}${_SCRYPT['r']}${_SCRYPT['p']}${salt.hex()}${digest.hex()}"


def check_password(password: str, stored: str | None) -> bool:
    try:
        _, n, r, p, salt, digest = (stored or "").split("$")
        test = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), dklen=32, n=int(n), r=int(r), p=int(p))
        return hmac.compare_digest(test.hex(), digest)
    except (ValueError, TypeError):
        return False


def normalize_email(email: str) -> str:
    e = email.strip().lower()
    if not EMAIL_RE.match(e) or len(e) > 200:
        raise HTTPException(422, "Adresse e-mail invalide")
    return e


def check_new_password(password: str) -> None:
    if len(password) < MIN_PASSWORD:
        raise HTTPException(422, f"Le mot de passe doit faire au moins {MIN_PASSWORD} caractères")


def open_session(conn, player_id, user_agent: str | None) -> str:
    token = secrets.token_urlsafe(32)
    conn.execute("INSERT INTO sessions (token_hash, player_id, user_agent) VALUES (%s, %s, %s)",
                 (hash_token(token), player_id, (user_agent or "")[:200]))
    return token


def _account(conn, pid) -> dict:
    return conn.execute("SELECT id, pseudo, email, is_admin, created_at FROM players WHERE id = %s", (pid,)).fetchone()


class SignupIn(BaseModel):
    pseudo: str = Field(min_length=2, max_length=24)
    email: str = Field(max_length=200)
    mot_de_passe: str = Field(max_length=200)


@router.post("/api/auth/inscription", status_code=201)
def signup(body: SignupIn, request: Request, authorization: str | None = Header(default=None)):
    """Crée un compte, ou rattache l'e-mail au compte invité de cet appareil (sa collection est conservée)."""
    email = normalize_email(body.email)
    check_new_password(body.mot_de_passe)
    pseudo = " ".join(body.pseudo.split())
    if len(pseudo) < 2:
        raise HTTPException(422, "Pseudo trop court")
    admin = email in config.ADMIN_EMAILS
    with db.connection() as conn, conn.transaction():
        if conn.execute("SELECT 1 FROM players WHERE lower(email) = %s", (email,)).fetchone():
            raise HTTPException(409, "Un compte existe déjà avec cet e-mail : connecte-toi")
        token = bearer(authorization)
        guest = player_for_token(conn, token) if token else None
        if guest and not guest["email"]:
            pid = guest["id"]
            conn.execute("UPDATE players SET email = %s, password_hash = %s, pseudo = %s, is_admin = is_admin OR %s WHERE id = %s",
                         (email, hash_password(body.mot_de_passe), pseudo, admin, pid))
        else:
            pid = conn.execute("""INSERT INTO players (token_hash, pseudo, email, password_hash, is_admin)
                                  VALUES (%s, %s, %s, %s, %s) RETURNING id""",
                               (hash_token(secrets.token_urlsafe(32)), pseudo, email, hash_password(body.mot_de_passe), admin)).fetchone()["id"]
        session = open_session(conn, pid, request.headers.get("user-agent"))
        return {**_account(conn, pid), "token": session, "rattache": bool(guest and not guest["email"])}


class LoginIn(BaseModel):
    email: str = Field(max_length=200)
    mot_de_passe: str = Field(max_length=200)


@router.post("/api/auth/connexion")
def login(body: LoginIn, request: Request):
    email = body.email.strip().lower()
    with db.connection() as conn, conn.transaction():
        row = conn.execute("SELECT id, password_hash FROM players WHERE lower(email) = %s", (email,)).fetchone()
        if not row or not check_password(body.mot_de_passe, row["password_hash"]):
            time.sleep(0.4)  # freine les essais en rafale
            raise HTTPException(401, "E-mail ou mot de passe incorrect")
        if email in config.ADMIN_EMAILS:
            conn.execute("UPDATE players SET is_admin = true WHERE id = %s", (row["id"],))
        session = open_session(conn, row["id"], request.headers.get("user-agent"))
        return {**_account(conn, row["id"]), "token": session}


@router.post("/api/auth/deconnexion", status_code=204)
def logout(authorization: str | None = Header(default=None)):
    """Ferme la session de cet appareil (les autres appareils restent connectés)."""
    token = bearer(authorization)
    if token:
        with db.connection() as conn:
            conn.execute("DELETE FROM sessions WHERE token_hash = %s", (hash_token(token),))


class PasswordIn(BaseModel):
    actuel: str = Field(default="", max_length=200)
    nouveau: str = Field(max_length=200)


@router.post("/api/me/mot-de-passe")
def change_password(body: PasswordIn, authorization: str | None = Header(default=None), player: dict = Depends(current_player)):
    """Change le mot de passe et ferme les sessions des autres appareils."""
    check_new_password(body.nouveau)
    with db.connection() as conn, conn.transaction():
        row = conn.execute("SELECT password_hash FROM players WHERE id = %s", (player["id"],)).fetchone()
        if not row["password_hash"]:
            raise HTTPException(409, "Ce compte n'a pas encore d'e-mail : crée d'abord ton compte")
        if not check_password(body.actuel, row["password_hash"]):
            raise HTTPException(403, "Mot de passe actuel incorrect")
        conn.execute("UPDATE players SET password_hash = %s WHERE id = %s", (hash_password(body.nouveau), player["id"]))
        conn.execute("DELETE FROM sessions WHERE player_id = %s AND token_hash <> %s",
                     (player["id"], hash_token(bearer(authorization) or "")))
    return {"ok": True}


@router.get("/api/me/sessions")
def my_sessions(authorization: str | None = Header(default=None), player: dict = Depends(current_player)):
    h = hash_token(bearer(authorization) or "")
    with db.connection() as conn:
        rows = conn.execute("""SELECT created_at, last_used, user_agent, token_hash = %s AS actuelle FROM sessions
                               WHERE player_id = %s ORDER BY last_used DESC""", (h, player["id"])).fetchall()
    return rows
