"""API Astrodex : catalogue, joueurs, collections et ouverture de boosters côté serveur."""
from __future__ import annotations

import logging
import secrets
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from . import config, db
from .catalog_import import import_catalog, load_catalog
from .common import CARD_SELECT, card_out, current_player, hash_token
from .draw import draw_pack
from . import admin, auth, progression, battle, guild, market, profil, settings, social, trades

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
app.include_router(profil.router)
app.include_router(social.router)
app.include_router(trades.router)
app.include_router(market.router)
app.include_router(battle.router)
app.include_router(guild.router)
app.include_router(settings.router)
app.include_router(auth.router)
app.include_router(admin.router)
app.mount("/media", StaticFiles(directory=config.MEDIA_DIR, check_dir=False), name="media")

def boosters_out(conn, where: str = "", params: tuple = ()) -> list[dict]:
    rows = conn.execute(f"""
        SELECT p.id, p.code, p.nom, p.nb_cartes, p.image, p.description, s.code AS serie,
               ps.position, ps.rarete, ps.probabilite,
               (SELECT count(*) FROM pack_cards pc JOIN cards c ON c.id = pc.card_id
                 WHERE pc.pack_type_id = p.id AND NOT c.retired) AS contenu
        FROM pack_types p JOIN series s ON s.id = p.series_id JOIN pack_slots ps ON ps.pack_type_id = p.id
        WHERE p.active AND s.active {where}
        ORDER BY p.code, ps.position, ps.probabilite DESC""", params).fetchall()
    out: dict[str, dict] = {}
    for r in rows:
        b = out.setdefault(r["code"], {"code": r["code"], "nom": r["nom"], "serie": r["serie"], "nb_cartes": r["nb_cartes"],
                                       "description": r["description"], "nb_cartes_contenu": r["contenu"] or None,
                                       "image_url": f"/media/{r['image']}" if r["image"] else None, "emplacements": {}})
        b["emplacements"].setdefault(r["position"], {})[r["rarete"]] = float(r["probabilite"])
    for b in out.values():
        b["emplacements"] = [{"position": k, "taux": v} for k, v in sorted(b["emplacements"].items())]
    return list(out.values())


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


def _pack_pool_sql(pack_id: int) -> tuple[str, tuple]:
    """Cartes qu'un booster peut donner : son contenu (pack_cards) s'il en a un, sinon toute sa série."""
    return ("""(c.id IN (SELECT card_id FROM pack_cards WHERE pack_type_id = %(p)s)
               OR (NOT EXISTS (SELECT 1 FROM pack_cards WHERE pack_type_id = %(p)s)
                   AND c.series_id = (SELECT series_id FROM pack_types WHERE id = %(p)s)))""", {"p": pack_id})


@app.get("/api/boosters/{code}/cartes")
def booster_cards(code: str):
    """Contenu d'un booster : les cartes qu'il peut donner (une carte peut figurer dans plusieurs boosters)."""
    with db.connection() as conn:
        pack = conn.execute("""SELECT p.id FROM pack_types p JOIN series s ON s.id = p.series_id
                               WHERE p.code = %s AND p.active AND s.active""", (code,)).fetchone()
        if not pack:
            raise HTTPException(404, "Booster inconnu")
        where, params = _pack_pool_sql(pack["id"])
        rows = conn.execute(CARD_SELECT + f" WHERE NOT c.retired AND {where} ORDER BY s.code, c.numero",
                            params).fetchall()
        return [card_out(r) for r in rows]


class PlayerIn(BaseModel):
    pseudo: str | None = Field(default=None, max_length=32)


@app.post("/api/players", status_code=201)
def create_player(body: PlayerIn | None = None):
    token = secrets.token_urlsafe(32)
    with db.connection() as conn:
        row = conn.execute("INSERT INTO players (token_hash, pseudo) VALUES (%s, %s) RETURNING id, pseudo, created_at",
                           (hash_token(token), body.pseudo if body else None)).fetchone()
    return {**row, "token": token}


@app.get("/api/me")
def me(player: dict = Depends(current_player)):
    with db.connection() as conn:
        st = conn.execute("""
            SELECT (SELECT count(*) FROM pack_openings WHERE player_id = %(p)s) AS boosters_ouverts,
                   (SELECT count(*) FROM player_cards WHERE player_id = %(p)s) AS cartes_uniques,
                   (SELECT coalesce(sum(quantite), 0) FROM player_cards WHERE player_id = %(p)s) AS cartes_total,
                   (SELECT count(*) FROM cards WHERE NOT retired) AS catalogue""", {"p": player["id"]}).fetchone()
        progression.sync_achievements(conn, player["id"])
        row = conn.execute("SELECT xp, embleme, avatar FROM players WHERE id = %s", (player["id"],)).fetchone()
        packs = progression.public_packs(progression.pack_state(conn, player["id"]))
    return {**player, **st, "boosters_restants": packs["stock"], "reserve": packs,
            "progression": progression.summary(row["xp"], row["embleme"]), "avatar": row["avatar"]}


@app.get("/api/me/progression")
def booster_progress(player: dict = Depends(current_player)):
    """Pour chaque booster à thème actif : cartes de son contenu déjà possédées / taille du contenu."""
    with db.connection() as conn:
        return conn.execute("""
            SELECT p.code, count(own.card_id) AS possedees, count(*) AS total
            FROM pack_types p JOIN series s ON s.id = p.series_id
            JOIN pack_cards pc ON pc.pack_type_id = p.id
            JOIN cards c ON c.id = pc.card_id AND NOT c.retired
            LEFT JOIN player_cards own ON own.card_id = pc.card_id AND own.player_id = %s
            WHERE p.active AND s.active
            GROUP BY p.code ORDER BY p.code""", (player["id"],)).fetchall()


@app.get("/api/me/collection")
def collection(serie: str | None = None, player: dict = Depends(current_player)):
    with db.connection() as conn:
        rows = conn.execute(CARD_SELECT.replace("SELECT c.id,", "SELECT pc.quantite, pc.first_obtained_at, c.id,")
                            + " JOIN player_cards pc ON pc.card_id = c.id AND pc.player_id = %s"
                            + (" WHERE s.code = %s" if serie else "")
                            + " ORDER BY s.code, c.numero",
                            (player["id"], serie) if serie else (player["id"],)).fetchall()
    return [{**card_out(r), "quantite": r["quantite"], "obtenue_le": r["first_obtained_at"]} for r in rows]


@app.post("/api/boosters/{code}/open")
def open_booster(code: str, player: dict = Depends(current_player)):
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
        where, params = _pack_pool_sql(pack["id"])
        for r in conn.execute(f"SELECT c.id, c.rarete FROM cards c WHERE NOT c.retired AND {where}", params).fetchall():
            pool.setdefault(r["rarete"], []).append(r["id"])

        ids = draw_pack([slots[k] for k in sorted(slots)], pool)
        packs = progression.consume_pack(conn, player["id"])  # 429 si la réserve est vide
        xp_before = conn.execute("SELECT xp FROM players WHERE id = %s", (player["id"],)).fetchone()["xp"]

        owned = {r["card_id"] for r in conn.execute("SELECT card_id FROM player_cards WHERE player_id = %s AND card_id = ANY(%s)",
                                                    (player["id"], ids)).fetchall()}
        opening = conn.execute("INSERT INTO pack_openings (player_id, pack_type_id, card_ids) VALUES (%s, %s, %s) RETURNING id, opened_at",
                               (player["id"], pack["id"], ids)).fetchone()
        for cid in ids:
            conn.execute("""INSERT INTO player_cards (player_id, card_id) VALUES (%s, %s)
                            ON CONFLICT (player_id, card_id) DO UPDATE SET quantite = player_cards.quantite + 1""", (player["id"], cid))
        rows = {r["id"]: r for r in conn.execute(CARD_SELECT + " WHERE c.id = ANY(%s)", (ids,)).fetchall()}
        discovered = {cid for cid in ids if cid not in owned}
        gain = progression.XP_BOOSTER + sum(progression.XP_NEW_CARD[rows[cid]["rarete"]] for cid in discovered)
        progression.add_xp(conn, player["id"], gain)
        gain += progression.sync_achievements(conn, player["id"])
        prog = progression.summary(xp_before + gain)
        packs = progression.public_packs(progression.pack_state(conn, player["id"]))  # la capacité peut avoir augmenté

    seen = set()
    cartes = []
    for cid in ids:  # ordre des emplacements conservé : la meilleure carte en dernier
        cartes.append({**card_out(rows[cid]), "nouvelle": cid not in owned and cid not in seen})
        seen.add(cid)
    return {"ouverture_id": opening["id"], "ouvert_le": opening["opened_at"], "cartes": cartes,
            "boosters_restants": packs["stock"], "reserve": packs,
            "xp_gagne": gain, "niveau_avant": progression.level_for(xp_before), "progression": prog}
