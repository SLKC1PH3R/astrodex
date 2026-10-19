"""Import du catalogue YAML dans Postgres.

    python -m app.catalog_import            # valide puis importe
    python -m app.catalog_import --check    # valide seulement (utile en CI)

Idempotent : objets mis à jour par slug, séries par code, cartes par (série, numéro),
boosters par code. Une carte absente du YAML est marquée retired (jamais supprimée).

Boosters à thème (catalog/boosters.yaml) : leur contenu est calculé à partir de règles
(séries, types d'objets, slugs) et écrit dans pack_cards ; une carte peut être dans plusieurs boosters.
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


class RuleIn(BaseModel):
    """Une règle de contenu : une carte correspond si elle satisfait tous les filtres renseignés."""
    series: list[str] | None = None
    types: list[str] | None = None
    objets: list[str] | None = None

    @model_validator(mode="after")
    def not_empty(self):
        if not (self.series or self.types or self.objets):
            raise ValueError("une règle de contenu doit filtrer sur series, types ou objets")
        return self


class ThemedBoosterIn(BoosterIn):
    serie: str
    description: str = ""
    contenu: list[RuleIn] = Field(min_length=1)


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
    boosters: list[ThemedBoosterIn] = []


def themed_pools(cat: Catalog) -> dict[str, list[tuple[str, int, str]]]:
    """Contenu de chaque booster à thème : liste de (code série, numéro, rareté), dans l'ordre du catalogue."""
    types = {o.slug: o.type for o in cat.objets}
    out: dict[str, list[tuple[str, int, str]]] = {}
    for b in cat.boosters:
        pool = []
        for sf in cat.series:
            for c in sf.cartes:
                t = types.get(c.objet)
                if any((r.series is None or sf.serie.code in r.series)
                       and (r.types is None or t in r.types)
                       and (r.objets is None or c.objet in r.objets) for r in b.contenu):
                    pool.append((sf.serie.code, c.numero, c.rarete))
        out[b.code] = pool
    return out


def load_catalog(catalog_dir: Path = config.CATALOG_DIR, media_dir: Path = config.MEDIA_DIR) -> Catalog:
    """Lit et valide tout le catalogue. Lève ValueError avec la liste des problèmes."""
    errors: list[str] = []
    try:
        objets = yaml.safe_load((catalog_dir / "objects.yaml").read_text(encoding="utf-8"))["objets"]
        series = [yaml.safe_load(f.read_text(encoding="utf-8")) for f in sorted((catalog_dir / "series").glob("*.yaml"))]
        bfile = catalog_dir / "boosters.yaml"
        boosters = yaml.safe_load(bfile.read_text(encoding="utf-8"))["boosters"] if bfile.is_file() else []
        cat = Catalog(objets=objets, series=series, boosters=boosters)
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
    errors += _check_themed(cat, media_dir)
    if errors:
        raise ValueError("catalogue invalide :\n- " + "\n- ".join(errors))
    return cat


def _check_themed(cat: Catalog, media_dir: Path) -> list[str]:
    """Boosters à thème : règles cohérentes, contenu suffisant, et aucune carte orpheline."""
    errors: list[str] = []
    if not cat.boosters:
        return errors
    series_codes = {s.serie.code for s in cat.series}
    known_types = {o.type for o in cat.objets}
    known_slugs = {o.slug for o in cat.objets}
    all_codes = [b.code for sf in cat.series for b in sf.boosters] + [b.code for b in cat.boosters]
    dup = sorted({c for c in all_codes if all_codes.count(c) > 1})
    if dup:
        errors.append(f"codes de booster en double : {dup}")
    pools = themed_pools(cat)
    for b in cat.boosters:
        if b.serie not in series_codes:
            errors.append(f"{b.code} : série de rattachement inconnue « {b.serie} »")
        if b.image and not (media_dir / b.image).is_file():
            errors.append(f"{b.code} : image introuvable {b.image}")
        for r in b.contenu:
            errors += [f"{b.code} : série inconnue « {x} » dans le contenu" for x in r.series or [] if x not in series_codes]
            errors += [f"{b.code} : type d'objet inconnu « {x} »" for x in r.types or [] if x not in known_types]
            errors += [f"{b.code} : objet inconnu « {x} »" for x in r.objets or [] if x not in known_slugs]
        pool = pools[b.code]
        if len(pool) < b.nb_cartes:
            errors.append(f"{b.code} : contenu de {len(pool)} carte(s), moins que les {b.nb_cartes} du paquet")
        rarities = {r for _, _, r in pool}
        for s in b.emplacements:
            for r in s.taux:
                if r not in rarities:
                    errors.append(f"{b.code} emplacement {s.position} : aucune carte de rareté {r} dans son contenu")
    # chaque carte d'une série active doit pouvoir sortir d'au moins un booster à thème actif
    covered = {(sc, n) for b in cat.boosters if b.active for sc, n, _ in pools[b.code]}
    orphans = [(sf.serie.code, c.numero, c.objet) for sf in cat.series if sf.serie.active
               for c in sf.cartes if (sf.serie.code, c.numero) not in covered]
    if orphans:
        sample = ", ".join(f"{sc} n°{n} ({o})" for sc, n, o in orphans[:10])
        errors.append(f"{len(orphans)} carte(s) dans aucun booster à thème : {sample}{' …' if len(orphans) > 10 else ''}")
    return errors


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

        if cat.boosters:
            series_ids = {r["code"]: r["id"] for r in conn.execute("SELECT id, code FROM series").fetchall()}
            card_ids = {(r["code"], r["numero"]): r["id"] for r in conn.execute(
                "SELECT c.id, s.code, c.numero FROM cards c JOIN series s ON s.id = c.series_id WHERE NOT c.retired").fetchall()}
            pools = themed_pools(cat)
            stats["contenus"] = 0
            for b in cat.boosters:
                pid = conn.execute("""
                    INSERT INTO pack_types (series_id, code, nom, nb_cartes, image, active, description)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (code) DO UPDATE SET series_id = EXCLUDED.series_id, nom = EXCLUDED.nom,
                        nb_cartes = EXCLUDED.nb_cartes, image = EXCLUDED.image, active = EXCLUDED.active,
                        description = EXCLUDED.description
                    RETURNING id""", (series_ids[b.serie], b.code, b.nom, b.nb_cartes, b.image, b.active, b.description)).fetchone()["id"]
                conn.execute("DELETE FROM pack_slots WHERE pack_type_id = %s", (pid,))
                for slot in b.emplacements:
                    for r, p in slot.taux.items():
                        conn.execute("INSERT INTO pack_slots (pack_type_id, position, rarete, probabilite) VALUES (%s, %s, %s, %s)",
                                     (pid, slot.position, r, p))
                ids = [card_ids[(sc, n)] for sc, n, _ in pools[b.code]]
                conn.execute("DELETE FROM pack_cards WHERE pack_type_id = %s", (pid,))
                conn.execute("INSERT INTO pack_cards (pack_type_id, card_id) SELECT %s, unnest(%s::int[])", (pid, ids))
                stats["boosters"] += 1
                stats["contenus"] += len(ids)
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
    if cat.boosters:
        pools = themed_pools(cat)
        shared = n_cards and sum(len(p) for p in pools.values()) - len({(s, n) for p in pools.values() for s, n, _ in p})
        for b in cat.boosters:
            print(f"  {b.code:4} {b.nom:<20} {len(pools[b.code]):>5} cartes")
        print(f"  ({shared} présences en plus d'une carte dans plusieurs boosters)")
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
