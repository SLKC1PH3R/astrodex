"""Progression du joueur : expérience (XP), niveaux 1 → 40, rangs, titres et emblèmes, réserve de boosters.

XP gagnée :
  - 10 par booster ouvert ;
  - à la découverte d'une carte (premier exemplaire) : C 5, PC 8, R 15, UR 40, L 100 ;
  - 100 par succès débloqué (versée une fois : players.succes_xp garde la liste) ;
  - 15 par bataille gagnée.
Réserve de boosters : 1 booster de plus toutes les 10 minutes, jusqu'à la capacité.
La capacité vaut 10, +1 tous les 4 niveaux, soit 20 au niveau 40.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import HTTPException

from .achievements import achievements_for

MAX_LEVEL = 40
XP_BOOSTER = 10
XP_NEW_CARD = {"C": 5, "PC": 8, "R": 15, "UR": 40, "L": 100}
XP_ACHIEVEMENT = 100
XP_BATTLE_WIN = 15
PACK_INTERVAL = 600  # secondes entre deux boosters
PACK_BASE_CAP, PACK_MAX_CAP = 10, 20


def xp_for_level(level: int) -> int:
    """XP totale pour atteindre un niveau : 100 au niveau 2, ~2 700 au 10, ~10 450 au 20, 41 400 au 40."""
    return 25 * (level - 1) * (level + 2)


def level_for(xp: int) -> int:
    lvl = 1
    while lvl < MAX_LEVEL and xp >= xp_for_level(lvl + 1):
        lvl += 1
    return lvl


def pack_cap(level: int) -> int:
    return min(PACK_MAX_CAP, PACK_BASE_CAP + level // 4)


# Rangs, alignés sur les ornements dessinés (frontend/public/ornements/niveau-<N>.webp) :
# (niveau de départ, nom, emblème, couleur, icône Phosphor de secours)
RANKS = [
    (1, "Poussière d'étoile", "poussiere", "#9aa1b9", "ph-sparkle"),
    (5, "Nuée stellaire", "nuee", "#5fd3c8", "ph-sparkle"),
    (10, "Comète", "comete", "#4f8dff", "ph-shooting-star"),
    (15, "Lune", "lune", "#b9a6ff", "ph-moon"),
    (20, "Vaisseau", "vaisseau", "#e8b45a", "ph-rocket"),
    (25, "Étoile", "etoile", "#ff8a3d", "ph-sun"),
    (30, "Spirale", "spirale", "#b06bff", "ph-spiral"),
    (35, "Nébuleuse", "nebuleuse", "#3fd6c6", "ph-cloud"),
    (40, "Légende", "legende", "#f0c95e", "ph-crown"),
]
# Titres exclusifs débloqués par niveau
LEVEL_TITLES = [
    (5, "Rêveur d'étoiles"), (10, "Chasseur de comètes"), (15, "Arpenteur lunaire"), (20, "Pilote interplanétaire"),
    (25, "Dompteur de soleils"), (30, "Voyageur interstellaire"), (35, "Architecte des nébuleuses"), (40, "Légende de la galaxie"),
]


def _emblem(rank) -> dict:
    return {"id": rank[2], "nom": rank[1], "couleur": rank[3], "icone": rank[4], "niveau": rank[0]}


def rank_for(level: int) -> dict:
    return _emblem([r for r in RANKS if level >= r[0]][-1])


def emblems(level: int) -> list[dict]:
    """Tous les emblèmes, avec ceux débloqués (un par rang atteint)."""
    return [{**_emblem(r), "debloque": level >= r[0]} for r in RANKS]


def level_titles(level: int) -> list[str]:
    return [t for lvl, t in LEVEL_TITLES if level >= lvl]


def summary(xp: int, embleme: str | None = None) -> dict:
    lvl = level_for(xp)
    start, nxt = xp_for_level(lvl), (xp_for_level(lvl + 1) if lvl < MAX_LEVEL else None)
    rank = rank_for(lvl)
    chosen = next((e for e in emblems(lvl) if e["id"] == embleme and e["debloque"]), rank)
    return {"xp": xp, "niveau": lvl, "niveau_max": MAX_LEVEL, "xp_niveau": start, "xp_suivant": nxt,
            "rang": rank, "embleme": {k: chosen[k] for k in ("id", "nom", "couleur", "icone", "niveau")},
            "reserve_max": pack_cap(lvl)}


def add_xp(conn, player_id, amount: int) -> None:
    if amount > 0:
        conn.execute("UPDATE players SET xp = xp + %s WHERE id = %s", (amount, player_id))


def sync_achievements(conn, player_id) -> int:
    """Verse l'XP des succès débloqués depuis le dernier passage ; renvoie l'XP versée."""
    from .profil import player_stats  # import tardif : profil importe ce module
    done = {a["id"] for a in achievements_for(player_stats(conn, player_id)) if a["debloque"]}
    row = conn.execute("SELECT succes_xp FROM players WHERE id = %s FOR UPDATE", (player_id,)).fetchone()
    new = done - set(row["succes_xp"] or [])
    if not new:
        return 0
    gain = XP_ACHIEVEMENT * len(new)
    conn.execute("UPDATE players SET xp = xp + %s, succes_xp = succes_xp || %s WHERE id = %s", (gain, sorted(new), player_id))
    return gain


# ---------- Réserve de boosters ----------

def _now() -> datetime:
    return datetime.now(timezone.utc)


def pack_state(conn, player_id, *, lock: bool = False) -> dict:
    """Réserve actuelle (recharge calculée à la volée) : stock, capacité, secondes avant le prochain booster."""
    row = conn.execute("SELECT xp, packs_stock, packs_at FROM players WHERE id = %s" + (" FOR UPDATE" if lock else ""),
                       (player_id,)).fetchone()
    cap = pack_cap(level_for(row["xp"]))
    stock, at = row["packs_stock"], row["packs_at"]
    if stock >= cap:
        return {"stock": stock, "max": cap, "prochain_dans": None, "_at": at, "_full": True}
    elapsed = max(0.0, (_now() - at).total_seconds())
    gained = int(elapsed // PACK_INTERVAL)
    stock = min(cap, stock + gained)
    if stock >= cap:
        return {"stock": stock, "max": cap, "prochain_dans": None, "_at": at, "_full": True}
    return {"stock": stock, "max": cap, "prochain_dans": int(PACK_INTERVAL - elapsed % PACK_INTERVAL),
            "_at": at, "_gained": gained, "_full": False}


def public_packs(state: dict) -> dict:
    return {k: v for k, v in state.items() if not k.startswith("_")}


def consume_pack(conn, player_id) -> dict:
    """Retire un booster de la réserve (409 si vide) ; renvoie la réserve après coup."""
    s = pack_state(conn, player_id, lock=True)
    if s["stock"] < 1:
        mins, secs = divmod(s["prochain_dans"] or 0, 60)
        raise HTTPException(429, f"Plus de booster en réserve : le prochain arrive dans {mins} min {secs:02d} s")
    # Réserve pleine : le compte à rebours démarre maintenant ; sinon on garde la progression en cours.
    at = _now() if s["_full"] else s["_at"] + timedelta(seconds=PACK_INTERVAL * s["_gained"])
    conn.execute("UPDATE players SET packs_stock = %s, packs_at = %s WHERE id = %s", (s["stock"] - 1, at, player_id))
    return public_packs(pack_state(conn, player_id))
