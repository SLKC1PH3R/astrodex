#!/usr/bin/env python3
"""
Astrodex — construction du catalogue de cartes (≈ 50 000 objets célestes).

Sources (toutes libres) :
  - Système solaire : données intégrées au script (faits publics)
  - Étoiles : HYG Database v4.1 (CC BY-SA 4.0) — github.com/astronexus/HYG-Database
  - Ciel profond : OpenNGC (CC BY-SA 4.0) — github.com/mattiaverga/OpenNGC
  - Exoplanètes : NASA Exoplanet Archive (domaine public)
  - Astéroïdes/comètes : NASA JPL Small-Body Database (domaine public)

Usage :
  python build_catalog.py                 # 50 000 cartes dans ./out
  python build_catalog.py --total 20000   # autre taille
  python build_catalog.py --offline       # n'utilise que le cache ./cache

Si une source NASA est injoignable, le script complète automatiquement avec des étoiles.
Dépendances : Python 3.9+, bibliothèque standard uniquement.
"""
from __future__ import annotations

import argparse
import bisect
import csv
import io
import json
import math
import random
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path

# --------------------------------------------------------------------------- #
# Configuration
# --------------------------------------------------------------------------- #

RARITIES = [  # (code, libellé, part du catalogue, bonus de stats)
    ("L", "Légendaire", 0.005, 15),
    ("UR", "Ultra rare", 0.020, 10),
    ("R", "Rare", 0.075, 6),
    ("PC", "Peu commune", 0.200, 3),
    ("C", "Commune", 0.700, 0),
]

# Part visée de chaque catégorie (les étoiles comblent le reste)
TARGET_SHARE = {"exoplanete": 0.125, "petit_corps": 0.18}

# Poids de catégorie dans le score de notoriété global
CATEGORY_WEIGHT = {
    "systeme_solaire": 1.00,
    "ciel_profond": 0.80,
    "exoplanete": 0.72,
    "etoile": 0.70,
    "petit_corps": 0.55,
}

URLS = {
    "hyg": "https://raw.githubusercontent.com/astronexus/HYG-Database/main/hyg/CURRENT/hygdata_v41.csv",
    "ngc": "https://raw.githubusercontent.com/mattiaverga/OpenNGC/master/database_files/NGC.csv",
    "ngc_add": "https://raw.githubusercontent.com/mattiaverga/OpenNGC/master/database_files/addendum.csv",
    "exo": "https://exoplanetarchive.ipac.caltech.edu/TAP/sync?" + urllib.parse.urlencode({
        "query": "select pl_name,hostname,sy_dist,pl_rade,pl_bmasse,pl_orbper,pl_eqt,"
                 "disc_year,discoverymethod,sy_pnum from pscomppars",
        "format": "csv",
    }),
    "sb_ast": "https://ssd-api.jpl.nasa.gov/sbdb_query.api?" + urllib.parse.urlencode({
        "fields": "spkid,full_name,name,diameter,albedo,per_y,class,kind",
        "sb-kind": "a", "sb-ns": "n",
        "sb-cdata": json.dumps({"AND": ["name|DF"]}),
    }),
    "sb_com": "https://ssd-api.jpl.nasa.gov/sbdb_query.api?" + urllib.parse.urlencode({
        "fields": "spkid,full_name,name,diameter,albedo,per_y,class,kind,prefix",
        "sb-kind": "c",
    }),
}

LICENSES = {
    "systeme_solaire": ("Données publiques NASA/IAU", "Domaine public"),
    "etoile": ("HYG Database v4.1", "CC BY-SA 4.0"),
    "ciel_profond": ("OpenNGC", "CC BY-SA 4.0"),
    "exoplanete": ("NASA Exoplanet Archive", "Domaine public"),
    "petit_corps": ("NASA JPL Small-Body Database", "Domaine public"),
}

CONSTELLATIONS = {
    "And": "Andromède", "Ant": "Machine pneumatique", "Aps": "Oiseau de paradis", "Aqr": "Verseau",
    "Aql": "Aigle", "Ara": "Autel", "Ari": "Bélier", "Aur": "Cocher", "Boo": "Bouvier", "Cae": "Burin",
    "Cam": "Girafe", "Cnc": "Cancer", "CVn": "Chiens de chasse", "CMa": "Grand Chien", "CMi": "Petit Chien",
    "Cap": "Capricorne", "Car": "Carène", "Cas": "Cassiopée", "Cen": "Centaure", "Cep": "Céphée",
    "Cet": "Baleine", "Cha": "Caméléon", "Cir": "Compas", "Col": "Colombe", "Com": "Chevelure de Bérénice",
    "CrA": "Couronne australe", "CrB": "Couronne boréale", "Crv": "Corbeau", "Crt": "Coupe", "Cru": "Croix du Sud",
    "Cyg": "Cygne", "Del": "Dauphin", "Dor": "Dorade", "Dra": "Dragon", "Equ": "Petit Cheval", "Eri": "Éridan",
    "For": "Fourneau", "Gem": "Gémeaux", "Gru": "Grue", "Her": "Hercule", "Hor": "Horloge", "Hya": "Hydre",
    "Hyi": "Hydre mâle", "Ind": "Indien", "Lac": "Lézard", "Leo": "Lion", "LMi": "Petit Lion", "Lep": "Lièvre",
    "Lib": "Balance", "Lup": "Loup", "Lyn": "Lynx", "Lyr": "Lyre", "Men": "Table", "Mic": "Microscope",
    "Mon": "Licorne", "Mus": "Mouche", "Nor": "Règle", "Oct": "Octant", "Oph": "Ophiuchus", "Ori": "Orion",
    "Pav": "Paon", "Peg": "Pégase", "Per": "Persée", "Phe": "Phénix", "Pic": "Peintre", "Psc": "Poissons",
    "PsA": "Poisson austral", "Pup": "Poupe", "Pyx": "Boussole", "Ret": "Réticule", "Sge": "Flèche",
    "Sgr": "Sagittaire", "Sco": "Scorpion", "Scl": "Sculpteur", "Sct": "Écu de Sobieski", "Ser": "Serpent",
    "Se1": "Serpent", "Se2": "Serpent", "Sex": "Sextant", "Tau": "Taureau", "Tel": "Télescope",
    "Tri": "Triangle", "TrA": "Triangle austral", "Tuc": "Toucan", "UMa": "Grande Ourse", "UMi": "Petite Ourse",
    "Vel": "Voiles", "Vir": "Vierge", "Vol": "Poisson volant", "Vul": "Petit Renard",
}

NGC_TYPES = {  # code OpenNGC -> (type FR, sous-famille de jeu)
    "G": ("Galaxie", "galaxie"), "GPair": ("Paire de galaxies", "galaxie"),
    "GTrpl": ("Triplet de galaxies", "galaxie"), "GGroup": ("Groupe de galaxies", "galaxie"),
    "OCl": ("Amas ouvert", "amas"), "GCl": ("Amas globulaire", "amas"), "*Ass": ("Association stellaire", "amas"),
    "Cl+N": ("Amas et nébuleuse", "nebuleuse"), "PN": ("Nébuleuse planétaire", "nebuleuse"),
    "Neb": ("Nébuleuse", "nebuleuse"), "HII": ("Région HII", "nebuleuse"), "EmN": ("Nébuleuse en émission", "nebuleuse"),
    "RfN": ("Nébuleuse par réflexion", "nebuleuse"), "DrkN": ("Nébuleuse obscure", "nebuleuse"),
    "SNR": ("Rémanent de supernova", "nebuleuse"), "Nova": ("Nova", "etoile"),
}

# Noms usuels -> français (objets les plus connus)
FR_NAMES = {
    "Andromeda Galaxy": "Galaxie d'Andromède", "Triangulum Galaxy": "Galaxie du Triangle",
    "Orion Nebula": "Nébuleuse d'Orion", "Crab Nebula": "Nébuleuse du Crabe", "Ring Nebula": "Nébuleuse de la Lyre",
    "Dumbbell Nebula": "Nébuleuse de l'Haltère", "Whirlpool Galaxy": "Galaxie du Tourbillon",
    "Sombrero Galaxy": "Galaxie du Sombrero", "Eagle Nebula": "Nébuleuse de l'Aigle",
    "Lagoon Nebula": "Nébuleuse de la Lagune", "Trifid Nebula": "Nébuleuse Trifide", "Omega Nebula": "Nébuleuse Oméga",
    "Pleiades": "Pléiades", "Beehive Cluster": "Amas de la Ruche", "Hyades": "Hyades",
    "Large Magellanic Cloud": "Grand Nuage de Magellan", "Small Magellanic Cloud": "Petit Nuage de Magellan",
    "Horsehead Nebula": "Nébuleuse de la Tête de Cheval", "Helix Nebula": "Nébuleuse de l'Hélice",
    "Cat's Eye Nebula": "Nébuleuse de l'Œil de chat", "Pinwheel Galaxy": "Galaxie du Moulinet",
    "Bode's Galaxy": "Galaxie de Bode", "Cigar Galaxy": "Galaxie du Cigare", "Owl Nebula": "Nébuleuse du Hibou",
    "North America Nebula": "Nébuleuse de l'Amérique du Nord", "Rosette Nebula": "Nébuleuse de la Rosette",
    "Veil Nebula": "Nébuleuse du Voile", "Carina Nebula": "Nébuleuse de la Carène",
    "Tarantula Nebula": "Nébuleuse de la Tarentule", "Omega Centauri": "Oméga du Centaure",
    "Double Cluster": "Double amas de Persée", "Coalsack Nebula": "Sac à Charbon",
    "Black Eye Galaxy": "Galaxie de l'Œil noir", "Sunflower Galaxy": "Galaxie du Tournesol",
    "Wild Duck Cluster": "Amas du Canard sauvage", "Butterfly Cluster": "Amas du Papillon",
    "Ptolemy Cluster": "Amas de Ptolémée", "Hercules Globular Cluster": "Grand amas d'Hercule",
    "Great Hercules Cluster": "Grand amas d'Hercule", "Jewel Box": "Boîte à bijoux",
    "Cave Nebula": "Nébuleuse de la Caverne", "Great Orion Nebula": "Nébuleuse d'Orion",
    "Pinwheel Cluster": "Amas du Moulinet", "Little Dumbbell Nebula": "Petite nébuleuse de l'Haltère",
    "Southern Pinwheel Galaxy": "Galaxie du Moulinet austral", "Seven Sisters": "Pléiades", "Centaurus A": "Centaurus A",
}

STAR_FR = {
    "Sol": None, "Polaris": "Étoile polaire", "Sirius": "Sirius", "Betelgeuse": "Bételgeuse",
    "Rigil Kentaurus": "Alpha du Centaure A", "Proxima Centauri": "Proxima du Centaure",
    "Achernar": "Achernar", "Fomalhaut": "Fomalhaut", "Barnard's Star": "Étoile de Barnard",
}

# Objets forcés en Légendaire (identifiants internes produits par le script)
FORCED_LEGENDARY = {
    "ss-soleil", "ss-terre", "ss-lune", "ss-jupiter", "ss-saturne", "ss-mars", "ss-voie-lactee",
    "ss-sagittarius-a", "ss-1p-halley", "ss-pluton",
    "ngc-NGC0224", "ngc-NGC1976", "ngc-NGC1952", "ngc-C041", "ngc-ESO056-115", "ngc-B033", "ngc-NGC5139",
    "ngc-NGC5194", "ngc-NGC6611", "ngc-NGC3372", "ngc-NGC2070",
    "star-Sirius", "star-Betelgeuse", "star-Polaris", "star-Vega", "star-Rigel", "star-Proxima Centauri",
    "star-Rigil Kentaurus", "star-Antares", "star-Aldebaran", "star-Deneb",
    "exo-TRAPPIST-1 e", "exo-Proxima Cen b", "exo-51 Peg b", "exo-Kepler-452 b", "exo-HD 209458 b",
}
SB_SKIP = {"Ceres", "Pluto", "Eris", "Haumea", "Makemake", "Halley", "Churyumov", "Hale-Bopp"}
FAMOUS_SYSTEMS = ("TRAPPIST-1", "Proxima", "Kepler-452", "Kepler-186", "TOI-700", "LHS 1140", "Gliese 581",
                  "GJ 1214", "WASP-12", "HR 8799", "55 Cnc", "51 Peg", "HD 209458", "Kepler-16", "Teegarden")

# --------------------------------------------------------------------------- #
# Système solaire (données intégrées)
# rayon km, masse en masses terrestres, distance moyenne au Soleil en UA (ou à la planète pour les lunes)
# --------------------------------------------------------------------------- #
SOLAR = [
    # id, nom, type, famille, rayon_km, masse_terre, distance_ua, description
    ("soleil", "Soleil", "Étoile naine jaune", "etoile", 696340, 332946, 0, "Étoile au centre du Système solaire."),
    ("mercure", "Mercure", "Planète tellurique", "planete", 2440, 0.055, 0.39, "Planète la plus proche du Soleil."),
    ("venus", "Vénus", "Planète tellurique", "planete", 6052, 0.815, 0.72, "Planète la plus chaude, sous une épaisse atmosphère acide."),
    ("terre", "Terre", "Planète tellurique", "planete", 6371, 1.0, 1.0, "Seule planète connue abritant la vie."),
    ("mars", "Mars", "Planète tellurique", "planete", 3390, 0.107, 1.52, "La planète rouge, cible des missions d'exploration."),
    ("jupiter", "Jupiter", "Géante gazeuse", "planete", 69911, 317.8, 5.20, "Plus grande planète du Système solaire."),
    ("saturne", "Saturne", "Géante gazeuse", "planete", 58232, 95.2, 9.58, "Planète aux anneaux spectaculaires."),
    ("uranus", "Uranus", "Géante de glaces", "planete", 25362, 14.5, 19.2, "Géante qui tourne couchée sur le côté."),
    ("neptune", "Neptune", "Géante de glaces", "planete", 24622, 17.1, 30.1, "Planète la plus lointaine, balayée par des vents record."),
    ("pluton", "Pluton", "Planète naine", "planete_naine", 1188, 0.0022, 39.5, "Planète naine de la ceinture de Kuiper."),
    ("ceres", "Cérès", "Planète naine", "planete_naine", 470, 0.00016, 2.77, "Plus gros objet de la ceinture d'astéroïdes."),
    ("eris", "Éris", "Planète naine", "planete_naine", 1163, 0.0028, 67.8, "Planète naine massive aux confins du Système solaire."),
    ("haumea", "Hauméa", "Planète naine", "planete_naine", 816, 0.00067, 43.2, "Planète naine allongée à rotation très rapide."),
    ("makemake", "Makémaké", "Planète naine", "planete_naine", 715, 0.00052, 45.8, "Planète naine glacée de la ceinture de Kuiper."),
    ("lune", "Lune", "Satellite naturel", "lune", 1737, 0.0123, 0.00257, "Unique satellite naturel de la Terre."),
    ("phobos", "Phobos", "Satellite de Mars", "lune", 11, 1.8e-9, 0.0000627, "Lune de Mars qui se rapproche lentement de sa planète."),
    ("deimos", "Déimos", "Satellite de Mars", "lune", 6, 2.5e-10, 0.000157, "Petite lune de Mars."),
    ("io", "Io", "Satellite de Jupiter", "lune", 1822, 0.015, 0.00282, "Monde le plus volcanique du Système solaire."),
    ("europe", "Europe", "Satellite de Jupiter", "lune", 1561, 0.008, 0.00449, "Lune glacée abritant un océan souterrain."),
    ("ganymede", "Ganymède", "Satellite de Jupiter", "lune", 2634, 0.025, 0.00716, "Plus grande lune du Système solaire."),
    ("callisto", "Callisto", "Satellite de Jupiter", "lune", 2410, 0.018, 0.0126, "Lune la plus cratérisée du Système solaire."),
    ("titan", "Titan", "Satellite de Saturne", "lune", 2575, 0.0225, 0.00817, "Lune à l'atmosphère dense et aux lacs de méthane."),
    ("encelade", "Encelade", "Satellite de Saturne", "lune", 252, 1.8e-5, 0.00159, "Lune projetant des geysers d'eau dans l'espace."),
    ("mimas", "Mimas", "Satellite de Saturne", "lune", 198, 6.3e-6, 0.00124, "Lune marquée par un cratère géant."),
    ("japet", "Japet", "Satellite de Saturne", "lune", 735, 3.0e-4, 0.0238, "Lune aux deux faces, l'une sombre, l'autre claire."),
    ("rhea", "Rhéa", "Satellite de Saturne", "lune", 764, 3.9e-4, 0.00352, "Deuxième plus grande lune de Saturne."),
    ("titania", "Titania", "Satellite d'Uranus", "lune", 789, 5.7e-4, 0.00292, "Plus grande lune d'Uranus."),
    ("miranda", "Miranda", "Satellite d'Uranus", "lune", 236, 1.1e-5, 0.000868, "Lune aux falaises vertigineuses."),
    ("triton", "Triton", "Satellite de Neptune", "lune", 1353, 0.0036, 0.00237, "Lune en orbite rétrograde, sans doute capturée."),
    ("charon", "Charon", "Satellite de Pluton", "lune", 606, 2.7e-4, 0.000131, "Compagne de Pluton, presque aussi grande qu'elle."),
    ("1p-halley", "Comète de Halley", "Comète périodique", "comete", 5.5, 3.7e-11, 17.8, "Comète visible tous les 76 ans environ."),
    ("hale-bopp", "Comète Hale-Bopp", "Comète", "comete", 30, 1.7e-9, 186, "Grande comète visible à l'œil nu en 1997."),
    ("67p", "67P/Tchourioumov-Guérassimenko", "Comète périodique", "comete", 2, 1.7e-12, 3.46, "Comète visitée par la sonde Rosetta et l'atterrisseur Philae."),
    ("oumuamua", "ʻOumuamua", "Objet interstellaire", "comete", 0.1, 1e-14, 0, "Premier objet interstellaire détecté dans le Système solaire."),
    ("voie-lactee", "Voie lactée", "Galaxie spirale barrée", "galaxie", 5e17, 3e17, 0, "Notre galaxie, qui compte des centaines de milliards d'étoiles."),
    ("sagittarius-a", "Sagittarius A*", "Trou noir supermassif", "trou_noir", 1.2e7, 1.4e12, 0, "Trou noir au centre de la Voie lactée."),
    ("m87-trou-noir", "M87*", "Trou noir supermassif", "trou_noir", 1.9e10, 2.1e15, 0, "Premier trou noir photographié, en 2019."),
    ("cygnus-x1", "Cygnus X-1", "Trou noir stellaire", "trou_noir", 63, 7e6, 0, "Premier trou noir stellaire identifié."),
    ("pulsar-crabe", "Pulsar du Crabe", "Étoile à neutrons", "etoile", 10, 4.6e5, 0, "Pulsar au cœur de la nébuleuse du Crabe."),
]


# --------------------------------------------------------------------------- #
# Utilitaires
# --------------------------------------------------------------------------- #

def fetch(name: str, cache: Path, offline: bool) -> str | None:
    path = cache / f"{name}.raw"
    if path.exists():
        return path.read_text(encoding="utf-8")
    if offline:
        return None
    print(f"  ↓ {name} …", file=sys.stderr)
    try:
        req = urllib.request.Request(URLS[name], headers={"User-Agent": "astrodex-catalog/1.0"})
        with urllib.request.urlopen(req, timeout=180) as r:
            text = r.read().decode("utf-8")
    except Exception as exc:  # noqa: BLE001
        print(f"  ✗ {name} injoignable ({exc}) — ignoré", file=sys.stderr)
        return None
    path.write_text(text, encoding="utf-8")
    return text


def num(v) -> float | None:
    try:
        f = float(v)
        return f if math.isfinite(f) else None
    except (TypeError, ValueError):
        return None


def slug(s: str) -> str:
    return "".join(c if c.isalnum() else "-" for c in s).strip("-")


def percentile_ranks(values: list[float | None]) -> list[float]:
    """Rang percentile 0..1 ; les valeurs manquantes valent 0.25."""
    known = sorted(v for v in values if v is not None)
    if not known:
        return [0.5] * len(values)
    n = len(known)
    return [0.25 if v is None else bisect.bisect_right(known, v) / n for v in values]


def log10p(v: float | None) -> float | None:
    return None if v is None or v <= 0 else math.log10(v)


def fmt_dist_ly(ly: float | None) -> str:
    if ly is None:
        return ""
    if ly < 1:
        return f"{ly * 63241:.0f} UA"
    if ly < 1000:
        return f"{ly:.0f} années-lumière"
    if ly < 1e6:
        return f"{ly / 1000:.0f} 000 années-lumière".replace(".", ",")
    return f"{ly / 1e6:.1f} millions d'années-lumière".replace(".", ",")


def card(id_, nom, categorie, type_, famille, notoriete, stats_raw, description, constellation="", faits=None):
    return {
        "id": id_, "nom": nom, "categorie": categorie, "type": type_, "famille": famille,
        "constellation": constellation, "description": description,
        "_notoriete": notoriete, "_stats_raw": stats_raw, "faits": faits or {},
    }


# --------------------------------------------------------------------------- #
# Chargement par source
# --------------------------------------------------------------------------- #

def load_solar() -> list[dict]:
    out = []
    for sid, nom, type_, fam, rayon, masse, dist, desc in SOLAR:
        out.append(card(
            f"ss-{sid}", nom, "systeme_solaire", type_, fam, 1.0,
            {"attaque": log10p(masse), "defense": log10p(rayon), "vitesse": log10p(1 / dist) if dist else 0},
            desc, faits={"rayon_km": rayon, "masse_terre": masse, "distance_ua": dist},
        ))
    return out


def load_stars(text: str) -> list[dict]:
    out = []
    for r in csv.DictReader(io.StringIO(text)):
        proper = r["proper"].strip()
        if proper == "Sol":
            continue  # le Soleil est déjà dans le Système solaire
        mag, absmag, lum = num(r["mag"]), num(r["absmag"]), num(r["lum"])
        dist_pc = num(r["dist"])
        if mag is None or dist_pc is None or dist_pc >= 100000:
            continue
        con = r["con"].strip()
        bayer, flam = r["bayer"].strip(), r["flam"].strip()
        if proper:
            nom = STAR_FR.get(proper) or proper
        elif bayer and con:
            nom = f"{bayer} {con}"
        elif flam and con:
            nom = f"{flam} {con}"
        elif r["hd"]:
            nom = f"HD {r['hd']}"
        elif r["hip"]:
            nom = f"HIP {r['hip']}"
        else:
            nom = f"HYG {r['id']}"
        spect = r["spect"].strip()
        classe = spect[:1] if spect else "?"
        type_ = {
            "O": "Étoile bleue", "B": "Étoile bleu-blanc", "A": "Étoile blanche", "F": "Étoile blanc-jaune",
            "G": "Étoile jaune", "K": "Étoile orange", "M": "Étoile rouge", "W": "Étoile Wolf-Rayet",
            "D": "Naine blanche", "C": "Étoile carbonée",
        }.get(classe, "Étoile")
        lclass = re.search(r"(Ia|Iab|Ib|III|II|IV|V)", spect[1:]) if spect else None
        if lclass and lclass.group(1) in ("Ia", "Iab", "Ib"):
            type_ = type_.replace("Étoile", "Supergéante")
        elif lclass and lclass.group(1) in ("III", "II"):
            type_ = type_.replace("Étoile", "Géante")
        # Notoriété : éclat apparent + nom propre + désignation de Bayer
        noto = -mag / 10 + (0.9 if proper else 0) + (0.25 if bayer else 0) + (0.1 if flam else 0)
        ly = dist_pc * 3.26156
        cname = CONSTELLATIONS.get(con, con)
        desc = f"{type_} ({spect or 'type inconnu'})" + (f" de la constellation {de(cname)}" if cname else "")
        desc += f", à {fmt_dist_ly(ly)}."
        out.append(card(
            f"star-{proper or r['id']}", nom, "etoile", type_, "etoile", noto,
            {"attaque": log10p(lum), "defense": -absmag if absmag is not None else None,
             "vitesse": math.hypot(num(r["pmra"]) or 0, num(r["pmdec"]) or 0)},
            desc, cname,
            {"magnitude": mag, "magnitude_absolue": absmag, "distance_al": round(ly, 2),
             "spectre": spect, "luminosite_soleil": lum, "hip": r["hip"] or None, "hd": r["hd"] or None},
        ))
    return out


def de(name: str) -> str:
    """Complément « de la Lyre », « d'Orion », « du Cygne », « des Gémeaux »."""
    if not name:
        return ""
    proper = {"Andromède", "Orion", "Hercule", "Ophiuchus", "Éridan", "Cassiopée", "Céphée", "Pégase", "Persée"}
    with_l = {"Aigle", "Autel", "Indien", "Octant", "Écu de Sobieski", "Oiseau de paradis", "Hydre", "Hydre mâle"}
    fem = {"Lyre", "Vierge", "Balance", "Baleine", "Girafe", "Grande Ourse", "Petite Ourse", "Croix du Sud",
           "Couronne boréale", "Couronne australe", "Chevelure de Bérénice", "Licorne", "Grue", "Colombe",
           "Dorade", "Carène", "Poupe", "Règle", "Table", "Flèche", "Coupe", "Mouche", "Machine pneumatique",
           "Boussole", "Horloge"}
    plural = {"Gémeaux", "Poissons", "Voiles", "Chiens de chasse"}
    if name in plural:
        return f"des {name}"
    if name in with_l:
        return f"de l'{name}"
    if name in proper:
        return f"d'{name}" if name[0] in "AEIOUYÉ" else f"de {name}"
    return f"de la {name}" if name in fem else f"du {name}"


def load_ngc(texts: list[str]) -> list[dict]:
    out, seen = [], set()
    for text in texts:
        for r in csv.DictReader(io.StringIO(text), delimiter=";"):
            t = r["Type"].strip()
            if t not in NGC_TYPES:
                continue
            code = r["Name"].strip()
            if code in seen:
                continue
            seen.add(code)
            type_fr, fam = NGC_TYPES[t]
            commons = [c.strip() for c in r["Common names"].split(",") if c.strip()]
            common = commons[0] if commons else ""
            m = r["M"].strip().lstrip("0")
            nom = FR_NAMES.get(common) or common or (f"M{m}" if m else pretty_ngc(code))
            vmag = num(r["V-Mag"]) or num(r["B-Mag"])
            size = num(r["MajAx"])
            rv = num(r["RadVel"])
            con = CONSTELLATIONS.get(r["Const"].strip(), r["Const"].strip())
            noto = (-(vmag if vmag is not None else 15) / 15
                    + (1.3 if m else 0) + (0.8 if common else 0) + (0.15 * min(len(commons), 3))
                    + (0.15 if t not in ("G", "GPair") else 0) + 0.3 * (log10p(size) or 0))
            desc = type_fr + (f" de la constellation {de(con)}" if con else "")
            extra = []
            if m:
                extra.append(f"objet n°{m} du catalogue de Messier")
            if code and nom != pretty_ngc(code):
                extra.append(f"référencé {pretty_ngc(code)}")
            desc += (", " + ", ".join(extra) if extra else "") + "."
            out.append(card(
                f"ngc-{code}", nom, "ciel_profond", type_fr, fam, noto,
                {"attaque": -vmag if vmag is not None else None, "defense": log10p(size),
                 "vitesse": abs(rv) if rv is not None else None},
                desc, con,
                {"code": pretty_ngc(code), "messier": f"M{m}" if m else None, "magnitude": vmag,
                 "taille_arcmin": size, "vitesse_radiale_kms": rv, "noms_usuels": commons},
            ))
    return out


def pretty_ngc(code: str) -> str:
    for p in ("NGC", "IC"):
        if code.startswith(p) and code[len(p):].isdigit():
            return f"{p} {int(code[len(p):])}"
    return code


def load_exoplanets(text: str) -> list[dict]:
    out = []
    for r in csv.DictReader(io.StringIO(text)):
        name = r["pl_name"].strip()
        rade, masse, per = num(r["pl_rade"]), num(r["pl_bmasse"]), num(r["pl_orbper"])
        eqt, year, dist = num(r["pl_eqt"]), num(r["disc_year"]), num(r["sy_dist"])
        if rade is None:
            type_ = "Exoplanète"
        elif rade < 1.6:
            type_ = "Exoplanète rocheuse"
        elif rade < 4:
            type_ = "Mini-Neptune"
        elif rade < 8:
            type_ = "Exo-Neptune"
        else:
            type_ = "Géante gazeuse"
        if type_ == "Géante gazeuse" and per is not None and per < 10:
            type_ = "Jupiter chaud"
        habitable = eqt is not None and 180 <= eqt <= 310 and (rade or 99) < 2.5
        if habitable:
            type_ += " tempérée"
        famous = any(s in name for s in FAMOUS_SYSTEMS)
        noto = (0.8 if famous else 0) + (0.7 if habitable else 0) + (2030 - (year or 2025)) / 40 \
            - 0.25 * (log10p(dist) or 3)
        ly = dist * 3.26156 if dist else None
        desc = f"{type_} en orbite autour de {r['hostname']}"
        desc += (f", à {fmt_dist_ly(ly)}" if ly else "") + (f", découverte en {int(year)}" if year else "") + "."
        out.append(card(
            f"exo-{name}", name, "exoplanete", type_, "exoplanete", noto,
            {"attaque": log10p(masse), "defense": log10p(rade), "vitesse": log10p(1 / per) if per else None},
            desc, "",
            {"etoile_hote": r["hostname"], "rayon_terre": rade, "masse_terre": masse, "periode_jours": per,
             "temperature_k": eqt, "annee_decouverte": int(year) if year else None,
             "methode": r["discoverymethod"], "distance_al": round(ly, 1) if ly else None},
        ))
    return out


def load_small_bodies(texts: list[str]) -> list[dict]:
    out = []
    for text in texts:
        try:
            payload = json.loads(text)
        except json.JSONDecodeError:
            continue
        fields = payload.get("fields", [])
        for row in payload.get("data", []):
            r = dict(zip(fields, row))
            full = (r.get("full_name") or "").strip()
            name = (r.get("name") or "").strip()
            kind = r.get("kind") or ""
            diam, alb, per = num(r.get("diameter")), num(r.get("albedo")), num(r.get("per_y"))
            is_comet = kind.startswith("c")
            if name in SB_SKIP or any(k in full for k in SB_SKIP):
                continue  # déjà présents dans le Système solaire
            if is_comet:
                type_ = "Comète périodique" if (r.get("prefix") == "P") else "Comète"
                nom = full or name
            else:
                type_ = {
                    "MBA": "Astéroïde de la ceinture principale", "IMB": "Astéroïde de la ceinture principale",
                    "OMB": "Astéroïde de la ceinture principale", "APO": "Géocroiseur (Apollon)",
                    "ATE": "Géocroiseur (Aton)", "AMO": "Géocroiseur (Amor)", "TJN": "Troyen de Jupiter",
                    "CEN": "Centaure", "TNO": "Objet transneptunien", "MCA": "Astéroïde aréocroiseur",
                    "HYA": "Astéroïde hyperbolique",
                }.get(r.get("class"), "Astéroïde")
                nom = full.split("(")[0].strip() if full else name  # ex. « 433 Eros »
            noto = 0.6 * (log10p(diam) or -0.5) + (0.3 if name else 0) \
                + (0.5 if r.get("class") in ("APO", "ATE", "TNO", "CEN") else 0) + (0.3 if is_comet else 0)
            desc = type_ + (f" d'environ {diam:.0f} km de diamètre" if diam and diam >= 1 else "") + "."
            out.append(card(
                f"sb-{r.get('spkid') or slug(full)}", nom, "petit_corps", type_, "comete" if is_comet else "asteroide",
                noto, {"attaque": log10p(diam), "defense": alb, "vitesse": log10p(1 / per) if per else None},
                desc, "", {"diametre_km": diam, "albedo": alb, "periode_ans": per, "classe": r.get("class")},
            ))
    return out


# --------------------------------------------------------------------------- #
# Sélection, rareté, stats
# --------------------------------------------------------------------------- #

def top_n(cards: list[dict], n: int) -> list[dict]:
    return sorted(cards, key=lambda c: c["_notoriete"], reverse=True)[:max(n, 0)]


def assign(cards: list[dict]) -> None:
    # 1) score de notoriété global = rang percentile dans la catégorie × poids de catégorie
    by_cat: dict[str, list[dict]] = {}
    for c in cards:
        by_cat.setdefault(c["categorie"], []).append(c)
    for cat, group in by_cat.items():
        ranks = percentile_ranks([c["_notoriete"] for c in group])
        for c, p in zip(group, ranks):
            c["_score"] = p * CATEGORY_WEIGHT[cat] + (2 if c["id"] in FORCED_LEGENDARY else 0)
        # stats : rang percentile de chaque grandeur brute dans la catégorie
        for stat in ("attaque", "defense", "vitesse"):
            sr = percentile_ranks([c["_stats_raw"].get(stat) for c in group])
            for c, p in zip(group, sr):
                c.setdefault("_sp", {})[stat] = p

    # 2) quotas de rareté appliqués dans chaque catégorie (chaque famille a ses légendaires)
    labels = {code: label for code, label, *_r in RARITIES}
    for cat, group in by_cat.items():
        if cat == "systeme_solaire":  # petit ensemble iconique : Légendaire ou Ultra rare
            for c in group:
                code = "L" if c["id"] in FORCED_LEGENDARY or c["famille"] in ("planete", "trou_noir") else "UR"
                c["rarete_code"], c["rarete"] = code, labels[code]
            continue
        ranked = sorted(group, key=lambda c: c["_score"], reverse=True)
        total, start = len(ranked), 0
        for i, (code, label, share, _bonus) in enumerate(RARITIES):
            count = total - start if i == len(RARITIES) - 1 else round(total * share)
            for c in ranked[start:start + count]:
                c["rarete_code"], c["rarete"] = code, label
            start += count

    # 3) stats finales 1..100
    bonus = {code: b for code, _l, _s, b in RARITIES}
    rng = random.Random(42)
    for c in cards:
        b = bonus[c["rarete_code"]]
        for stat, p in c.pop("_sp").items():
            c[stat] = max(1, min(100, round(8 + p * 72 + b + rng.uniform(-3, 3))))
        c["puissance"] = c["attaque"] + c["defense"] + c["vitesse"]
        src, lic = LICENSES[c["categorie"]]
        c["source"], c["licence"] = src, lic
        c["score_notoriete"] = round(c.pop("_score"), 4)
        del c["_notoriete"], c["_stats_raw"]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--total", type=int, default=50000)
    ap.add_argument("--out", default="out")
    ap.add_argument("--cache", default="cache")
    ap.add_argument("--offline", action="store_true")
    args = ap.parse_args()
    cache, out = Path(args.cache), Path(args.out)
    cache.mkdir(exist_ok=True)
    out.mkdir(exist_ok=True)

    print("Chargement des sources…", file=sys.stderr)
    solar = load_solar()
    ngc = load_ngc([t for t in (fetch("ngc", cache, args.offline), fetch("ngc_add", cache, args.offline)) if t])
    exo_txt = fetch("exo", cache, args.offline)
    exo = load_exoplanets(exo_txt) if exo_txt else []
    sb = load_small_bodies([t for t in (fetch("sb_ast", cache, args.offline),
                                        fetch("sb_com", cache, args.offline)) if t])
    hyg_txt = fetch("hyg", cache, args.offline)
    if not hyg_txt:
        sys.exit("HYG (étoiles) est indispensable : vérifiez la connexion à GitHub.")
    stars = load_stars(hyg_txt)

    total = args.total
    exo = top_n(exo, round(total * TARGET_SHARE["exoplanete"]))
    sb = top_n(sb, round(total * TARGET_SHARE["petit_corps"]))
    ngc = top_n(ngc, total)  # tout le ciel profond tient dans le budget
    remaining = total - len(solar) - len(ngc) - len(exo) - len(sb)
    stars = top_n(stars, remaining)
    cards = solar + ngc + exo + sb + stars
    if len(cards) < total:
        print(f"⚠ seulement {len(cards)} objets disponibles", file=sys.stderr)

    # dédoublonnage des identifiants
    seen: dict[str, int] = {}
    for c in cards:
        n = seen.get(c["id"], 0)
        seen[c["id"]] = n + 1
        if n:
            c["id"] = f"{c['id']}-{n}"

    assign(cards)
    order = {code: i for i, (code, *_r) in enumerate(RARITIES)}
    cards.sort(key=lambda c: (order[c["rarete_code"]], -c["score_notoriete"]))
    for i, c in enumerate(cards, 1):
        c["numero"] = i

    cols = ["numero", "id", "nom", "rarete", "rarete_code", "categorie", "famille", "type", "constellation",
            "attaque", "defense", "vitesse", "puissance", "description", "source", "licence", "score_notoriete"]
    final = [{k: c[k] for k in cols} | {"faits": c["faits"]} for c in cards]
    (out / "cards.json").write_text(json.dumps(final, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    with (out / "cards.csv").open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore")
        w.writeheader()
        w.writerows(final)

    # résumé
    print(f"\n{len(final)} cartes écrites dans {out}/", file=sys.stderr)
    cats = sorted({c["categorie"] for c in final})
    print("\n" + f"{'':14}" + "".join(f"{code:>8}" for code, *_ in RARITIES) + "   total", file=sys.stderr)
    for cat in cats:
        row = [sum(1 for c in final if c["categorie"] == cat and c["rarete_code"] == code) for code, *_ in RARITIES]
        print(f"{cat:14}" + "".join(f"{n:>8}" for n in row) + f"{sum(row):>8}", file=sys.stderr)


if __name__ == "__main__":
    main()
