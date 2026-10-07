"""API Astrodex : catalogue, joueurs, collections et ouverture de boosters côté serveur."""
from __future__ import annotations

import hashlib
import logging
import secrets
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from . import config, db
from .catalog_import import import_catalog, load_catalog
from .draw import draw_pack

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
log = logging.getLogger("astrodex")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    with db.connection() as conn:
        db.migrate(conn)
        if config.IMPORT_CATALOG_ON_START:
            log.info("catalogue importé : %s", import_catalog(conn, load_catalog()))
    yield
    db.close_pool()


app = FastAPI(title="Astrodex API", version="1.0.0", lifespan=lifespan)
if config.CORS_ORIGINS:
    app.add_middleware(CORSMiddleware, allow_origins=config.CORS_ORIGINS, allow_methods=["*"], allow_headers=["*"])
app.mount("/media", StaticFiles(directory=config.MEDIA_DIR, check_dir=False), name="media")

CARD_SELECT = """
    SELECT c.id, c.numero, c.rarete, c.attaque, c.defense, c.vitesse, c.image, c.credit, c.licence, c.variante, c.cadrage,
           o.slug, o.nom, o.type, o.constellation, o.description, o.faits,
           s.code AS serie, (SELECT count(*) FROM cards x WHERE x.series_id = c.series_id AND NOT x.retired) AS total
    FROM cards c JOIN celestial_objects o ON o.id = c.object_id JOIN series s ON s.id = c.series_id
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


def boosters_out(conn, where: str = "", params: tuple = ()) -> list[dict]:
    rows = conn.execute(f"""
        SELECT p.id, p.code, p.nom, p.nb_cartes, p.image, s.code AS serie, ps.position, ps.rarete, ps.probabilite
        FROM pack_types p JOIN series s ON s.id = p.series_id JOIN pack_slots ps ON ps.pack_type_id = p.id
        WHERE p.active AND s.active {where}
        ORDER BY p.code, ps.position, ps.probabilite DESC""", params).fetchall()
    out: dict[str, dict] = {}
    for r in rows:
        b = out.setdefault(r["code"], {"code": r["code"], "nom": r["nom"], "serie": r["serie"], "nb_cartes": r["nb_cartes"],
                                       "image_url": f"/media/{r['image']}" if r["image"] else None, "emplacements": {}})
        b["emplacements"].setdefault(r["position"], {})[r["rarete"]] = float(r["probabilite"])
    for b in out.values():
        b["emplacements"] = [{"position": k, "taux": v} for k, v in sorted(b["emplacements"].items())]
    return list(out.values())


# ---------- Authentification légère par jeton ----------
# Un joueur reçoit un jeton aléatoire à sa création ; seul son SHA-256 est stocké.
# À remplacer plus tard par Authentik / NextAuth : il suffira de faire correspondre l'identité à players.id.

def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def current_player(authorization: str | None = Header(default=None)) -> dict:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Jeton manquant : créez un joueur avec POST /api/players")
    with db.connection() as conn:
        row = conn.execute("SELECT id, pseudo, created_at FROM players WHERE token_hash = %s",
                           (_hash(authorization[7:].strip()),)).fetchone()
    if not row:
        raise HTTPException(401, "Jeton inconnu")
    return row


# ---------- Routes ----------

@app.get("/api/health")
def health():
    with db.connection() as conn:
        conn.execute("SELECT 1")
    return {"status": "ok"}


@app.get("/api/series")
def list_series():
    with db.connection() as conn:
        return conn.execute("""
            SELECT s.code, s.nom, s.description, s.date_sortie,
                   count(c.id) FILTER (WHERE NOT c.retired) AS nb_cartes
            FROM series s LEFT JOIN cards c ON c.series_id = s.id
            WHERE s.active GROUP BY s.id ORDER BY s.date_sortie NULLS LAST, s.code""").fetchall()


@app.get("/api/series/{code}")
def get_series(code: str):
    with db.connection() as conn:
        s = conn.execute("SELECT code, nom, description, date_sortie FROM series WHERE code = %s AND active", (code,)).fetchone()
        if not s:
            raise HTTPException(404, "Série inconnue")
        cards = conn.execute(CARD_SELECT + " WHERE s.code = %s AND NOT c.retired ORDER BY c.numero", (code,)).fetchall()
        return {**s, "cartes": [card_out(r) for r in cards], "boosters": boosters_out(conn, "AND s.code = %s", (code,))}


@app.get("/api/boosters")
def list_boosters():
    with db.connection() as conn:
        return boosters_out(conn)


class PlayerIn(BaseModel):
    pseudo: str | None = Field(default=None, max_length=32)


@app.post("/api/players", status_code=201)
def create_player(body: PlayerIn | None = None):
    token = secrets.token_urlsafe(32)
    with db.connection() as conn:
        row = conn.execute("INSERT INTO players (token_hash, pseudo) VALUES (%s, %s) RETURNING id, pseudo, created_at",
                           (_hash(token), body.pseudo if body else None)).fetchone()
    return {**row, "token": token}


@app.get("/api/me")
def me(player: dict = Depends(current_player)):
    with db.connection() as conn:
        st = conn.execute("""
            SELECT (SELECT count(*) FROM pack_openings WHERE player_id = %(p)s) AS boosters_ouverts,
                   (SELECT count(*) FROM player_cards WHERE player_id = %(p)s) AS cartes_uniques,
                   (SELECT coalesce(sum(quantite), 0) FROM player_cards WHERE player_id = %(p)s) AS cartes_total,
                   (SELECT count(*) FROM cards WHERE NOT retired) AS catalogue""", {"p": player["id"]}).fetchone()
    return {**player, **st, "boosters_restants": _remaining(player["id"])}


@app.get("/api/me/collection")
def collection(serie: str | None = None, player: dict = Depends(current_player)):
    with db.connection() as conn:
        rows = conn.execute(CARD_SELECT.replace("SELECT c.id,", "SELECT pc.quantite, pc.first_obtained_at, c.id,")
                            + " JOIN player_cards pc ON pc.card_id = c.id AND pc.player_id = %s"
                            + (" WHERE s.code = %s" if serie else "")
                            + " ORDER BY s.code, c.numero",
                            (player["id"], serie) if serie else (player["id"],)).fetchall()
    return [{**card_out(r), "quantite": r["quantite"], "obtenue_le": r["first_obtained_at"]} for r in rows]


def _remaining(player_id) -> int | None:
    if config.PACKS_PER_DAY <= 0:
        return None
    with db.connection() as conn:
        n = conn.execute("SELECT count(*) AS n FROM pack_openings WHERE player_id = %s AND opened_at > now() - interval '24 hours'",
                         (player_id,)).fetchone()["n"]
    return max(0, config.PACKS_PER_DAY - n)


@app.post("/api/boosters/{code}/open")
def open_booster(code: str, player: dict = Depends(current_player)):
    remaining = _remaining(player["id"])
    if remaining == 0:
        raise HTTPException(429, f"Limite de {config.PACKS_PER_DAY} boosters par 24 h atteinte")
    with db.connection() as conn, conn.transaction():
        pack = conn.execute("""SELECT p.id, p.series_id FROM pack_types p JOIN series s ON s.id = p.series_id
                               WHERE p.code = %s AND p.active AND s.active""", (code,)).fetchone()
        if not pack:
            raise HTTPException(404, "Booster inconnu")
        slot_rows = conn.execute("SELECT position, rarete, probabilite FROM pack_slots WHERE pack_type_id = %s ORDER BY position, probabilite DESC",
                                 (pack["id"],)).fetchall()
        slots: dict[int, dict] = {}
        for r in slot_rows:
            slots.setdefault(r["position"], {})[r["rarete"]] = float(r["probabilite"])
        pool: dict[str, list[int]] = {}
        for r in conn.execute("SELECT id, rarete FROM cards WHERE series_id = %s AND NOT retired", (pack["series_id"],)).fetchall():
            pool.setdefault(r["rarete"], []).append(r["id"])

        ids = draw_pack([slots[k] for k in sorted(slots)], pool)

        owned = {r["card_id"] for r in conn.execute("SELECT card_id FROM player_cards WHERE player_id = %s AND card_id = ANY(%s)",
                                                    (player["id"], ids)).fetchall()}
        opening = conn.execute("INSERT INTO pack_openings (player_id, pack_type_id, card_ids) VALUES (%s, %s, %s) RETURNING id, opened_at",
                               (player["id"], pack["id"], ids)).fetchone()
        for cid in ids:
            conn.execute("""INSERT INTO player_cards (player_id, card_id) VALUES (%s, %s)
                            ON CONFLICT (player_id, card_id) DO UPDATE SET quantite = player_cards.quantite + 1""", (player["id"], cid))
        rows = {r["id"]: r for r in conn.execute(CARD_SELECT + " WHERE c.id = ANY(%s)", (ids,)).fetchall()}

    seen = set()
    cartes = []
    for cid in ids:  # ordre des emplacements conservé : la meilleure carte en dernier
        cartes.append({**card_out(rows[cid]), "nouvelle": cid not in owned and cid not in seen})
        seen.add(cid)
    return {"ouverture_id": opening["id"], "ouvert_le": opening["opened_at"], "cartes": cartes,
            "boosters_restants": None if remaining is None else remaining - 1}
