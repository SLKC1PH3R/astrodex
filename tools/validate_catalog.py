#!/usr/bin/env python3
"""Revalide tout le catalogue avec exactement les mêmes règles que
backend/app/catalog_import.py::load_catalog(), sans dépendance à Postgres/Pydantic.
Utile pour vérifier localement avant de pousser, puisque ce repo n'a pas de backend
vivant pour lancer l'import réel.
"""
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
CATALOG = ROOT / "catalog"
MEDIA = CATALOG / "images"

objets = yaml.safe_load((CATALOG / "objects.yaml").read_text(encoding="utf-8"))["objets"]
series_files = sorted((CATALOG / "series").glob("*.yaml"))
series = [yaml.safe_load(f.read_text(encoding="utf-8")) for f in series_files]

errors = []

slugs = [o["slug"] for o in objets]
dup = {s for s in slugs if slugs.count(s) > 1}
if dup:
    errors.append(f"slugs en double dans objects.yaml : {sorted(dup)}")
known = set(slugs)

codes = [sf["serie"]["code"] for sf in series]
if len(codes) != len(set(codes)):
    errors.append("deux fichiers de série ont le même code")

for sf in series:
    code = sf["serie"]["code"]
    nums = [c["numero"] for c in sf["cartes"]]
    if len(nums) != len(set(nums)):
        errors.append(f"{code} : numéros de carte en double")
    missing_img = 0
    for c in sf["cartes"]:
        if c["objet"] not in known:
            errors.append(f"{code} n°{c['numero']} : objet inconnu « {c['objet']} »")
        if not (MEDIA / c["image"]).is_file():
            missing_img += 1
            if missing_img <= 5:
                errors.append(f"{code} n°{c['numero']} : image introuvable {c['image']}")
    if missing_img > 5:
        errors.append(f"{code} : {missing_img} images introuvables au total")
    rarities = {c["rarete"] for c in sf["cartes"]}
    for b in sf.get("boosters", []):
        for s in b["emplacements"]:
            for r in s["taux"]:
                if r not in rarities:
                    errors.append(f"{b['code']} emplacement {s['position']} : aucune carte de rareté {r} dans {code}")

if errors:
    print(f"\n{len(errors)} erreur(s) :", file=sys.stderr)
    for e in errors:
        print(f"- {e}", file=sys.stderr)
    sys.exit(1)

total_cards = sum(len(sf["cartes"]) for sf in series)
print(f"OK : {len(objets)} objets, {len(series)} séries, {total_cards} cartes, toutes les images présentes.")
