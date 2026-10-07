"""Tests de bout en bout contre un vrai Postgres (DATABASE_URL). Ignorés si la base est injoignable."""
import os

import pytest

psycopg = pytest.importorskip("psycopg")

try:
    psycopg.connect(os.environ.get("DATABASE_URL", ""), connect_timeout=2).close()
except Exception:  # noqa: BLE001
    pytest.skip("Postgres indisponible", allow_module_level=True)

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def test_catalog_endpoints(client):
    assert client.get("/api/health").json() == {"status": "ok"}
    series = client.get("/api/series").json()
    assert series[0]["code"] == "S1" and series[0]["nb_cartes"] == 47
    s1 = client.get("/api/series/S1").json()
    assert len(s1["cartes"]) == 47 and s1["boosters"][0]["code"] == "S1-STD"
    img = client.get(s1["cartes"][0]["image_url"])
    assert img.status_code == 200 and img.headers["content-type"] == "image/webp"


def test_player_opens_boosters_and_collection_grows(client):
    assert client.post("/api/boosters/S1-STD/open").status_code == 401
    p = client.post("/api/players", json={"pseudo": "testeur"}).json()
    h = {"Authorization": f"Bearer {p['token']}"}
    total = 0
    for _ in range(4):
        r = client.post("/api/boosters/S1-STD/open", headers=h)
        assert r.status_code == 200
        cards = r.json()["cartes"]
        assert len(cards) == 5
        assert cards[4]["rarete"] in ("R", "UR", "L")
        total += 5
    me = client.get("/api/me", headers=h).json()
    assert me["boosters_ouverts"] == 4 and me["cartes_total"] == total
    coll = client.get("/api/me/collection", headers=h).json()
    assert sum(c["quantite"] for c in coll) == total


def test_import_is_idempotent(client):
    from app import db
    from app.catalog_import import import_catalog, load_catalog
    with db.connection() as conn:
        import_catalog(conn, load_catalog())
        n = conn.execute("SELECT count(*) AS n FROM cards").fetchone()["n"]
    assert n == 47
