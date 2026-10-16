#!/usr/bin/env python3
"""
Astrodex — génère la série IV « Catalogue NGC » : tous les objets du New General
Catalogue (galaxies, amas, nébuleuses) absents des séries existantes.

Source : OpenNGC (CC BY-SA 4.0), déjà en cache dans tools/cache/NGC.csv + addendum.csv.

Produit :
  - catalog/objects.yaml         (objets ajoutés à la fin, slug ngcNNNNN)
  - catalog/series/s4-catalogue-ngc.yaml  (série complète : booster + cartes)
  - tools/cache/ngc_manifest.json         (slug -> ra_deg/dec_deg/type/dist_ly estimée,
                                            utilisé par fetch_dss_images.py et build_atlas.py)

Les stats (attaque/défense/vitesse) et la rareté reprennent exactement la même
méthode que tools/build_catalog.py (rang percentile par catégorie + quotas de
rareté), appliquée ici au seul sous-ensemble NGC pour que la distribution des
raretés ait du sens à cette échelle.

Usage : python tools/build_ngc_series.py
"""
from __future__ import annotations

import csv
import io
import json
import math
import random
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "tools" / "cache"
IMAGES = ROOT / "catalog" / "images" / "ngc"

sys.path.insert(0, str(ROOT / "tools"))
from build_catalog import (  # noqa: E402
    CONSTELLATIONS, NGC_TYPES, FR_NAMES, RARITIES, percentile_ranks, log10p, de, pretty_ngc,
)

# Objets déjà présents dans S1/S2/S3 (via catalog/series/*.yaml + build_atlas.py DSO) : à exclure.
ALREADY_USED = {
    "NGC0224", "NGC0598", "NGC1232", "NGC1365", "NGC1792", "NGC1952", "NGC1976", "NGC1999",
    "NGC2023", "NGC2024", "NGC2070", "NGC2207", "NGC2237", "NGC2261", "NGC2392", "NGC2440",
    "NGC2623", "NGC2736", "NGC2818", "NGC2867", "NGC3132", "NGC3293", "NGC3314", "NGC3372",
    "NGC3532", "NGC3603", "NGC3621", "NGC3808", "NGC4755", "NGC4945", "NGC5128", "NGC5189",
    "NGC5236", "NGC5315", "NGC5882", "NGC6210", "NGC6302", "NGC6334", "NGC6357", "NGC6369",
    "NGC6514", "NGC6523", "NGC6537", "NGC6543", "NGC6572", "NGC6611", "NGC6720", "NGC6822",
    "NGC6826", "NGC6853", "NGC6881", "NGC6888", "NGC6960", "NGC7009", "NGC7023", "NGC7026",
    "NGC7027", "NGC7129", "NGC7293", "NGC7742",
}

# Distance typique par famille (années-lumière) quand aucun décalage vers le rouge n'est disponible :
# approximation raisonnable par type d'objet (amas galactiques proches, nébuleuses dans la Voie lactée,
# amas globulaires dans le halo galactique). Les galaxies sans redshift sont plutôt rares dans OpenNGC ;
# celles sans valeur utilisable reçoivent un repli générique (groupe local-ish) plutôt qu'une distance
# inventée avec une fausse précision.
TYPICAL_LY = {
    "OCl": (800, 9000), "GCl": (9000, 90000), "*Ass": (1000, 8000),
    "PN": (1000, 16000), "Neb": (1000, 9000), "HII": (1500, 12000),
    "EmN": (1000, 9000), "RfN": (500, 6000), "DrkN": (400, 4000),
    "Cl+N": (1000, 9000), "SNR": (2000, 20000), "Nova": (2000, 15000),
    # Galaxies sans redshift exploitable dans OpenNGC : repli extragalactique générique.
    "G": (2e6, 400e6), "GPair": (5e6, 400e6), "GTrpl": (5e6, 400e6), "GGroup": (10e6, 500e6),
}
H0 = 70.0  # km/s/Mpc
C_KMS = 299792.458
LY_PER_MPC = 3.2616e6


def parse_radec(ra: str, dec: str) -> tuple[float, float] | None:
    try:
        h, m, s = (float(x) for x in ra.split(":"))
        sign = -1 if dec.strip().startswith("-") else 1
        d, dm, ds = (float(x) for x in dec.lstrip("+-").split(":"))
        ra_deg = (h + m / 60 + s / 3600) * 15
        dec_deg = sign * (d + dm / 60 + ds / 3600)
        return round(ra_deg, 6), round(dec_deg, 6)
    except (ValueError, AttributeError):
        return None


def estimate_distance_ly(ngc_type: str, fam: str, redshift: float | None, rng: random.Random) -> float:
    # La loi de Hubble (redshift -> distance) n'a de sens que pour les galaxies : les amas et
    # nébuleuses de la Voie lactée sont gravitationnellement liés, leur "redshift" dans OpenNGC
    # (quand il existe) reflète une vitesse radiale locale, pas une expansion cosmologique.
    if fam == "galaxie" and redshift is not None and redshift > 0:
        dist_mpc = redshift * C_KMS / H0
        if 0.01 < dist_mpc < 20000:
            return round(dist_mpc * LY_PER_MPC)
    lo, hi = TYPICAL_LY.get(ngc_type, (3000, 30000))
    return round(rng.uniform(lo, hi))


def load_rows() -> list[dict]:
    rows = []
    for fname in ("NGC.csv", "addendum.csv"):
        text = (CACHE / fname).read_text(encoding="utf-8")
        for r in csv.DictReader(io.StringIO(text), delimiter=";"):
            rows.append(r)
    return rows


def num(v):
    try:
        f = float(v)
        return f if math.isfinite(f) else None
    except (TypeError, ValueError):
        return None


def main() -> None:
    rng = random.Random(2026)
    rows = load_rows()
    seen_codes = set()
    entries = []

    for r in rows:
        code = r["Name"].strip()
        if not code.startswith("NGC") or code in seen_codes or code in ALREADY_USED:
            continue
        t = r["Type"].strip()
        if t not in NGC_TYPES:
            continue
        radec = parse_radec(r["RA"].strip(), r["Dec"].strip())
        if radec is None:
            continue
        seen_codes.add(code)

        type_fr, fam = NGC_TYPES[t]
        commons = [c.strip() for c in r["Common names"].split(",") if c.strip()]
        common = commons[0] if commons else ""
        m = r["M"].strip().lstrip("0")
        nom = FR_NAMES.get(common) or common or (f"M{m}" if m else pretty_ngc(code))
        vmag = num(r["V-Mag"]) or num(r["B-Mag"])
        size = num(r["MajAx"])
        rv = num(r["RadVel"])
        redshift = num(r["Redshift"])
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

        suffix = code[3:].strip()
        m = re.match(r"^(\d+)(.*)$", suffix)
        num_part, rest = (m.group(1), m.group(2)) if m else (suffix, "")
        slug = f"ngc{num_part.zfill(5)}"
        rest_clean = re.sub(r"[^a-z0-9]", "", rest.lower())
        if rest_clean:
            slug += rest_clean
        dist_ly = estimate_distance_ly(t, fam, redshift, rng)
        ra_deg, dec_deg = radec

        entries.append({
            "slug": slug, "code": code, "nom": nom, "type_fr": type_fr, "famille": fam,
            "constellation": con, "description": desc, "_notoriete": noto,
            "_stats_raw": {"attaque": -vmag if vmag is not None else None, "defense": log10p(size),
                           "vitesse": abs(rv) if rv is not None else None},
            "faits": {"code": pretty_ngc(code), "messier": f"M{m}" if m else None, "magnitude": vmag,
                      "taille_arcmin": size, "distance_al_estimee": dist_ly},
            "ra_deg": ra_deg, "dec_deg": dec_deg, "dist_ly": dist_ly,
        })

    print(f"{len(entries)} objets NGC retenus", file=sys.stderr)

    # Rareté + stats : rang percentile dans ce sous-ensemble, quotas RARITIES (identiques à build_catalog.py).
    ranks_score = percentile_ranks([e["_notoriete"] for e in entries])
    for e, p in zip(entries, ranks_score):
        e["_score"] = p
    for stat in ("attaque", "defense", "vitesse"):
        sr = percentile_ranks([e["_stats_raw"].get(stat) for e in entries])
        for e, p in zip(entries, sr):
            e.setdefault("_sp", {})[stat] = p

    ranked = sorted(entries, key=lambda e: e["_score"], reverse=True)
    labels = {code: label for code, label, *_r in RARITIES}
    bonus = {code: b for code, _l, _s, b in RARITIES}
    total, start = len(ranked), 0
    for i, (code, label, share, _bonus) in enumerate(RARITIES):
        count = total - start if i == len(RARITIES) - 1 else round(total * share)
        for e in ranked[start:start + count]:
            e["rarete_code"], e["rarete"] = code, label
        start += count

    rng2 = random.Random(43)
    for e in entries:
        b = bonus[e["rarete_code"]]
        for stat, p in e.pop("_sp").items():
            e[stat] = max(1, min(100, round(8 + p * 72 + b + rng2.uniform(-3, 3))))

    entries.sort(key=lambda e: ({"L": 0, "UR": 1, "R": 2, "PC": 3, "C": 4}[e["rarete_code"]], -e["_score"]))

    # ---- catalog/objects.yaml : ajoute les nouveaux objets à la fin ----
    obj_lines = []
    for e in entries:
        obj_lines.append(f"- slug: {e['slug']}")
        obj_lines.append(f"  nom: {yaml_str(e['nom'])}")
        obj_lines.append(f"  type: {yaml_str(e['type_fr'])}")
        obj_lines.append(f"  constellation: {yaml_str(e['constellation'])}")
        obj_lines.append(f"  description: {yaml_str(e['description'])}")
        faits = e["faits"]
        faits_str = f"Ø {faits['taille_arcmin']:.1f}' · {faits['distance_al_estimee']:,.0f} al".replace(",", " ") \
            if faits.get("taille_arcmin") else f"{faits['distance_al_estimee']:,.0f} al".replace(",", " ")
        obj_lines.append(f"  faits: {yaml_str(faits_str)}")
    objects_path = ROOT / "catalog" / "objects.yaml"
    with objects_path.open("a", encoding="utf-8") as f:
        f.write("\n# -- Série IV : catalogue NGC (générées par tools/build_ngc_series.py) --\n")
        f.write("\n".join(obj_lines) + "\n")

    # ---- catalog/series/s4-catalogue-ngc.yaml ----
    n = len(entries)
    counts = {code: sum(1 for e in entries if e["rarete_code"] == code) for code, *_ in RARITIES}
    series_lines = [
        "# Série IV — Catalogue NGC",
        "# Raretés : C (Commune), PC (Peu commune), R (Rare), UR (Ultra rare), L (Légendaire).",
        "# Générée par tools/build_ngc_series.py à partir d'OpenNGC (CC BY-SA 4.0).",
        "# Images : clichés du Digitized Sky Survey (NASA/STScI, domaine public), un par carte.",
        "",
        "serie:",
        "  code: S4",
        "  nom: Catalogue NGC",
        "  description: 'Quatrième série : {} objets du New General Catalogue — galaxies, amas "
        "d''étoiles et nébuleuses, en clichés réels du Digitized Sky Survey.'".format(n),
        "  date_sortie: '2026-10-16'",
        "  active: true",
        "boosters:",
        "- code: S4-STD",
        "  nom: Booster Catalogue NGC",
        "  nb_cartes: 5",
        "  image: ngc-booster.webp",
        "  emplacements:",
        "  - position: 1",
        "    taux: {C: 0.75, PC: 0.25}",
        "  - position: 2",
        "    taux: {C: 0.75, PC: 0.25}",
        "  - position: 3",
        "    taux: {C: 0.6, PC: 0.4}",
        "  - position: 4",
        "    taux: {PC: 0.55, R: 0.38, UR: 0.07}",
        "  - position: 5",
        "    taux: {R: 0.72, UR: 0.22, L: 0.06}",
        "cartes:",
    ]
    for i, e in enumerate(entries, 1):
        series_lines.append(f"- numero: {i}")
        series_lines.append(f"  objet: {e['slug']}")
        series_lines.append(f"  rarete: {e['rarete_code']}")
        series_lines.append("  stats:")
        series_lines.append(f"    attaque: {e['attaque']}")
        series_lines.append(f"    defense: {e['defense']}")
        series_lines.append(f"    vitesse: {e['vitesse']}")
        series_lines.append(f"  image: ngc/{e['slug']}.webp")
        series_lines.append("  credit: NASA/STScI · Digitized Sky Survey")
        series_lines.append("  licence: Domaine public")
        series_lines.append("  cadrage: photo")
    series_path = ROOT / "catalog" / "series" / "s4-catalogue-ngc.yaml"
    series_path.write_text("\n".join(series_lines) + "\n", encoding="utf-8")

    # ---- manifest pour fetch_dss_images.py et build_atlas.py ----
    manifest = {e["slug"]: {"ra_deg": e["ra_deg"], "dec_deg": e["dec_deg"], "famille": e["famille"],
                             "dist_ly": e["dist_ly"], "code": e["code"],
                             "size_arcmin": e["faits"].get("taille_arcmin")} for e in entries}
    (CACHE / "ngc_manifest.json").write_text(json.dumps(manifest, ensure_ascii=False), encoding="utf-8")

    print(f"\n{n} cartes écrites dans {series_path.relative_to(ROOT)}", file=sys.stderr)
    print(f"{n} objets ajoutés à {objects_path.relative_to(ROOT)}", file=sys.stderr)
    print(f"manifeste images -> {CACHE / 'ngc_manifest.json'}", file=sys.stderr)
    print("\nRépartition des raretés :", file=sys.stderr)
    for code, label, *_r in RARITIES:
        print(f"  {code:3} {label:14} {counts[code]:5d}", file=sys.stderr)


def yaml_str(s: str) -> str:
    """Échappe une chaîne pour un scalaire YAML simple (simple-quoted si besoin)."""
    s = s or ""
    if any(c in s for c in ":'\"#{}[]") or s.strip() != s:
        return "'" + s.replace("'", "''") + "'"
    return s


if __name__ == "__main__":
    main()
