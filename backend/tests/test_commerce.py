"""Échanges et marché, contre un vrai Postgres (ignorés si la base est injoignable)."""
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


def befriend(client, a, ha, b, hb):
    client.post("/api/me/amis", headers=ha, json={"cible": b["pseudo"]})
    client.post(f"/api/me/amis/{a['id']}/accepter", headers=hb)


def qty(client, h, card_id):
    return next((c["quantite"] for c in client.get("/api/me/collection", headers=h).json() if c["id"] == card_id), 0)


def test_trade_flow(client):
    a, ha = new_player(client, packs=3)
    b, hb = new_player(client, packs=3)
    give = client.get("/api/me/collection", headers=ha).json()[0]["id"]
    want = client.get("/api/me/collection", headers=hb).json()[0]["id"]

    body = {"avec": b["id"], "donne": [give], "demande": [want]}
    assert client.post("/api/me/echanges", headers=ha, json=body).status_code == 403  # pas encore amis
    befriend(client, a, ha, b, hb)
    assert client.post("/api/me/echanges", headers=ha, json={**body, "demande": []}).status_code == 422
    assert client.post("/api/me/echanges", headers=ha, json={**body, "donne": [give] * 99}).status_code == 422

    fc = client.get(f"/api/joueurs/{b['id']}/collection", headers=ha).json()
    assert any(c["id"] == want for c in fc) and all("manque" in c for c in fc)

    tid = client.post("/api/me/echanges", headers=ha, json=body).json()["id"]
    assert client.get("/api/me/notifications", headers=hb).json()["echanges"] == 1
    recus = client.get("/api/me/echanges", headers=hb).json()["recus"]
    assert recus[0]["id"] == tid and recus[0]["je_recois"][0]["id"] == give and recus[0]["je_donne"][0]["id"] == want
    assert "Proposition d'échange" in client.get(f"/api/me/messages/{a['id']}", headers=hb).json()["messages"][-1]["texte"]

    before = (qty(client, ha, give), qty(client, ha, want), qty(client, hb, give), qty(client, hb, want))
    assert client.post(f"/api/me/echanges/{tid}/accepter", headers=ha).status_code == 404  # seul le destinataire accepte
    assert client.post(f"/api/me/echanges/{tid}/accepter", headers=hb).json()["statut"] == "accepted"
    after = (qty(client, ha, give), qty(client, ha, want), qty(client, hb, give), qty(client, hb, want))
    if give != want:
        assert after == (before[0] - 1, before[1] + 1, before[2] + 1, before[3] - 1)
    assert client.post(f"/api/me/echanges/{tid}/refuser", headers=hb).status_code == 409  # déjà clos
    assert client.get("/api/me/echanges", headers=ha).json()["historique"][0]["statut"] == "accepted"
    assert {s["id"]: s for s in client.get("/api/me/succes", headers=ha).json()["succes"]}["echange_1"]["debloque"]

    # annulation par celui qui propose ; une carte cédée entre-temps fait échouer l'acceptation
    t2 = client.post("/api/me/echanges", headers=ha, json={"avec": b["id"], "donne": [want], "demande": [give]}).json()["id"]
    assert client.delete(f"/api/me/echanges/{t2}", headers=ha).json()["statut"] == "cancelled"


def test_market_flow(client):
    s, hs = new_player(client, packs=4)
    buyer, hb = new_player(client)
    w = client.post("/api/me/eclats/recompense", headers=hb).json()
    assert w["eclats"] == 100 and not w["recompense_dispo"]
    assert client.post("/api/me/eclats/recompense", headers=hb).status_code == 409

    card = client.get("/api/me/collection", headers=hs).json()[0]
    n0 = card["quantite"]
    lid = client.post("/api/marche", headers=hs, json={"carte": card["id"], "prix": 60}).json()["id"]
    assert qty(client, hs, card["id"]) == n0 - 1  # la carte est en dépôt
    assert all(l["id"] != lid for l in client.get("/api/marche", headers=hs).json()["annonces"])  # pas ses propres annonces
    lots = client.get(f"/api/marche?q={card['nom'][:3]}&tri=prix", headers=hb).json()["annonces"]
    assert any(l["id"] == lid for l in lots)

    assert client.post(f"/api/marche/{lid}/acheter", headers=hs).status_code == 422
    r = client.post(f"/api/marche/{lid}/acheter", headers=hb).json()
    assert r["carte"]["id"] == card["id"] and r["eclats"] == 40
    assert client.get("/api/me/eclats", headers=hs).json()["eclats"] == 57  # 60 moins 5 % de commission
    assert client.post(f"/api/marche/{lid}/acheter", headers=hb).status_code == 404  # déjà vendue
    assert client.get("/api/me/marche", headers=hs).json()[0]["statut"] == "sold"

    # annuler une annonce rend la carte ; acheter sans assez d'éclats est refusé
    other = client.get("/api/me/collection", headers=hs).json()[0]
    lid2 = client.post("/api/marche", headers=hs, json={"carte": other["id"], "prix": 5000}).json()["id"]
    assert client.post(f"/api/marche/{lid2}/acheter", headers=hb).status_code == 402
    q = qty(client, hs, other["id"])
    assert client.delete(f"/api/marche/{lid2}", headers=hs).status_code == 200
    assert qty(client, hs, other["id"]) == q + 1


def test_recycle_keeps_last_copy(client):
    p, h = new_player(client, packs=8)
    coll = client.get("/api/me/collection", headers=h).json()
    single = next((c for c in coll if c["quantite"] == 1), None)
    if single:
        assert client.post("/api/me/eclats/recycler", headers=h, json={"carte": single["id"]}).status_code == 409
    double = next((c for c in coll if c["quantite"] >= 2), None)
    if double:
        r = client.post("/api/me/eclats/recycler", headers=h, json={"carte": double["id"], "quantite": double["quantite"] - 1}).json()
        assert r["gain"] > 0 and r["eclats"] == r["gain"]
        assert qty(client, h, double["id"]) == 1
