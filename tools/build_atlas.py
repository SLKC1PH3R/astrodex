"""Génère les données de l'atlas (frontend/public/atlas/atlas.json) à partir du catalogue.

Usage : python tools/build_atlas.py
Dépendance : PyYAML. Télécharge HYG et OpenNGC dans tools/cache/ au premier lancement.

Pour chaque objet de catalog/objects.yaml, le script cherche une position :
- planètes : calculées dans le navigateur à la date du jour (clé PLANETES) ;
- lunes : planète hôte et distance réelle (LUNES) ;
- planètes naines et comètes : éléments orbitaux approchés (PETITS_CORPS) ;
- ciel profond : coordonnées OpenNGC (DSO) ou saisies à la main (MANUEL), avec une distance en années-lumière.
Un objet sans position est signalé et n'apparaît pas dans l'atlas.
"""
import csv, json, math, random, sys, urllib.request
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "tools" / "cache"
OUT = ROOT / "frontend" / "public" / "atlas" / "atlas.json"
IMAGES = ROOT / "catalog" / "images"
SOURCES = {
    "hyg.csv": "https://raw.githubusercontent.com/astronexus/HYG-Database/main/hyg/CURRENT/hygdata_v41.csv",
    "NGC.csv": "https://raw.githubusercontent.com/mattiaverga/OpenNGC/master/database_files/NGC.csv",
    "addendum.csv": "https://raw.githubusercontent.com/mattiaverga/OpenNGC/master/database_files/addendum.csv",
}
LY_PER_PC = 3.26156


def source(name):
    path = CACHE / name
    if not path.exists():
        CACHE.mkdir(parents=True, exist_ok=True)
        print("téléchargement", name, file=sys.stderr)
        urllib.request.urlretrieve(SOURCES[name], path)
    return path


# ---------- Repères : équatorial J2000 -> galactique ----------
M = [[-0.0548755604, -0.8734370902, -0.4838350155],
     [0.4941094279, -0.4448296300, 0.7469822445],
     [-0.8676661490, -0.1980763734, 0.4559837762]]


def eq2gal(v):
    return [sum(M[i][j] * v[j] for j in range(3)) for i in range(3)]


def radec(ra, dec):
    def parts(s):
        return [float(x) for x in s.replace("+", "").replace(":", " ").split()]
    h, d = parts(ra), parts(dec.lstrip("-"))
    a = (h[0] + h[1] / 60 + h[2] / 3600) * 15
    b = (d[0] + d[1] / 60 + d[2] / 3600) * (-1 if dec.strip().startswith("-") else 1)
    return a, b


def gal_pos(ra, dec, dist):
    a, b = (math.radians(x) for x in radec(ra, dec))
    g = eq2gal([math.cos(b) * math.cos(a), math.cos(b) * math.sin(a), math.sin(b)])
    return [round(c * dist, 2) for c in g]


# ---------- Positions connues ----------
PLANETES = {"mercure": "mercury", "venus": "venus", "terre": "earth", "mars": "mars", "jupiter": "jupiter",
            "saturne": "saturn", "uranus": "uranus", "neptune": "neptune", "pluton": "pluto"}

# lune : (planète hôte, demi-grand axe en km)
LUNES = {
    "lune": ("terre", 384400), "io": ("jupiter", 421700), "europe": ("jupiter", 671100), "ganymede": ("jupiter", 1070400),
    "mimas": ("saturne", 185540), "encelade": ("saturne", 238040), "tethys": ("saturne", 294670), "dione": ("saturne", 377420),
    "rhea": ("saturne", 527070), "titan": ("saturne", 1221870), "japet": ("saturne", 3560820), "phoebe": ("saturne", 12960000),
    "miranda": ("uranus", 129900), "ariel": ("uranus", 190900), "umbriel": ("uranus", 266000), "titania": ("uranus", 436300),
    "oberon": ("uranus", 583500), "triton": ("neptune", 354760), "nereide": ("neptune", 5513800), "charon": ("pluton", 19591),
}

# Éléments orbitaux approchés (écliptique J2000) : a (UA), e, i, nœud, périhélie (degrés), anomalie moyenne à l'époque, époque (JJ)
PETITS_CORPS = {
    "ceres": dict(a=2.7692, e=0.0760, i=10.594, node=80.306, peri=73.598, M0=77.372, epoch=2459000.5),
    "tempel1": dict(a=3.145, e=0.510, i=10.47, node=68.75, peri=179.2, M0=0.0, epoch=2459642.5),   # périhélie mars 2022
    "wild2": dict(a=3.45, e=0.537, i=3.24, node=136.1, peri=41.7, M0=0.0, epoch=2459928.5),        # périhélie déc. 2022
    "borrelly": dict(a=3.61, e=0.638, i=29.3, node=74.3, peri=351.9, M0=0.0, epoch=2459611.5),     # périhélie févr. 2022
}

# Distances (années-lumière) : valeurs usuelles de la littérature, arrondies.
# Celles des nébuleuses planétaires sont incertaines (facteur 1,5 à 2).
DSO = {
    "n5128": ("NGC5128", 12.4e6), "m83": ("NGC5236", 15.2e6), "n7023": ("NGC7023", 1300),
    "n7009": ("NGC7009", 5000), "n4755": ("NGC4755", 6400), "n6822": ("NGC6822", 1.6e6),
    "n6537": ("NGC6537", 3000), "n2261": ("NGC2261", 2500), "n2736": ("NGC2736", 815),
    "n3532": ("NGC3532", 1320), "n6369": ("NGC6369", 3500), "n1232": ("NGC1232", 60e6),
    "n1365": ("NGC1365", 56e6), "n1792": ("NGC1792", 40e6), "n2207": ("NGC2207", 80e6),
    "n3621": ("NGC3621", 22e6), "n4945": ("NGC4945", 12e6), "n5189": ("NGC5189", 1780),
    "n3293": ("NGC3293", 8400), "ic418": ("IC0418", 2000), "ic4406": ("IC4406", 1900),
    "n2818": ("NGC2818", 10400), "n5315": ("NGC5315", 7000), "n2623": ("NGC2623", 250e6),
    "n7742": ("NGC7742", 72e6), "n2867": ("NGC2867", 5500), "n6572": ("NGC6572", 2000),
    "n5882": ("NGC5882", 7000), "n3314": ("NGC3314", 117e6), "n3808": ("NGC3808", 300e6),
    "n3603": ("NGC3603", 20000),
}
MANUEL = {  # objets absents d'OpenNGC : (ascension droite, déclinaison, distance)
    "rho-a00": ("16 25 35", "-23 26 49", 460), "rcw49": ("10 24 01", "-57 45 00", 20000),
    "red-rectangle": ("06 19 58.2", "-10 38 15", 2300), "calabash": ("07 42 16.9", "-14 42 50", 5000),
    "u10214": ("16 06 03.9", "+55 25 32", 420e6), "hercules-cluster": ("16 05 15", "+17 44 55", 500e6),
}


def image_for(slug):
    """Illustration d'un objet qui n'a pas encore de carte (sinon l'atlas prend celle de la carte)."""
    for name in (f"{slug}.webp", f"dso-{slug}.webp", f"dso-{slug.replace('-', '_')}.webp"):
        if (IMAGES / name).is_file():
            return name
    return None


def main():
    ngc = {}
    for f in ("NGC.csv", "addendum.csv"):
        for r in csv.DictReader(open(source(f), encoding="utf-8"), delimiter=";"):
            ngc[r["Name"]] = r

    objets = yaml.safe_load((ROOT / "catalog" / "objects.yaml").read_text(encoding="utf-8"))["objets"]
    out, manquants = [], []
    for o in objets:
        slug = o["slug"]
        item = {"slug": slug, "nom": o["nom"], "type": o["type"], "constellation": o.get("constellation") or "",
                "description": o.get("description") or "", "faits": o.get("faits") or "", "image": image_for(slug)}
        if slug in PLANETES:
            item["planete"] = PLANETES[slug]
        elif slug in LUNES:
            item["hote"], item["dist_km"] = LUNES[slug]
        elif slug in PETITS_CORPS:
            item["orbite"] = PETITS_CORPS[slug]
        elif slug in DSO:
            name, dist = DSO[slug]
            r = ngc[name]
            item["pos"], item["dist"] = gal_pos(r["RA"], r["Dec"], dist), dist
        elif slug in MANUEL:
            ra, dec, dist = MANUEL[slug]
            item["pos"], item["dist"] = gal_pos(ra, dec, dist), dist
        else:
            manquants.append(slug)
            continue
        out.append(item)

    reperes = [
        {"nom": "Sagittarius A*", "detail": "Trou noir au centre de la Voie lactée", "pos": [26700, 0, 0], "dist": 26700, "niveau": 2},
        {"nom": "Galaxie d'Andromède", "detail": "Plus grande galaxie du Groupe local", "pos": gal_pos(ngc["NGC0224"]["RA"], ngc["NGC0224"]["Dec"], 2.54e6), "dist": 2.54e6, "niveau": 3},
        {"nom": "Galaxie du Triangle", "detail": "Troisième galaxie du Groupe local", "pos": gal_pos(ngc["NGC0598"]["RA"], ngc["NGC0598"]["Dec"], 2.73e6), "dist": 2.73e6, "niveau": 3},
        {"nom": "Grand Nuage de Magellan", "detail": "Galaxie satellite de la Voie lactée", "pos": gal_pos("05 23 34.5", "-69 45 22", 160000), "dist": 160000, "niveau": 3},
        {"nom": "Petit Nuage de Magellan", "detail": "Galaxie satellite de la Voie lactée", "pos": gal_pos("00 52 44.8", "-72 49 43", 200000), "dist": 200000, "niveau": 3},
        {"nom": "Amas de la Vierge", "detail": "Plus de 1 000 galaxies, le grand amas le plus proche", "pos": gal_pos("12 27 00", "+12 43 00", 54e6), "dist": 54e6, "niveau": 4},
    ]

    fr = {"Proxima Centauri": "Proxima du Centaure", "Rigil Kentaurus": "Alpha du Centaure A", "Toliman": "Alpha du Centaure B",
          "Barnard's Star": "Étoile de Barnard", "Luyten's Star": "Étoile de Luyten", "Kapteyn's Star": "Étoile de Kapteyn",
          "Van Maanen's Star": "Étoile de Van Maanen"}
    near, names, sky, bubble = [], [], [], []
    rng = random.Random(7)
    for r in csv.DictReader(open(source("hyg.csv"), encoding="utf-8")):
        if r["proper"] == "Sol":
            continue
        try:
            d, mag = float(r["dist"]), float(r["mag"])
            x, y, z = float(r["x"]), float(r["y"]), float(r["z"])
        except ValueError:
            continue
        if d <= 0 or d >= 100000:
            continue
        ci = float(r["ci"]) if r["ci"] else 0.6
        g = eq2gal([x, y, z])
        if d * LY_PER_PC <= 65:
            near.extend([round(c * LY_PER_PC, 2) for c in g] + [round(float(r["absmag"]), 1), round(ci, 2)])
            names.append(fr.get(r["proper"], r["proper"]) if r["proper"] else "")
        if mag <= 6.0:
            n = math.sqrt(sum(c * c for c in g))
            sky.extend([round(c / n, 4) for c in g] + [round(mag, 1), round(ci, 2)])
        if rng.random() < 0.22:
            bubble.extend([round(c * LY_PER_PC) for c in g])

    OUT.parent.mkdir(parents=True, exist_ok=True)
    data = {"objets": out, "reperes": reperes, "voisinage": near, "voisinage_noms": names, "ciel": sky, "bulle": bubble}
    OUT.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{len(out)} objets placés, {len(names)} étoiles proches, {len(sky) // 5} étoiles du ciel -> {OUT.relative_to(ROOT)}"
          f" ({OUT.stat().st_size // 1024} Ko)")
    if manquants:
        print("⚠ sans position (absents de l'atlas) :", ", ".join(manquants), file=sys.stderr)


if __name__ == "__main__":
    main()
