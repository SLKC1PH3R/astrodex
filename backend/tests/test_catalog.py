from app.catalog_import import load_catalog


def test_repository_catalog_is_valid():
    cat = load_catalog()
    assert cat.series and cat.objets
    for s in cat.series:
        assert s.cartes
