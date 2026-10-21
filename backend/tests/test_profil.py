"""Profil, succès et classement, contre un vrai Postgres (ignorés si la base est injoignable)."""
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


def new_player(client, pseudo=None, boosters=0):
    p = client.post("/api/players", json={"pseudo": pseudo} if pseudo else {}).json()
    h = {"Authorization": f"Bearer {p['token']}"}
    for _ in range(boosters):
        assert client.post("/api/boosters/S1C/open", headers=h).status_code == 200
    return p, h


def test_profile_stats_and_edits(client):
    p, h = new_player(client, "Testeur", boosters=2)
    prof = client.get("/api/me/profil", headers=h).json()
    assert prof["pseudo"] == "Testeur" and prof["stats"]["boosters_ouverts"] == 2
    assert 1 <= prof["stats"]["cartes_uniques"] <= 10
    assert [s["code"] for s in prof["series"]][:1] == ["S1"] and prof["series"][0]["total"] == 39
    assert "Explorateur" in prof["titres_disponibles"]

    owned = [c["id"] for c in client.get("/api/me/collection", headers=h).json()][:3]
    r = client.patch("/api/me/profil", headers=h, json={"pseudo": "  Nouvel   Astre ", "titre": "Explorateur", "favoris": owned})
    assert r.status_code == 200
    prof = r.json()
    assert prof["pseudo"] == "Nouvel Astre" and prof["titre"] == "Explorateur"
    assert [c["id"] for c in prof["favoris"]] == owned

    # titre pas encore débloqué, carte non possédée : refusés
    assert client.patch("/api/me/profil", headers=h, json={"titre": "Archiviste du NGC"}).status_code == 422
    not_owned = next(c["id"] for c in client.get("/api/series/S4").json()["cartes"] if c["id"] not in owned)
    assert client.patch("/api/me/profil", headers=h, json={"favoris": [not_owned]}).status_code == 422
    assert client.patch("/api/me/profil", headers=h, json={"favoris": list(range(6))}).status_code == 422

    pub = client.get(f"/api/joueurs/{p['id']}/profil").json()
    assert pub["pseudo"] == "Nouvel Astre" and "titres_disponibles" not in pub
    assert client.get("/api/joueurs/pas-un-id/profil").status_code == 404


def test_achievements(client):
    _, h = new_player(client, boosters=1)
    s = client.get("/api/me/succes", headers=h).json()
    by_id = {a["id"]: a for a in s["succes"]}
    assert by_id["boosters_1"]["debloque"] and not by_id["boosters_10"]["debloque"]
    assert by_id["boosters_10"]["valeur"] == 1 and by_id["boosters_10"]["cible"] == 10
    assert by_id["serie_S1"]["cible"] == 39 and s["debloques"] >= 1 and s["total"] == len(s["succes"])


def test_ranking(client):
    _, h_big = new_player(client, "Gros collectionneur", boosters=6)
    _, h_new = new_player(client, "Débutant")
    r = client.get("/api/classement", headers=h_big).json()
    assert r["type"] == "collection" and r["moi"]["pseudo"] == "Gros collectionneur"
    ranks = [j["rang"] for j in r["joueurs"]]
    assert ranks == sorted(ranks)
    assert client.get("/api/classement", headers=h_new).json()["moi"] is None  # aucune carte : pas classé
    week = client.get("/api/classement?type=semaine", headers=h_big).json()
    assert week["moi"]["valeur"] >= 1
    assert client.get("/api/classement?type=inconnu", headers=h_big).status_code == 422
