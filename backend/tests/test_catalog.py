import random

import pytest

from app.catalog_import import load_catalog, themed_pools
from app.draw import draw_pack


def test_repository_catalog_is_valid():
    cat = load_catalog()
    assert cat.series and cat.objets
    for s in cat.series:
        assert s.cartes


def test_every_card_is_in_at_least_one_themed_booster():
    cat = load_catalog()
    pools = themed_pools(cat)
    covered = {(s, n) for pool in pools.values() for s, n, _ in pool}
    assert covered == {(sf.serie.code, c.numero) for sf in cat.series for c in sf.cartes}
    # une même carte peut être dans plusieurs boosters
    halley = [code for code, pool in pools.items() if any((s, n) == ("S1", 39) for s, n, _ in pool)]
    assert sorted(halley) == ["S1A", "S1C", "S2A"]


def test_each_themed_booster_can_always_be_drawn():
    cat = load_catalog()
    pools = themed_pools(cat)
    rng = random.Random(7)
    for b in cat.boosters:
        by_rarity = {}
        for s, n, r in pools[b.code]:
            by_rarity.setdefault(r, []).append((s, n))
        slots = [s.taux for s in sorted(b.emplacements, key=lambda s: s.position)]
        for _ in range(200):
            pack = draw_pack(slots, by_rarity, rng)
            assert len(pack) == b.nb_cartes


def test_orphan_cards_are_reported(tmp_path):
    import shutil
    from app import config
    shutil.copytree(config.CATALOG_DIR / "series", tmp_path / "series")
    shutil.copy(config.CATALOG_DIR / "objects.yaml", tmp_path / "objects.yaml")
    text = (config.CATALOG_DIR / "boosters.yaml").read_text(encoding="utf-8")
    (tmp_path / "boosters.yaml").write_text(text.replace("types: [Galaxie, ", "types: ["), encoding="utf-8")
    with pytest.raises(ValueError, match=r"carte\(s\) dans aucun booster à thème"):
        load_catalog(tmp_path, config.MEDIA_DIR)
