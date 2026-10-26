"""Niveaux, XP, emblèmes et réserve de boosters."""
import os
import uuid

import pytest

from app import progression as pg


def test_curve_and_caps():
    assert pg.level_for(0) == 1 and pg.level_for(99) == 1 and pg.level_for(100) == 2
    assert pg.level_for(pg.xp_for_level(40)) == 40 and pg.level_for(10 ** 9) == 40
    assert [pg.pack_cap(n) for n in (1, 3, 4, 20, 39, 40)] == [10, 10, 11, 15, 19, 20]
    assert pg.rank_for(1)["nom"] == "Poussière d'étoile" and pg.rank_for(40)["nom"] == "Galaxie"
    assert pg.rank_for(12)["nom"] == "Lune" and pg.level_titles(10) == ["Rêveur d'étoiles", "Chasseur de comètes"]
    s = pg.summary(150)
    assert s["niveau"] == 2 and s["xp_niveau"] == 100 and s["xp_suivant"] == pg.xp_for_level(3)
    assert pg.summary(150, "galaxie")["embleme"]["id"] == "poussiere"  # emblème verrouillé : on retombe sur celui du rang


psycopg = pytest.importorskip("psycopg")
try:
    psycopg.connect(os.environ.get("DATABASE_URL", ""), connect_timeout=2).close()
    DB = True
except Exception:  # noqa: BLE001
    DB = False


@pytest.fixture(scope="module")
def client():
    if not DB:
        pytest.skip("Postgres indisponible")
    from fastapi.testclient import TestClient
    from app.main import app
    with TestClient(app) as c:
        yield c


def test_reserve_and_xp(client):
    p = client.post("/api/players", json={"pseudo": f"T-{uuid.uuid4().hex[:6]}"}).json()
    h = {"Authorization": f"Bearer {p['token']}"}
    me = client.get("/api/me", headers=h).json()
    assert me["reserve"] == {"stock": 10, "max": 10, "prochain_dans": None} and me["progression"]["niveau"] == 1

    r = client.post("/api/boosters/S1A/open", headers=h).json()
    assert r["reserve"]["stock"] == 9 and 590 <= r["reserve"]["prochain_dans"] <= 600
    assert r["xp_gagne"] >= 10 + 5 and r["progression"]["xp"] == r["xp_gagne"]  # booster + cartes découvertes (+ succès)
    for _ in range(9):
        client.post("/api/boosters/S1A/open", headers=h)
    empty = client.post("/api/boosters/S1A/open", headers=h)
    assert empty.status_code == 429 and "prochain arrive" in empty.json()["detail"]

    # 25 minutes plus tard : 2 boosters rechargés, 5 minutes avant le 3e
    with psycopg.connect(os.environ["DATABASE_URL"], autocommit=True) as c:
        c.execute("UPDATE players SET packs_at = packs_at - interval '25 minutes' WHERE id = %s", (p["id"],))
    res = client.get("/api/me", headers=h).json()["reserve"]
    assert res["stock"] == 2 and 290 <= res["prochain_dans"] <= 300
    assert client.post("/api/boosters/S1A/open", headers=h).json()["reserve"]["stock"] == 1
    res = client.get("/api/me", headers=h).json()["reserve"]
    assert res["stock"] == 1 and 290 <= res["prochain_dans"] <= 300  # la progression de recharge est conservée

    prof = client.get("/api/me/profil", headers=h).json()
    assert prof["progression"]["xp"] >= 110 and prof["emblemes"][0]["debloque"] and not prof["emblemes"][-1]["debloque"]
    assert client.patch("/api/me/profil", headers=h, json={"embleme": "galaxie"}).status_code == 422
    assert client.patch("/api/me/profil", headers=h, json={"embleme": "poussiere"}).json()["progression"]["embleme"]["id"] == "poussiere"
    assert client.patch("/api/me/profil", headers=h, json={"titre": "Légende de la galaxie"}).status_code == 422
    rk = client.get("/api/classement?type=niveau", headers=h).json()
    assert rk["libelle"] == "XP" and rk["moi"]["progression"]["niveau"] >= 1

    # beaucoup d'XP : capacité de réserve et titres de niveau débloqués
    with psycopg.connect(os.environ["DATABASE_URL"], autocommit=True) as c:
        c.execute("UPDATE players SET xp = %s WHERE id = %s", (pg.xp_for_level(40), p["id"]))
    me = client.get("/api/me", headers=h).json()
    assert me["progression"]["niveau"] == 40 and me["reserve"]["max"] == 20
    assert client.patch("/api/me/profil", headers=h, json={"titre": "Légende de la galaxie", "embleme": "galaxie"}).status_code == 200
