"""Import du catalogue YAML dans Postgres.

    python -m app.catalog_import            # valide puis importe
    python -m app.catalog_import --check    # valide seulement (utile en CI)

Idempotent : objets mis à jour par slug, séries par code, cartes par (série, numéro),
boosters par code. Une carte absente du YAML est marquée retired (jamais supprimée).
"""
from __future__ import annotations

import argparse
import logging
import math
import sys
from datetime import date
from pathlib import Path
from typing import Literal

import yaml
from pydantic import BaseModel, Field, ValidationError, field_validator, model_validator

from . import config

log = logging.getLogger("astrodex.catalog")
Rarity = Literal["C", "PC", "R", "UR", "L"]


class ObjectIn(BaseModel):
    slug: str = Field(pattern=r"^[a-z0-9][a-z0-9-]*$")
    nom: str
    type: str
    constellation: str | None = None
    description: str = ""
    faits: str | None = None


class SeriesIn(BaseModel):
    code: str = Field(pattern=r"^[A-Z0-9-]+$")
    nom: str
    description: str = ""
    date_sortie: date | None = None
    active: bool = True


class SlotIn(BaseModel):
    position: int = Field(ge=1)
    taux: dict[Rarity, float]

    @field_validator("taux")
    @classmethod
    def sums_to_one(cls, v):
        if any(p <= 0 for p in v.values()):
            raise ValueError("chaque taux doit être strictement positif")
        if not math.isclose(sum(v.values()), 1.0, abs_tol=1e-6):
            raise ValueError(f"les taux totalisent {sum(v.values()):.4f} au lieu de 1")
        return v


class BoosterIn(BaseModel):
    code: str = Field(pattern=r"^[A-Z0-9-]+$")
    nom: str
    nb_cartes: int = Field(ge=1, le=20)
    image: str | None = None
    active: bool = True
    emplacements: list[SlotIn]

    @model_validator(mode="after")
    def slots_match(self):
        positions = sorted(s.position for s in self.emplacements)
        if positions != list(range(1, self.nb_cartes + 1)):
            raise ValueError(f"le booster {self.code} doit définir les emplacements 1 à {self.nb_cartes}")
        return self


class Stats(BaseModel):
    attaque: int = Field(ge=0, le=100)
    defense: int = Field(ge=0, le=100)
    vitesse: int = Field(ge=0, le=100)


class CardIn(BaseModel):
    numero: int = Field(ge=1)
    objet: str
    rarete: Rarity
    stats: Stats
    image: str
    credit: str
    licence: str
    variante: str = "standard"
    # photo : image plein cadre ; globe : planète détourée sur fond étoilé ; globe-large : avec anneaux
    cadrage: Literal["photo", "globe", "globe-large"] = "photo"


class SeriesFile(BaseModel):
    serie: SeriesIn
    boosters: list[BoosterIn] = []
    cartes: list[CardIn]


class Catalog(BaseModel):
    objets: list[ObjectIn]
    series: list[SeriesFile]


def load_catalog(catalog_dir: Path = config.CATALOG_DIR, media_dir: Path = config.MEDIA_DIR) -> Catalog:
    """Lit et valide tout le catalogue. Lève ValueError avec la liste des problèmes."""
    errors: list[str] = []
    try:
        objets = yaml.safe_load((catalog_dir / "objects.yaml").read_text(encoding="utf-8"))["objets"]
        series = [yaml.safe_load(f.read_text(encoding="utf-8")) for f in sorted((catalog_dir / "series").glob("*.yaml"))]
        cat = Catalog(objets=objets, series=series)
    except (OSError, KeyError, yaml.YAMLError) as exc:
        raise ValueError(f"catalogue illisible : {exc}") from exc
    except ValidationError as exc:
        raise ValueError(f"catalogue invalide :\n{exc}") from exc

    slugs = [o.slug for o in cat.objets]
    dup = {s for s in slugs if slugs.count(s) > 1}
    if dup:
        errors.append(f"slugs en double dans objects.yaml : {sorted(dup)}")
    known = set(slugs)
    codes = [s.serie.code for s in cat.series]
    if len(codes) != len(set(codes)):
        errors.append("deux fichiers de série ont le même code")
    for sf in cat.series:
        code = sf.serie.code
        nums = [c.numero for c in sf.cartes]
        if len(nums) != len(set(nums)):
            errors.append(f"{code} : numéros de carte en double")
        for c in sf.cartes:
            if c.objet not in known:
                errors.append(f"{code} n°{c.numero} : objet inconnu « {c.objet} »")
            if not (media_dir / c.image).is_file():
                errors.append(f"{code} n°{c.numero} : image introuvable {c.image}")
        rarities = {c.rarete for c in sf.cartes}
        for b in sf.boosters:
            for s in b.emplacements:
                for r in s.taux:
                    if r not in rarities:
                        errors.append(f"{b.code} emplacement {s.position} : aucune carte de rareté {r} dans {code}")
    if errors:
        raise ValueError("catalogue invalide :\n- " + "\n- ".join(errors))
    return cat


def import_catalog(conn, cat: Catalog) -> dict:
    """Écrit le catalogue validé dans une seule transaction."""
    stats = {"objets": 0, "series": 0, "cartes": 0, "retirees": 0, "boosters": 0}
    with conn.transaction():
        obj_ids = {}
        for o in cat.objets:
            row = conn.execute("""
                INSERT INTO celestial_objects (slug, nom, type, constellation, description, faits)
                VALUES (%(slug)s, %(nom)s, %(type)s, %(constellation)s, %(description)s, %(faits)s)
                ON CONFLICT (slug) DO UPDATE SET nom = EXCLUDED.nom, type = EXCLUDED.type,
                    constellation = EXCLUDED.constellation, description = EXCLUDED.description,
                    faits = EXCLUDED.faits, updated_at = now()
                RETURNING id""", o.model_dump()).fetchone()
            obj_ids[o.slug] = row["id"]
            stats["objets"] += 1

        for sf in cat.series:
            s = sf.serie
            sid = conn.execute("""
                INSERT INTO series (code, nom, description, date_sortie, active)
                VALUES (%(code)s, %(nom)s, %(description)s, %(date_sortie)s, %(active)s)
                ON CONFLICT (code) DO UPDATE SET nom = EXCLUDED.nom, description = EXCLUDED.description,
                    date_sortie = EXCLUDED.date_sortie, active = EXCLUDED.active
                RETURNING id""", s.model_dump()).fetchone()["id"]
            stats["series"] += 1

            for c in sf.cartes:
                conn.execute("""
                    INSERT INTO cards (series_id, object_id, numero, rarete, attaque, defense, vitesse,
                                       image, credit, licence, variante, cadrage, retired)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, FALSE)
                    ON CONFLICT (series_id, numero) DO UPDATE SET object_id = EXCLUDED.object_id,
                        rarete = EXCLUDED.rarete, attaque = EXCLUDED.attaque, defense = EXCLUDED.defense,
                        vitesse = EXCLUDED.vitesse, image = EXCLUDED.image, credit = EXCLUDED.credit,
                        licence = EXCLUDED.licence, variante = EXCLUDED.variante, cadrage = EXCLUDED.cadrage, retired = FALSE""",
                    (sid, obj_ids[c.objet], c.numero, c.rarete, c.stats.attaque, c.stats.defense,
                     c.stats.vitesse, c.image, c.credit, c.licence, c.variante, c.cadrage))
                stats["cartes"] += 1
            cur = conn.execute("UPDATE cards SET retired = TRUE WHERE series_id = %s AND NOT retired AND NOT (numero = ANY(%s))",
                               (sid, [c.numero for c in sf.cartes]))
            stats["retirees"] += cur.rowcount

            for b in sf.boosters:
                pid = conn.execute("""
                    INSERT INTO pack_types (series_id, code, nom, nb_cartes, image, active)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    ON CONFLICT (code) DO UPDATE SET series_id = EXCLUDED.series_id, nom = EXCLUDED.nom,
                        nb_cartes = EXCLUDED.nb_cartes, image = EXCLUDED.image, active = EXCLUDED.active
                    RETURNING id""", (sid, b.code, b.nom, b.nb_cartes, b.image, b.active)).fetchone()["id"]
                conn.execute("DELETE FROM pack_slots WHERE pack_type_id = %s", (pid,))
                for slot in b.emplacements:
                    for r, p in slot.taux.items():
                        conn.execute("INSERT INTO pack_slots (pack_type_id, position, rarete, probabilite) VALUES (%s, %s, %s, %s)",
                                     (pid, slot.position, r, p))
                stats["boosters"] += 1
    return stats


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    ap = argparse.ArgumentParser(description="Valide et importe le catalogue YAML")
    ap.add_argument("--check", action="store_true", help="valider sans écrire en base")
    args = ap.parse_args()
    try:
        cat = load_catalog()
    except ValueError as exc:
        print(exc, file=sys.stderr)
        sys.exit(1)
    n_cards = sum(len(s.cartes) for s in cat.series)
    print(f"Catalogue valide : {len(cat.objets)} objets, {len(cat.series)} série(s), {n_cards} cartes")
    if args.check:
        return
    import psycopg
    from psycopg.rows import dict_row
    from .db import migrate
    with psycopg.connect(config.DATABASE_URL, row_factory=dict_row) as conn:
        migrate(conn)
        print("Import :", import_catalog(conn, cat))


if __name__ == "__main__":
    main()
