"""Guildes : création, adhésion, rôles, discussion, objectifs collectifs de la semaine et classement.

Rôles : chef (un seul ; gère tout), officier (peut exclure des membres), membre.
Contribution d'un membre sur la semaine : 10 pts par booster ouvert, 15 par Ultra rare ou Légendaire
nouvelle, 20 par bataille gagnée. Les objectifs de la semaine croissent avec la taille de la guilde
et rapportent des éclats à chaque membre (à récupérer une fois).
"""
from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from . import db
from .common import current_player
from .inventory import add_eclats
from .settings import allows
from .social import DEFAULT_PSEUDO, ONLINE, are_friends, parse_id

router = APIRouter()
MAX_MEMBERS = 30
WEEK = "date_trunc('week', now())"  # la semaine commence le lundi

# id → (libellé avec {n}, statistique, cible par membre, récompense en éclats par membre)
OBJECTIVES = {
    "boosters": ("Ouvrir {n} boosters ensemble", "boosters", 25, 150),
    "rares": ("Obtenir {n} cartes Ultra rares ou Légendaires", "rares", 4, 200),
    "victoires": ("Gagner {n} batailles", "victoires", 8, 250),
}
POINTS = {"boosters": 10, "rares": 15, "victoires": 20}

# Contribution de chaque joueur sur la semaine en cours
WEEK_STATS = f"""
    SELECT gm.player_id, gm.guild_id,
        (SELECT count(*) FROM pack_openings po WHERE po.player_id = gm.player_id AND po.opened_at >= {WEEK}) AS boosters,
        (SELECT count(*) FROM player_cards pc JOIN cards c ON c.id = pc.card_id
          WHERE pc.player_id = gm.player_id AND c.rarete IN ('UR', 'L') AND pc.first_obtained_at >= {WEEK}) AS rares,
        (SELECT count(*) FROM battles b WHERE b.player_id = gm.player_id AND b.won AND b.created_at >= {WEEK}) AS victoires
    FROM guild_members gm"""
POINTS_SQL = " + ".join(f"{v} * {k}" for k, v in POINTS.items())


def _membership(conn, pid, lock: bool = False):
    return conn.execute("SELECT guild_id, role FROM guild_members WHERE player_id = %s" + (" FOR UPDATE" if lock else ""),
                        (pid,)).fetchone()


def _require(conn, pid, *roles: str) -> dict:
    m = _membership(conn, pid)
    if not m:
        raise HTTPException(404, "Tu n'es dans aucune guilde")
    if roles and m["role"] not in roles:
        raise HTTPException(403, "Action réservée au chef de guilde" if roles == ("chef",) else "Action réservée au chef et aux officiers")
    return m


def _system(conn, gid, text: str) -> None:
    conn.execute("INSERT INTO guild_messages (guild_id, sender, body) VALUES (%s, NULL, %s)", (gid, text))


def _guild_rows(conn, where: str = "true", params: tuple = ()) -> list[dict]:
    """Guildes avec effectif, points de la semaine, niveau et rang (classement par points de la semaine)."""
    return conn.execute(f"""
        WITH ws AS ({WEEK_STATS}),
        g AS (
            SELECT g.id, g.nom, g.description, g.recrutement, g.created_at,
                   (SELECT count(*) FROM guild_members m WHERE m.guild_id = g.id) AS membres,
                   coalesce((SELECT sum({POINTS_SQL}) FROM ws WHERE ws.guild_id = g.id), 0)::int AS points_semaine,
                   1 + (SELECT count(DISTINCT (semaine, objectif)) FROM guild_rewards r WHERE r.guild_id = g.id) AS niveau
            FROM guilds g)
        SELECT *, rank() OVER (ORDER BY points_semaine DESC, niveau DESC, created_at) AS rang FROM g
        WHERE {where} ORDER BY rang, nom""", params).fetchall()


def _objectives(conn, gid, members: int, pid) -> list[dict]:
    totals = conn.execute(f"SELECT coalesce(sum(boosters), 0)::int AS boosters, coalesce(sum(rares), 0)::int AS rares, "
                          f"coalesce(sum(victoires), 0)::int AS victoires FROM ({WEEK_STATS}) ws WHERE ws.guild_id = %s", (gid,)).fetchone()
    claimed = {r["objectif"] for r in conn.execute(
        f"SELECT objectif FROM guild_rewards WHERE guild_id = %s AND player_id = %s AND semaine = {WEEK}::date", (gid, pid)).fetchall()}
    n = max(members, 3)  # une petite guilde a quand même un vrai défi
    out = []
    for oid, (label, key, per, reward) in OBJECTIVES.items():
        target = per * n
        out.append({"id": oid, "nom": label.format(n=target), "valeur": min(totals[key], target), "cible": target,
                    "atteint": totals[key] >= target, "recompense": reward, "recuperee": oid in claimed})
    return out


def _guild_out(conn, gid, pid) -> dict:
    g = _guild_rows(conn)
    g = next(r for r in g if r["id"] == gid)
    members = conn.execute(f"""
        WITH ws AS ({WEEK_STATS})
        SELECT p.id, coalesce(p.pseudo, %s) AS pseudo, p.titre, m.role, m.joined_at AS depuis,
               p.last_seen > now() - {ONLINE} AS en_ligne, ({POINTS_SQL})::int AS points
        FROM guild_members m JOIN players p ON p.id = m.player_id JOIN ws ON ws.player_id = m.player_id
        WHERE m.guild_id = %s
        ORDER BY points DESC, array_position(ARRAY['chef', 'officier', 'membre'], m.role), m.joined_at""",
                           (DEFAULT_PSEUDO, gid)).fetchall()
    me = next(m for m in members if m["id"] == pid)
    return {**g, "mon_role": me["role"], "membres_liste": [{**m, "moi": m["id"] == pid} for m in members],
            "max_membres": MAX_MEMBERS, "objectifs": _objectives(conn, gid, g["membres"], pid),
            "fin_semaine": conn.execute(f"SELECT {WEEK} + interval '7 days' AS f").fetchone()["f"],
            "nb_guildes": conn.execute("SELECT count(*) AS n FROM guilds").fetchone()["n"]}


# ---------- Annuaire et adhésion ----------

@router.get("/api/guildes")
def list_guilds(q: str | None = None, player: dict = Depends(current_player)):
    with db.connection() as conn:
        if q and q.strip():
            return _guild_rows(conn, "nom ILIKE %s", (f"%{q.strip()}%",))[:50]
        return _guild_rows(conn)[:50]


class GuildIn(BaseModel):
    nom: str = Field(min_length=3, max_length=30)
    description: str = Field(default="", max_length=280)


@router.post("/api/guildes", status_code=201)
def create_guild(body: GuildIn, player: dict = Depends(current_player)):
    pid, nom = player["id"], " ".join(body.nom.split())
    if len(nom) < 3:
        raise HTTPException(422, "Nom trop court")
    with db.connection() as conn, conn.transaction():
        if _membership(conn, pid, lock=True):
            raise HTTPException(409, "Quitte d'abord ta guilde actuelle")
        if conn.execute("SELECT 1 FROM guilds WHERE lower(nom) = lower(%s)", (nom,)).fetchone():
            raise HTTPException(409, "Ce nom de guilde est déjà pris")
        gid = conn.execute("INSERT INTO guilds (nom, description) VALUES (%s, %s) RETURNING id", (nom, body.description.strip())).fetchone()["id"]
        conn.execute("INSERT INTO guild_members (player_id, guild_id, role) VALUES (%s, %s, 'chef')", (pid, gid))
        _system(conn, gid, "La guilde est fondée. Bienvenue !")
        return _guild_out(conn, gid, pid)


@router.post("/api/guildes/{guild_id}/rejoindre")
def join_guild(guild_id: int, player: dict = Depends(current_player)):
    pid = player["id"]
    with db.connection() as conn, conn.transaction():
        g = conn.execute("SELECT * FROM guilds WHERE id = %s FOR UPDATE", (guild_id,)).fetchone()
        if not g:
            raise HTTPException(404, "Guilde introuvable")
        if _membership(conn, pid, lock=True):
            raise HTTPException(409, "Quitte d'abord ta guilde actuelle")
        if not g["recrutement"]:
            raise HTTPException(403, "Cette guilde ne recrute pas en ce moment")
        if conn.execute("SELECT count(*) AS n FROM guild_members WHERE guild_id = %s", (guild_id,)).fetchone()["n"] >= MAX_MEMBERS:
            raise HTTPException(409, "Cette guilde est complète")
        conn.execute("INSERT INTO guild_members (player_id, guild_id) VALUES (%s, %s)", (pid, guild_id))
        name = conn.execute("SELECT coalesce(pseudo, %s) AS p FROM players WHERE id = %s", (DEFAULT_PSEUDO, pid)).fetchone()["p"]
        _system(conn, guild_id, f"{name} rejoint la guilde.")
        return _guild_out(conn, guild_id, pid)


@router.get("/api/me/guilde")
def my_guild(player: dict = Depends(current_player)):
    with db.connection() as conn:
        m = _membership(conn, player["id"])
        return {"guilde": _guild_out(conn, m["guild_id"], player["id"]) if m else None}


class GuildPatch(BaseModel):
    description: str | None = Field(default=None, max_length=280)
    recrutement: bool | None = None


@router.patch("/api/me/guilde")
def update_guild(body: GuildPatch, player: dict = Depends(current_player)):
    with db.connection() as conn, conn.transaction():
        m = _require(conn, player["id"], "chef")
        if body.description is not None:
            conn.execute("UPDATE guilds SET description = %s WHERE id = %s", (body.description.strip(), m["guild_id"]))
        if body.recrutement is not None:
            conn.execute("UPDATE guilds SET recrutement = %s WHERE id = %s", (body.recrutement, m["guild_id"]))
        return _guild_out(conn, m["guild_id"], player["id"])


@router.post("/api/me/guilde/quitter")
def leave_guild(player: dict = Depends(current_player)):
    """Le chef qui part passe la main à l'officier (ou au membre) le plus ancien ; la guilde vide disparaît."""
    with db.connection() as conn, conn.transaction():
        _require(conn, player["id"])
        leave_guild_conn(conn, player["id"])
    return {"guilde": None}


def leave_guild_conn(conn, pid) -> None:
    """Retire le joueur de sa guilde (s'il en a une). À appeler dans une transaction."""
    m = _membership(conn, pid)
    if not m:
        return
    gid = m["guild_id"]
    conn.execute("SELECT id FROM guilds WHERE id = %s FOR UPDATE", (gid,))
    conn.execute("DELETE FROM guild_members WHERE player_id = %s", (pid,))
    heir = conn.execute("""SELECT player_id FROM guild_members WHERE guild_id = %s
        ORDER BY array_position(ARRAY['chef', 'officier', 'membre'], role), joined_at LIMIT 1""", (gid,)).fetchone()
    if not heir:
        conn.execute("DELETE FROM guilds WHERE id = %s", (gid,))
        return
    name = conn.execute("SELECT coalesce(pseudo, %s) AS p FROM players WHERE id = %s", (DEFAULT_PSEUDO, pid)).fetchone()["p"]
    _system(conn, gid, f"{name} a quitté la guilde.")
    if m["role"] == "chef":
        conn.execute("UPDATE guild_members SET role = 'chef' WHERE player_id = %s", (heir["player_id"],))


class RoleIn(BaseModel):
    role: Literal["chef", "officier", "membre"]


@router.post("/api/me/guilde/membres/{player_id}/role")
def set_role(player_id: str, body: RoleIn, player: dict = Depends(current_player)):
    """Le chef nomme officiers et membres ; nommer un autre chef lui transmet la guilde."""
    pid, target = player["id"], parse_id(player_id)
    with db.connection() as conn, conn.transaction():
        m = _require(conn, pid, "chef")
        t = conn.execute("SELECT guild_id FROM guild_members WHERE player_id = %s", (target,)).fetchone()
        if not t or t["guild_id"] != m["guild_id"] or target == pid:
            raise HTTPException(404, "Membre introuvable")
        conn.execute("UPDATE guild_members SET role = %s WHERE player_id = %s", (body.role, target))
        if body.role == "chef":
            conn.execute("UPDATE guild_members SET role = 'officier' WHERE player_id = %s", (pid,))
        return _guild_out(conn, m["guild_id"], pid)


@router.delete("/api/me/guilde/membres/{player_id}")
def kick(player_id: str, player: dict = Depends(current_player)):
    pid, target = player["id"], parse_id(player_id)
    with db.connection() as conn, conn.transaction():
        m = _require(conn, pid, "chef", "officier")
        t = conn.execute("SELECT guild_id, role FROM guild_members WHERE player_id = %s", (target,)).fetchone()
        if not t or t["guild_id"] != m["guild_id"] or target == pid:
            raise HTTPException(404, "Membre introuvable")
        if m["role"] == "officier" and t["role"] != "membre":
            raise HTTPException(403, "Un officier ne peut exclure que des membres")
        conn.execute("DELETE FROM guild_members WHERE player_id = %s", (target,))
        name = conn.execute("SELECT coalesce(pseudo, %s) AS p FROM players WHERE id = %s", (DEFAULT_PSEUDO, target)).fetchone()["p"]
        _system(conn, m["guild_id"], f"{name} a été exclu de la guilde.")
        return _guild_out(conn, m["guild_id"], pid)


class InviteIn(BaseModel):
    ami: str


@router.post("/api/me/guilde/inviter")
def invite(body: InviteIn, player: dict = Depends(current_player)):
    """Invite un ami par message privé, avec un lien pour rejoindre."""
    pid, fid = player["id"], parse_id(body.ami)
    with db.connection() as conn:
        m = _require(conn, pid)
        if not are_friends(conn, pid, fid):
            raise HTTPException(403, "Tu ne peux inviter que tes amis")
        if _membership(conn, fid):
            raise HTTPException(409, "Ton ami fait déjà partie d'une guilde")
        if not allows(conn, fid, "invitations_guilde"):
            raise HTTPException(403, "Ton ami n'accepte pas les invitations de guilde")
        nom = conn.execute("SELECT nom FROM guilds WHERE id = %s", (m["guild_id"],)).fetchone()["nom"]
        conn.execute("INSERT INTO messages (sender, recipient, body) VALUES (%s, %s, %s)",
                     (pid, fid, f"Rejoins ma guilde « {nom} » ! Ouvre l'onglet Guilde : /jeu/guilde?rejoindre={m['guild_id']}"))
    return {"invite": True}


# ---------- Discussion ----------

@router.get("/api/me/guilde/messages")
def guild_messages(apres: int = 0, player: dict = Depends(current_player)):
    with db.connection() as conn:
        m = _require(conn, player["id"])
        return conn.execute("""
            SELECT * FROM (
                SELECT gm.id, gm.body AS texte, gm.created_at AS le, gm.sender AS auteur_id,
                       coalesce(p.pseudo, %s) AS auteur, gm.sender = %s AS de_moi, gm.sender IS NULL AS systeme
                FROM guild_messages gm LEFT JOIN players p ON p.id = gm.sender
                WHERE gm.guild_id = %s AND gm.id > %s ORDER BY gm.id DESC LIMIT 100) t ORDER BY id""",
                            (DEFAULT_PSEUDO, player["id"], m["guild_id"], apres)).fetchall()


class GuildMessageIn(BaseModel):
    texte: str = Field(min_length=1, max_length=500)


@router.post("/api/me/guilde/messages", status_code=201)
def post_guild_message(body: GuildMessageIn, player: dict = Depends(current_player)):
    text = body.texte.strip()
    if not text:
        raise HTTPException(422, "Message vide")
    with db.connection() as conn:
        m = _require(conn, player["id"])
        return conn.execute("""INSERT INTO guild_messages (guild_id, sender, body) VALUES (%s, %s, %s)
            RETURNING id, body AS texte, created_at AS le, sender AS auteur_id, true AS de_moi, false AS systeme""",
                            (m["guild_id"], player["id"], text)).fetchone()


# ---------- Objectifs ----------

@router.post("/api/me/guilde/objectifs/{objective}/recompense")
def claim_objective(objective: str, player: dict = Depends(current_player)):
    pid = player["id"]
    if objective not in OBJECTIVES:
        raise HTTPException(404, "Objectif inconnu")
    with db.connection() as conn, conn.transaction():
        m = _require(conn, pid)
        members = conn.execute("SELECT count(*) AS n FROM guild_members WHERE guild_id = %s", (m["guild_id"],)).fetchone()["n"]
        obj = next(o for o in _objectives(conn, m["guild_id"], members, pid) if o["id"] == objective)
        if not obj["atteint"]:
            raise HTTPException(409, "Objectif pas encore atteint")
        cur = conn.execute(f"""INSERT INTO guild_rewards (guild_id, player_id, semaine, objectif) VALUES (%s, %s, {WEEK}::date, %s)
                               ON CONFLICT DO NOTHING""", (m["guild_id"], pid, objective))
        if not cur.rowcount:
            raise HTTPException(409, "Récompense déjà récupérée")
        eclats = add_eclats(conn, pid, obj["recompense"])
    return {"gain": obj["recompense"], "eclats": eclats}
