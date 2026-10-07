"""Tirage des cartes d'un booster. Fonction pure : facile à tester et à auditer."""
from __future__ import annotations

import random
import secrets
from collections.abc import Mapping, Sequence

_rng = secrets.SystemRandom()  # aléa cryptographique : le tirage n'est pas prévisible


def pick_rarity(rates: Mapping[str, float], rng: random.Random = _rng) -> str:
    x, acc, last = rng.random(), 0.0, None
    for rarity, p in rates.items():
        acc += float(p)
        last = rarity
        if x < acc:
            return rarity
    return last  # arrondis : la dernière rareté absorbe le reste


def draw_pack(slots: Sequence[Mapping[str, float]], pool: Mapping[str, Sequence[int]],
              rng: random.Random = _rng) -> list[int]:
    """slots : taux par emplacement (dans l'ordre) ; pool : ids de cartes disponibles par rareté.
    Évite les doublons dans un même booster tant que la rareté le permet."""
    chosen: list[int] = []
    for rates in slots:
        rarity = pick_rarity(rates, rng)
        cards = pool.get(rarity) or []
        if not cards:
            raise ValueError(f"aucune carte disponible pour la rareté {rarity}")
        fresh = [c for c in cards if c not in chosen]
        chosen.append(rng.choice(fresh or list(cards)))
    return chosen
