"""Comptes e-mail, sessions multi-appareils et administration (Postgres requis)."""
import os
import uuid

import pytest

psycopg = pytest.importorskip("psycopg")
try:
    psycopg.connect(os.environ.get("DATABASE_URL", ""), connect_timeout=2).close()
except Exception:  # noqa: BLE001
    pytest.skip("Postgres indisponible", allow_module_level=True)

from fastapi.testclient import TestClient  # noqa: E402

from app import config  # noqa: E402
from app.auth import check_password, hash_password  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def H(token):
    return {"Authorization": f"Bearer {token}"}


def mail():
    return f"t-{uuid.uuid4().hex[:8]}@exemple.fr"


def test_hash():
    h = hash_password("motdepasse1")
    assert h.startswith("scrypt$") and check_password("motdepasse1", h) and not check_password("autre", h)
    assert not check_password("x", None) and not check_password("x", "abimé")


def test_signup_login_two_devices(client):
    email = mail()
    r = client.post("/api/auth/inscription", json={"pseudo": "Orion", "email": email.upper(), "mot_de_passe": "court"})
    assert r.status_code == 422
    a = client.post("/api/auth/inscription", json={"pseudo": "Orion", "email": email.upper(), "mot_de_passe": "orion-2026"}).json()
    assert a["email"] == email and not a["is_admin"]
    client.post("/api/boosters/S1A/open", headers=H(a["token"]))
    assert client.post("/api/auth/inscription", json={"pseudo": "Bis", "email": email, "mot_de_passe": "orion-2026"}).status_code == 409

    # « autre ordinateur » : connexion par e-mail = même compte, même collection, l'autre appareil reste connecté
    assert client.post("/api/auth/connexion", json={"email": email, "mot_de_passe": "faux-mdp"}).status_code == 401
    b = client.post("/api/auth/connexion", json={"email": f"  {email.upper()} ", "mot_de_passe": "orion-2026"}).json()
    assert b["id"] == a["id"] and b["token"] != a["token"]
    assert client.get("/api/me", headers=H(b["token"])).json()["cartes_uniques"] > 0
    assert client.get("/api/me", headers=H(a["token"])).status_code == 200
    assert len(client.get("/api/me/sessions", headers=H(b["token"])).json()) == 2

    # changer le mot de passe ferme les autres appareils ; se déconnecter ferme celui-ci
    assert client.post("/api/me/mot-de-passe", headers=H(b["token"]), json={"actuel": "x", "nouveau": "nouveau-2026"}).status_code == 403
    assert client.post("/api/me/mot-de-passe", headers=H(b["token"]), json={"actuel": "orion-2026", "nouveau": "nouveau-2026"}).json()["ok"]
    assert client.get("/api/me", headers=H(a["token"])).status_code == 401
    client.post("/api/auth/deconnexion", headers=H(b["token"]))
    assert client.get("/api/me", headers=H(b["token"])).status_code == 401
    assert client.post("/api/auth/connexion", json={"email": email, "mot_de_passe": "nouveau-2026"}).status_code == 200


def test_guest_keeps_collection_on_signup(client):
    g = client.post("/api/players", json={}).json()
    client.post("/api/boosters/S1A/open", headers=H(g["token"]))
    n = client.get("/api/me", headers=H(g["token"])).json()["cartes_uniques"]
    r = client.post("/api/auth/inscription", headers=H(g["token"]), json={"pseudo": "Lyra", "email": mail(), "mot_de_passe": "lyra-2026!"}).json()
    assert r["id"] == g["id"] and r["rattache"]
    assert client.get("/api/me", headers=H(r["token"])).json()["cartes_uniques"] == n


def test_admin(client, monkeypatch):
    boss = mail()
    monkeypatch.setattr(config, "ADMIN_EMAILS", {boss})
    adm = client.post("/api/auth/inscription", json={"pseudo": "Admin", "email": boss, "mot_de_passe": "admin-2026"}).json()
    assert adm["is_admin"]
    user = client.post("/api/auth/inscription", json={"pseudo": "Kepler", "email": mail(), "mot_de_passe": "kepler-2026"}).json()
    assert client.get("/api/admin/stats", headers=H(user["token"])).status_code == 403

    st = client.get("/api/admin/stats", headers=H(adm["token"])).json()
    assert st["comptes"] >= 2 and st["avec_email"] >= 2
    found = client.get(f"/api/admin/joueurs?q={user['email']}", headers=H(adm["token"])).json()
    assert found["total"] == 1 and found["joueurs"][0]["id"] == user["id"]

    assert client.post(f"/api/admin/joueurs/{user['id']}/mot-de-passe", headers=H(adm["token"]), json={"nouveau": "reset-2026"}).json()["ok"]
    assert client.get("/api/me", headers=H(user["token"])).status_code == 401
    assert client.post("/api/auth/connexion", json={"email": user["email"], "mot_de_passe": "reset-2026"}).status_code == 200

    assert client.delete(f"/api/admin/joueurs/{adm['id']}", headers=H(adm["token"])).status_code == 422
    assert client.delete(f"/api/admin/joueurs/{user['id']}", headers=H(adm["token"])).json()["supprime"] == 1
    assert client.post("/api/auth/connexion", json={"email": user["email"], "mot_de_passe": "reset-2026"}).status_code == 401

    ghost = client.post("/api/players", json={}).json()
    preview = client.post("/api/admin/purge-invites", headers=H(adm["token"]), json={"jours": 0}).json()
    assert preview["concernes"] >= 1 and preview["supprime"] == 0
    assert client.get("/api/me", headers=H(ghost["token"])).status_code == 200
    done = client.post("/api/admin/purge-invites", headers=H(adm["token"]), json={"jours": 0, "confirmer": True}).json()
    assert done["supprime"] >= 1
    assert client.get("/api/me", headers=H(ghost["token"])).status_code == 401
    assert client.get("/api/me", headers=H(adm["token"])).status_code == 200


def test_admin_inactive_filter_and_purge_accounts(client, monkeypatch):
    boss = mail()
    monkeypatch.setattr(config, "ADMIN_EMAILS", {boss})
    adm = client.post("/api/auth/inscription", json={"pseudo": "Admin2", "email": boss, "mot_de_passe": "admin-2026"}).json()
    old = client.post("/api/auth/inscription", json={"pseudo": "Ancien", "email": mail(), "mot_de_passe": "ancien-2026"}).json()
    import psycopg as pg
    with pg.connect(os.environ["DATABASE_URL"], autocommit=True) as c:
        c.execute("UPDATE players SET last_seen = now() - interval '40 days', created_at = now() - interval '60 days' WHERE id = %s", (old["id"],))
    ids = {j["id"] for j in client.get("/api/admin/joueurs?inactif=30&type=comptes", headers=H(adm["token"])).json()["joueurs"]}
    assert old["id"] in ids and adm["id"] not in ids
    only_guests = client.post("/api/admin/purge-invites", headers=H(adm["token"]), json={"jours": 30}).json()
    with_accounts = client.post("/api/admin/purge-invites", headers=H(adm["token"]), json={"jours": 30, "inclure_comptes": True}).json()
    assert with_accounts["concernes"] >= only_guests["concernes"] + 1
    client.post("/api/admin/purge-invites", headers=H(adm["token"]), json={"jours": 30, "inclure_comptes": True, "confirmer": True})
    assert client.post("/api/auth/connexion", json={"email": old["email"], "mot_de_passe": "ancien-2026"}).status_code == 401
    assert client.get("/api/me", headers=H(adm["token"])).status_code == 200
