"""Succès : définis ici, calculés à la volée à partir des statistiques du joueur (aucune table).

Chaque succès lit une statistique (clé de player_stats) et se débloque quand elle atteint la cible.
Un succès peut offrir un titre, que le joueur affiche ensuite sur son profil.
"""
from __future__ import annotations

# (id, catégorie, nom, description, statistique, cible, titre offert ou None)
ACHIEVEMENTS: list[tuple[str, str, str, str, str, int, str | None]] = [
    ("boosters_1", "Boosters", "Premier contact", "Ouvrir ton premier booster.", "boosters_ouverts", 1, "Explorateur"),
    ("boosters_10", "Boosters", "Habitué du ciel", "Ouvrir 10 boosters.", "boosters_ouverts", 10, None),
    ("boosters_50", "Boosters", "Collectionneur assidu", "Ouvrir 50 boosters.", "boosters_ouverts", 50, "Collectionneur assidu"),
    ("boosters_200", "Boosters", "Insatiable", "Ouvrir 200 boosters.", "boosters_ouverts", 200, "Insatiable"),
    ("collection_25", "Collection", "Petit observatoire", "Posséder 25 cartes différentes.", "cartes_uniques", 25, "Astronome amateur"),
    ("collection_100", "Collection", "Grand télescope", "Posséder 100 cartes différentes.", "cartes_uniques", 100, "Astronome"),
    ("collection_500", "Collection", "Cartographe du ciel", "Posséder 500 cartes différentes.", "cartes_uniques", 500, "Cartographe du ciel"),
    ("ultra_10", "Collection", "Chasseur d'Ultra rares", "Obtenir 10 cartes Ultra rares différentes.", "ultra_rares", 10, "Chasseur d'Ultra rares"),
    ("legende_1", "Collection", "Première légende", "Obtenir une carte Légendaire.", "legendaires", 1, "Porte-bonheur"),
    ("legende_5", "Collection", "Panthéon", "Obtenir 5 cartes Légendaires différentes.", "legendaires", 5, "Gardien du Panthéon"),
    ("amis_1", "Social", "Signal reçu", "Avoir un premier ami.", "amis", 1, None),
    ("amis_5", "Social", "Équipage au complet", "Avoir 5 amis.", "amis", 5, "Capitaine d'équipage"),
    ("echange_1", "Échanges", "Premier troc", "Réussir un premier échange avec un ami.", "echanges", 1, None),
    ("echanges_10", "Échanges", "Bon commerçant", "Réussir 10 échanges.", "echanges", 10, "Bon commerçant"),
    ("vente_1", "Échanges", "Étal ouvert", "Vendre une carte au marché.", "ventes", 1, None),
    ("ventes_20", "Échanges", "Marchand des étoiles", "Vendre 20 cartes au marché.", "ventes", 20, "Marchand des étoiles"),
    ("bataille_1", "Bataille", "Baptême du feu", "Gagner une première bataille.", "victoires", 1, None),
    ("batailles_25", "Bataille", "Stratège", "Gagner 25 batailles.", "victoires", 25, "Stratège"),
    ("classees_10", "Bataille", "Compétiteur", "Gagner 10 batailles classées.", "victoires_classees", 10, "Compétiteur"),
    ("guilde_1", "Social", "Esprit d'équipe", "Rejoindre ou fonder une guilde.", "guilde", 1, None),
    ("serie_S1", "Séries", "Maître du Système solaire", "Compléter la série I · Système solaire.", "serie_S1", 0, "Maître du Système solaire"),
    ("serie_S2", "Séries", "Ceinture d'astéroïdes", "Compléter la série II · Astéroïdes.", "serie_S2", 0, "Mineur d'astéroïdes"),
    ("serie_S3", "Séries", "Pouponnière d'étoiles", "Compléter la série III · Nébuleuses.", "serie_S3", 0, "Seigneur des nébuleuses"),
    ("serie_S4", "Séries", "Catalogue complet", "Compléter la série IV · Catalogue NGC.", "serie_S4", 0, "Archiviste du NGC"),
]


def achievements_for(stats: dict) -> list[dict]:
    """Liste des succès avec la progression du joueur. Une cible 0 = « toute la série » (taille lue dans stats)."""
    out = []
    for aid, cat, nom, desc, key, target, titre in ACHIEVEMENTS:
        if key.startswith("serie_"):
            serie = stats["series"].get(key[6:])
            if not serie:
                continue
            value, target = serie["possedees"], serie["total"]
        else:
            if key not in stats:
                continue
            value = stats[key]
        out.append({"id": aid, "categorie": cat, "nom": nom, "description": desc, "valeur": min(value, target),
                    "cible": target, "debloque": target > 0 and value >= target, "titre": titre})
    return out


def unlocked_titles(stats: dict) -> list[str]:
    return [a["titre"] for a in achievements_for(stats) if a["debloque"] and a["titre"]]
