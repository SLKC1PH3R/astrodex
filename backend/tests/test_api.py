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
    assert series[0]["code"] == "S1" and series[0]["nb_cartes"] == 39
    s1 = client.get("/api/series/S1").json()
    assert len(s1["cartes"]) == 39
    img = client.get(s1["cartes"][0]["image_url"])
    assert img.status_code == 200 and img.headers["content-type"] == "image/webp"


def test_themed_boosters_replace_series_boosters(client):
    boosters = {b["code"]: b for b in client.get("/api/boosters").json()}
    assert sorted(boosters) == ["S1A", "S1B", "S1C", "S2A", "S3A", "S3B", "S4A"]  # les S*-STD sont désactivés
    assert boosters["S1C"]["nom"] == "Océans Gelés" and boosters["S1C"]["serie"] == "S1"
    assert boosters["S4A"]["nb_cartes_contenu"] > 6000
    # une même carte peut être dans plusieurs boosters : la comète de Halley est dans trois
    for code in ("S1A", "S1C", "S2A"):
        slugs = {c["slug"] for c in client.get(f"/api/boosters/{code}/cartes").json()}
        assert "halley" in slugs
    s1a = client.get("/api/boosters/S1A/cartes").json()
    assert len(s1a) == boosters["S1A"]["nb_cartes_contenu"]
    assert {c["slug"] for c in s1a} >= {"soleil", "terre", "mars"} and "saturne" not in {c["slug"] for c in s1a}
    assert client.get("/api/boosters/S1-STD/cartes").status_code == 404


def test_player_opens_boosters_and_collection_grows(client):
    assert client.post("/api/boosters/S1B/open").status_code == 401
    p = client.post("/api/players", json={"pseudo": "testeur"}).json()
    h = {"Authorization": f"Bearer {p['token']}"}
    total = 0
    for code in ("S1A", "S1B", "S1C", "S2A", "S3A", "S3B", "S4A"):
        allowed = {c["id"] for c in client.get(f"/api/boosters/{code}/cartes").json()}
        for _ in range(3):
            r = client.post(f"/api/boosters/{code}/open", headers=h)
            assert r.status_code == 200
            cards = r.json()["cartes"]
            assert len(cards) == 5
            assert {c["id"] for c in cards} <= allowed  # chaque carte vient du contenu du booster
            total += 5
    me = client.get("/api/me", headers=h).json()
    assert me["boosters_ouverts"] == 21 and me["cartes_total"] == total
    prog = {b["code"]: b for b in client.get("/api/me/progression", headers=h).json()}
    assert sorted(prog) == ["S1A", "S1B", "S1C", "S2A", "S3A", "S3B", "S4A"]
    assert prog["S1C"]["total"] == 23 and 1 <= prog["S1C"]["possedees"] <= 23
    assert client.get("/api/me/progression").status_code == 401
    coll = client.get("/api/me/collection", headers=h).json()
    assert sum(c["quantite"] for c in coll) == total


def test_import_is_idempotent(client):
    from app import db
    from app.catalog_import import import_catalog, load_catalog
    with db.connection() as conn:
        import_catalog(conn, load_catalog())
        n = conn.execute("SELECT count(*) AS n FROM cards").fetchone()["n"]
        links = conn.execute("SELECT count(*) AS n FROM pack_cards").fetchone()["n"]
    assert n == 7776 and links == 7798
