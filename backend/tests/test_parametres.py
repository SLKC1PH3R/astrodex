"""Paramètres : confidentialité, clé de connexion, suppression du compte (Postgres requis)."""
import os
import uuid

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


def new_player(client, packs=0):
    p = client.post("/api/players", json={"pseudo": f"T-{uuid.uuid4().hex[:8]}"}).json()
    h = {"Authorization": f"Bearer {p['token']}"}
    for _ in range(packs):
        client.post("/api/boosters/S1C/open", headers=h)
    return p, h


def test_privacy(client):
    a, ha = new_player(client, packs=2)
    b, hb = new_player(client, packs=2)
    s = client.get("/api/me/parametres", headers=ha).json()
    assert s["code_ami"].startswith("ASTRO-") and all(x["actif"] for x in s["confidentialite"])
    assert client.patch("/api/me/parametres", headers=ha, json={"inconnu": True}).status_code == 422

    client.patch("/api/me/parametres", headers=ha, json={"demandes_amis": False, "profil_public": False})
    assert client.post("/api/me/amis", headers=hb, json={"cible": a["pseudo"]}).status_code == 403
    assert client.get(f"/api/joueurs/{a['id']}/profil", headers=hb).status_code == 403
    assert client.get(f"/api/joueurs/{a['id']}/profil", headers=ha).status_code == 200  # soi-même : toujours visible
    # a peut toujours demander b en ami ; une fois amis, son profil redevient visible pour b
    client.post("/api/me/amis", headers=ha, json={"cible": b["pseudo"]})
    client.post(f"/api/me/amis/{a['id']}/accepter", headers=hb)
    assert client.get(f"/api/joueurs/{a['id']}/profil", headers=hb).status_code == 200

    client.patch("/api/me/parametres", headers=ha, json={"defis": False})
    for h in (ha, hb):
        client.put("/api/me/bataille/main", headers=h, json={"cartes": [c["id"] for c in client.get("/api/me/collection", headers=h).json()[:5]]})
    assert client.post("/api/me/bataille", headers=hb, json={"mode": "ami", "ami": a["id"]}).status_code == 403


def test_key_rotation_and_delete(client):
    a, ha = new_player(client, packs=1)
    new = client.post("/api/me/cle", headers=ha).json()["token"]
    assert client.get("/api/me", headers=ha).status_code == 401  # l'ancienne clé ne marche plus
    h2 = {"Authorization": f"Bearer {new}"}
    assert client.get("/api/me", headers=h2).json()["id"] == a["id"]

    g = client.post("/api/guildes", headers=h2, json={"nom": f"Solo {uuid.uuid4().hex[:6]}"}).json()
    assert client.request("DELETE", "/api/me", headers=h2, json={"confirmation": "mauvais"}).status_code == 422
    assert client.request("DELETE", "/api/me", headers=h2, json={"confirmation": a["pseudo"].upper()}).json()["supprime"]
    assert client.get("/api/me", headers=h2).status_code == 401
    assert all(x["id"] != g["id"] for x in client.get("/api/guildes", headers=new_player(client)[1]).json())  # guilde dissoute
