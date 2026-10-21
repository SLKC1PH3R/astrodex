"""Bataille : une main de 5 cartes contre celle d'un autre joueur (ou d'un adversaire du jeu).

Chaque manche oppose une carte de chaque main. La plus rapide attaque en premier : si son Attaque
dépasse la Défense adverse, elle gagne la manche ; sinon l'autre carte riposte de la même façon.
Si aucune ne perce, la plus puissante l'emporte. Trois manches gagnées emportent la partie.
Un léger aléa (± 15 % sur l'Attaque) évite que la même main gagne toujours.
Les parties se jouent tout de suite contre la main enregistrée de l'adversaire : pas besoin qu'il soit connecté.
"""
from __future__ import annotations

import calendar
import json
import random
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from . import db
from .common import CARD_SELECT, card_out, current_player
from .social import DEFAULT_PSEUDO, are_friends, parse_id

router = APIRouter()
HAND = 5
WIN_ROUNDS = 3
SWING = 0.15
RANKED_WIN, RANKED_LOSS = 25, 15
RANKS = [(0, "Bronze"), (100, "Argent"), (250, "Or"), (500, "Platine"), (900, "Diamant"), (1400, "Nébuleuse")]
BOTS = ["Sentinelle d'Orion", "Veilleur de Véga", "Gardien d'Andromède", "Pilote de Cassiopée", "Éclaireur de Lyra",
        "Navigateur du Cygne", "Sentinelle de Persée", "Vigie de la Licorne"]


def rank_of(points: int) -> dict:
    i = max(k for k, (seuil, _) in enumerate(RANKS) if points >= seuil)
    nxt = RANKS[i + 1] if i + 1 < len(RANKS) else None
    return {"nom": RANKS[i][1], "points": points, "seuil": RANKS[i][0],
            "prochain": nxt[1] if nxt else None, "prochain_seuil": nxt[0] if nxt else None}


def season_end() -> datetime:
    """Une saison classée dure un mois civil."""
    now = datetime.now(timezone.utc)
    last = calendar.monthrange(now.year, now.month)[1]
    return now.replace(day=last, hour=23, minute=59, second=59, microsecond=0)


def _cards(conn, ids: list[int]) -> list[dict]:
    if not ids:
        return []
    by_id = {r["id"]: card_out(r) for r in conn.execute(CARD_SELECT + " WHERE c.id = ANY(%s)", (ids,)).fetchall()}
    return [by_id[i] for i in ids if i in by_id]


def _owned_hand(conn, player_id) -> list[int]:
    """Main enregistrée, limitée aux cartes que le joueur possède encore."""
    row = conn.execute("SELECT main_bataille FROM players WHERE id = %s", (player_id,)).fetchone()
    ids = list(row["main_bataille"] or []) if row else []
    if not ids:
        return []
    have = {r["card_id"] for r in conn.execute("SELECT card_id FROM player_cards WHERE player_id = %s AND card_id = ANY(%s)",
                                               (player_id, ids)).fetchall()}
    return [i for i in ids if i in have]


def simulate(mine: list[dict], theirs: list[dict], rng: random.Random) -> dict:
    """Joue les manches ; renvoie le détail de chacune et le score."""
    rounds, score = [], {"moi": 0, "eux": 0}
    for a, b in zip(mine, theirs):
        if WIN_ROUNDS in score.values():
            break
        side = {"moi": a, "eux": b}
        first = "moi" if (a["vitesse"], rng.random()) > (b["vitesse"], rng.random()) else "eux"
        second = "eux" if first == "moi" else "moi"
        winner, how, coups = None, "", []
        for att, dfd in ((first, second), (second, first)):
            power = round(side[att]["attaque"] * rng.uniform(1 - SWING, 1 + SWING))
            coups.append({"attaquant": att, "attaque": power, "defense": side[dfd]["defense"]})
            if power > side[dfd]["defense"]:
                winner, how = att, "perce la défense"
                break
        if not winner and a["puissance"] != b["puissance"]:
            winner, how = ("moi" if a["puissance"] > b["puissance"] else "eux"), "plus puissante"
        if winner:
            score[winner] += 1
        rounds.append({"moi": a["id"], "eux": b["id"], "premier": first, "coups": coups,
                       "gagnant": winner, "raison": how or "égalité"})
    return {"manches": rounds, "score": score}


def _opponent(conn, me, mode: str, friend: str | None, my_power: int, rng: random.Random) -> dict:
    if mode == "ami":
        if not friend:
            raise HTTPException(422, "Choisis l'ami à défier")
        oid = parse_id(friend)
        if not are_friends(conn, me, oid):
            raise HTTPException(403, "Tu ne peux défier que tes amis")
        hand = _owned_hand(conn, oid)
        if len(hand) < HAND:
            raise HTTPException(409, "Ton ami n'a pas encore composé sa main de 5 cartes")
        name = conn.execute("SELECT coalesce(pseudo, %s) AS p FROM players WHERE id = %s", (DEFAULT_PSEUDO, oid)).fetchone()["p"]
        return {"id": oid, "nom": name, "main": hand}
    # un joueur réel de niveau proche, sinon un adversaire du jeu
    candidates = conn.execute("""
        SELECT id, coalesce(pseudo, %s) AS nom, main_bataille, points_rang FROM players
        WHERE id <> %s AND cardinality(main_bataille) = %s ORDER BY abs(points_rang - (SELECT points_rang FROM players WHERE id = %s)), random()
        LIMIT 20""", (DEFAULT_PSEUDO, me, HAND, me)).fetchall()
    for c in candidates:
        hand = _owned_hand(conn, c["id"])
        if len(hand) == HAND:
            power = sum(x["puissance"] for x in _cards(conn, hand))
            if abs(power - my_power) <= my_power * 0.25:
                return {"id": c["id"], "nom": c["nom"], "main": hand}
    avg = my_power / HAND
    rows = conn.execute("""SELECT id FROM cards WHERE NOT retired AND attaque + defense + vitesse BETWEEN %s AND %s
                           ORDER BY random() LIMIT %s""", (avg * 0.85, avg * 1.1, HAND)).fetchall()
    if len(rows) < HAND:
        rows = conn.execute("SELECT id FROM cards WHERE NOT retired ORDER BY random() LIMIT %s", (HAND,)).fetchall()
    return {"id": None, "nom": rng.choice(BOTS), "main": [r["id"] for r in rows]}


def _history(conn, me, limit: int) -> list[dict]:
    return [{"id": r["id"], "adversaire": {"id": r["opponent_id"], "nom": r["opponent_name"]}, "mode": r["mode"],
             "victoire": r["won"], "score": [r["score_me"], r["score_them"]], "points": r["points_delta"], "le": r["created_at"]}
            for r in conn.execute("SELECT * FROM battles WHERE player_id = %s ORDER BY created_at DESC LIMIT %s", (me, limit)).fetchall()]


@router.get("/api/me/bataille")
def battle_home(player: dict = Depends(current_player)):
    me = player["id"]
    with db.connection() as conn:
        hand = _cards(conn, _owned_hand(conn, me))
        st = conn.execute("""SELECT count(*) FILTER (WHERE won) AS victoires, count(*) FILTER (WHERE NOT won AND score_me < score_them) AS defaites,
                                    count(*) AS parties FROM battles WHERE player_id = %s""", (me,)).fetchone()
        pts = conn.execute("SELECT points_rang FROM players WHERE id = %s", (me,)).fetchone()["points_rang"]
        return {"main": hand, "stats": st, "rang": rank_of(pts), "saison_fin": season_end(),
                "historique": _history(conn, me, 10), "taille_main": HAND, "manches_gagnantes": WIN_ROUNDS}


@router.get("/api/me/bataille/historique")
def battle_history(player: dict = Depends(current_player)):
    with db.connection() as conn:
        return _history(conn, player["id"], 50)


class HandIn(BaseModel):
    cartes: list[int] = Field(max_length=HAND)


@router.put("/api/me/bataille/main")
def save_hand(body: HandIn, player: dict = Depends(current_player)):
    ids = list(dict.fromkeys(body.cartes))
    with db.connection() as conn:
        have = {r["card_id"] for r in conn.execute("SELECT card_id FROM player_cards WHERE player_id = %s AND card_id = ANY(%s)",
                                                   (player["id"], ids)).fetchall()}
        if set(ids) - have:
            raise HTTPException(422, "Ta main ne peut contenir que des cartes de ta collection")
        conn.execute("UPDATE players SET main_bataille = %s WHERE id = %s", (ids, player["id"]))
        return {"main": _cards(conn, ids)}


class BattleIn(BaseModel):
    mode: Literal["rapide", "classee", "ami"] = "rapide"
    ami: str | None = None


@router.post("/api/me/bataille", status_code=201)
def play(body: BattleIn, player: dict = Depends(current_player)):
    me, rng = player["id"], random.Random()
    with db.connection() as conn, conn.transaction():
        hand = _cards(conn, _owned_hand(conn, me))
        if len(hand) < HAND:
            raise HTTPException(409, f"Compose d'abord une main de {HAND} cartes")
        opp = _opponent(conn, me, body.mode, body.ami, sum(c["puissance"] for c in hand), rng)
        theirs = _cards(conn, opp["main"])
        rng.shuffle(theirs)
        result = simulate(hand, theirs, rng)
        s = result["score"]
        won = s["moi"] > s["eux"]
        lost = s["moi"] < s["eux"]
        delta = 0
        if body.mode == "classee":
            pts = conn.execute("SELECT points_rang FROM players WHERE id = %s FOR UPDATE", (me,)).fetchone()["points_rang"]
            delta = RANKED_WIN if won else (-min(RANKED_LOSS, pts) if lost else 0)
            conn.execute("UPDATE players SET points_rang = points_rang + %s WHERE id = %s", (delta, me))
        bid = conn.execute("""INSERT INTO battles (player_id, opponent_id, opponent_name, mode, won, score_me, score_them, points_delta, manches)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb) RETURNING id""",
                           (me, opp["id"], opp["nom"], body.mode, won, s["moi"], s["eux"], delta,
                            json.dumps(result["manches"]))).fetchone()["id"]
        if body.mode == "ami":
            verdict = "gagné" if won else "perdu" if lost else "fait match nul"
            conn.execute("INSERT INTO messages (sender, recipient, body) VALUES (%s, %s, %s)",
                         (me, opp["id"], f"Défi de bataille : j'ai affronté ta main et j'ai {verdict} {s['moi']}–{s['eux']}. "
                                         "À ton tour, depuis l'onglet Bataille !"))
        pts = conn.execute("SELECT points_rang FROM players WHERE id = %s", (me,)).fetchone()["points_rang"]
    return {"id": bid, "mode": body.mode, "main": hand, "adversaire": {"id": opp["id"], "nom": opp["nom"], "main": theirs},
            **result, "victoire": won, "egalite": not won and not lost, "points": delta, "rang": rank_of(pts)}
