"""Guildes et batailles, contre un vrai Postgres (ignorés si la base est injoignable)."""
import os
import random
import uuid

import pytest

psycopg = pytest.importorskip("psycopg")
try:
    psycopg.connect(os.environ.get("DATABASE_URL", ""), connect_timeout=2).close()
except Exception:  # noqa: BLE001
    pytest.skip("Postgres indisponible", allow_module_level=True)

from fastapi.testclient import TestClient  # noqa: E402

from app.battle import rank_of, simulate  # noqa: E402
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


def card(i, a, d, v):
    return {"id": i, "attaque": a, "defense": d, "vitesse": v, "puissance": a + d + v}


def test_simulate_rules():
    strong = [card(i, 95, 95, 90) for i in range(5)]
    weak = [card(10 + i, 20, 20, 10) for i in range(5)]
    r = simulate(strong, weak, random.Random(1))
    assert r["score"] == {"moi": 3, "eux": 0} and len(r["manches"]) == 3  # trois manches suffisent
    assert all(m["premier"] == "moi" for m in r["manches"])  # la plus rapide attaque en premier
    wall = [card(20 + i, 10, 99, 50) for i in range(5)]
    r = simulate(wall, [card(30 + i, 10, 99, 40) for i in range(5)], random.Random(2))
    assert all(m["raison"] == "plus puissante" for m in r["manches"])  # personne ne perce : la plus puissante gagne
    assert rank_of(0)["nom"] == "Bronze" and rank_of(260)["nom"] == "Or" and rank_of(5000)["prochain"] is None


def test_battle_flow(client):
    a, ha = new_player(client, packs=4)
    b, hb = new_player(client, packs=4)
    assert client.post("/api/me/bataille", headers=ha, json={"mode": "rapide"}).status_code == 409  # pas de main
    ids = [c["id"] for c in client.get("/api/me/collection", headers=ha).json()[:5]]
    assert client.put("/api/me/bataille/main", headers=ha, json={"cartes": [999999]}).status_code == 422
    assert len(client.put("/api/me/bataille/main", headers=ha, json={"cartes": ids}).json()["main"]) == 5

    r = client.post("/api/me/bataille", headers=ha, json={"mode": "classee"}).json()
    assert len(r["adversaire"]["main"]) == 5 and max(r["score"].values()) <= 3 and r["manches"]
    assert r["points"] == (25 if r["victoire"] else 0)  # 0 point au départ : une défaite ne fait pas descendre sous 0
    home = client.get("/api/me/bataille", headers=ha).json()
    assert home["stats"]["parties"] == 1 and home["rang"]["points"] == r["rang"]["points"] and len(home["historique"]) == 1

    # défi d'un ami : il faut être amis et que l'ami ait une main
    body = {"mode": "ami", "ami": b["id"]}
    assert client.post("/api/me/bataille", headers=ha, json=body).status_code == 403
    client.post("/api/me/amis", headers=ha, json={"cible": b["pseudo"]})
    client.post(f"/api/me/amis/{a['id']}/accepter", headers=hb)
    assert client.post("/api/me/bataille", headers=ha, json=body).status_code == 409
    client.put("/api/me/bataille/main", headers=hb, json={"cartes": [c["id"] for c in client.get("/api/me/collection", headers=hb).json()[:5]]})
    r = client.post("/api/me/bataille", headers=ha, json=body).json()
    assert r["adversaire"]["nom"] == b["pseudo"] and r["points"] == 0
    assert "Défi de bataille" in client.get(f"/api/me/messages/{a['id']}", headers=hb).json()["messages"][-1]["texte"]
    rk = client.get("/api/classement?type=bataille", headers=ha).json()
    assert rk["moi"] and rk["libelle"] == "points de rang"


def test_guild_flow(client):
    a, ha = new_player(client, packs=2)
    b, hb = new_player(client)
    c, hc = new_player(client)
    assert client.get("/api/me/guilde", headers=ha).json()["guilde"] is None
    name = f"Guilde {uuid.uuid4().hex[:6]}"
    g = client.post("/api/guildes", headers=ha, json={"nom": name, "description": "Test"}).json()
    assert g["mon_role"] == "chef" and g["membres"] == 1 and len(g["objectifs"]) == 3
    assert g["objectifs"][0]["valeur"] == 2  # les boosters de la semaine comptent
    assert client.post("/api/guildes", headers=hb, json={"nom": name.upper()}).status_code == 409  # nom déjà pris
    assert client.post("/api/guildes", headers=ha, json={"nom": "Autre guilde"}).status_code == 409  # déjà dans une guilde

    assert any(x["id"] == g["id"] for x in client.get(f"/api/guildes?q={name[-6:]}", headers=hb).json())
    assert client.post(f"/api/guildes/{g['id']}/rejoindre", headers=hb).json()["membres"] == 2
    client.patch("/api/me/guilde", headers=ha, json={"recrutement": False})
    assert client.post(f"/api/guildes/{g['id']}/rejoindre", headers=hc).status_code == 403
    assert client.patch("/api/me/guilde", headers=hb, json={"recrutement": True}).status_code == 403  # réservé au chef

    client.post("/api/me/guilde/messages", headers=hb, json={"texte": "Salut l'équipe"})
    msgs = client.get("/api/me/guilde/messages", headers=ha).json()
    assert msgs[-1]["texte"] == "Salut l'équipe" and any(m["systeme"] for m in msgs)
    assert client.get(f"/api/me/guilde/messages?apres={msgs[-1]['id']}", headers=ha).json() == []

    assert client.post("/api/me/guilde/objectifs/boosters/recompense", headers=ha).status_code == 409  # pas atteint
    g = client.post(f"/api/me/guilde/membres/{b['id']}/role", headers=ha, json={"role": "officier"}).json()
    assert {m["id"]: m["role"] for m in g["membres_liste"]}[b["id"]] == "officier"
    # le chef part : l'officier devient chef ; le dernier qui part dissout la guilde
    client.post("/api/me/guilde/quitter", headers=ha)
    assert client.get("/api/me/guilde", headers=hb).json()["guilde"]["mon_role"] == "chef"
    client.post("/api/me/guilde/quitter", headers=hb)
    assert all(x["id"] != g["id"] for x in client.get("/api/guildes", headers=hc).json())
    assert {s["id"]: s for s in client.get("/api/me/succes", headers=ha).json()["succes"]}["guilde_1"]["debloque"] is False
