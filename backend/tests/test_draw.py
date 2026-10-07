import random
from collections import Counter

import pytest

from app.draw import draw_pack, pick_rarity

SLOTS = [{"C": .75, "PC": .25}] * 3 + [{"PC": .55, "R": .38, "UR": .07}, {"R": .72, "UR": .22, "L": .06}]
POOL = {"C": [1, 2, 3], "PC": [4, 5], "R": [6, 7], "UR": [8], "L": [9]}
RAR = {c: r for r, ids in POOL.items() for c in ids}


def test_pack_has_one_card_per_slot_and_respects_slot_rarities():
    rng = random.Random(1)
    for _ in range(500):
        pack = draw_pack(SLOTS, POOL, rng)
        assert len(pack) == 5
        for card, rates in zip(pack, SLOTS):
            assert RAR[card] in rates


def test_no_duplicate_when_pool_allows():
    rng = random.Random(2)
    for _ in range(500):
        pack = draw_pack(SLOTS[:3], {"C": [1, 2, 3], "PC": [4, 5, 6]}, rng)
        assert len(set(pack)) == 3


def test_rates_converge():
    rng = random.Random(3)
    n = 40000
    c = Counter(pick_rarity({"R": .72, "UR": .22, "L": .06}, rng) for _ in range(n))
    assert abs(c["L"] / n - .06) < .01
    assert abs(c["UR"] / n - .22) < .015


def test_missing_rarity_raises():
    with pytest.raises(ValueError):
        draw_pack([{"L": 1.0}], {"C": [1]})
