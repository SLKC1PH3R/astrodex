"""Amis et messages, contre un vrai Postgres (ignorés si la base est injoignable)."""
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


def new_player(client, pseudo):
    p = client.post("/api/players", json={"pseudo": pseudo}).json()
    return p, {"Authorization": f"Bearer {p['token']}"}


def test_friend_requests_by_code_and_pseudo(client):
    a, ha = new_player(client, f"Ana-{uuid.uuid4().hex[:6]}")
    b, hb = new_player(client, f"Bob-{uuid.uuid4().hex[:6]}")
    code_b = client.get("/api/me/amis", headers=hb).json()["code"]
    assert code_b.startswith("ASTRO-") and len(code_b) == 12

    assert client.post("/api/me/amis", headers=ha, json={"cible": code_b.lower()}).json()["statut"] == "demande_envoyee"
    assert client.post("/api/me/amis", headers=ha, json={"cible": code_b}).status_code == 409   # déjà envoyée
    assert client.post("/api/me/amis", headers=ha, json={"cible": a["pseudo"]}).status_code == 422  # soi-même
    assert client.post("/api/me/amis", headers=ha, json={"cible": "personne-zzz"}).status_code == 404

    lb = client.get("/api/me/amis", headers=hb).json()
    assert [r["pseudo"] for r in lb["recues"]] == [a["pseudo"]] and lb["amis"] == []
    assert client.get("/api/me/notifications", headers=hb).json()["amis"] == 1
    assert client.post(f"/api/me/amis/{a['id']}/accepter", headers=hb).json()["statut"] == "amis"
    la = client.get("/api/me/amis", headers=ha).json()
    assert [r["id"] for r in la["amis"]] == [b["id"]] and la["amis"][0]["en_ligne"] is True
    assert client.post("/api/me/amis", headers=hb, json={"cible": a["pseudo"]}).status_code == 409  # déjà amis

    # demande croisée : si l'autre a déjà demandé, ajouter accepte directement
    c, hc = new_player(client, f"Cid-{uuid.uuid4().hex[:6]}")
    client.post("/api/me/amis", headers=hc, json={"cible": a["pseudo"]})
    assert client.post("/api/me/amis", headers=ha, json={"cible": c["pseudo"]}).json()["statut"] == "amis"
    assert client.delete(f"/api/me/amis/{c['id']}", headers=ha).status_code == 204
    assert all(r["id"] != c["id"] for r in client.get("/api/me/amis", headers=ha).json()["amis"])
    assert client.delete(f"/api/me/amis/{c['id']}", headers=ha).status_code == 404

    succes = {s["id"]: s for s in client.get("/api/me/succes", headers=ha).json()["succes"]}
    assert succes["amis_1"]["debloque"]


def test_messages_between_friends(client):
    a, ha = new_player(client, f"Mia-{uuid.uuid4().hex[:6]}")
    b, hb = new_player(client, f"Léo-{uuid.uuid4().hex[:6]}")
    assert client.post(f"/api/me/messages/{b['id']}", headers=ha, json={"texte": "salut"}).status_code == 403  # pas amis
    client.post("/api/me/amis", headers=ha, json={"cible": b["pseudo"]})
    client.post(f"/api/me/amis/{a['id']}/accepter", headers=hb)

    assert client.post(f"/api/me/messages/{b['id']}", headers=ha, json={"texte": "  Salut Léo  "}).json()["texte"] == "Salut Léo"
    client.post(f"/api/me/messages/{b['id']}", headers=ha, json={"texte": "Tu as Titan ?"})
    assert client.post(f"/api/me/messages/{b['id']}", headers=ha, json={"texte": "   "}).status_code == 422

    conv = client.get("/api/me/messages", headers=hb).json()
    assert conv[0]["id"] == a["id"] and conv[0]["non_lus"] == 2 and conv[0]["dernier"] == "Tu as Titan ?"
    assert client.get("/api/me/notifications", headers=hb).json()["messages"] == 2
    th = client.get(f"/api/me/messages/{a['id']}", headers=hb).json()
    assert [m["texte"] for m in th["messages"]] == ["Salut Léo", "Tu as Titan ?"] and not th["messages"][0]["de_moi"]
    assert client.get("/api/me/notifications", headers=hb).json()["messages"] == 0  # lus à l'ouverture
    assert client.get("/api/me/messages/pas-un-id", headers=hb).status_code == 404
