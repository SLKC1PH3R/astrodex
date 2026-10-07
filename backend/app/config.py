import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://astrodex:astrodex@localhost:5432/astrodex")
# Dossier du catalogue (objects.yaml, series/*.yaml, images/)
CATALOG_DIR = Path(os.environ.get("CATALOG_DIR", ROOT.parent / "catalog"))
MEDIA_DIR = Path(os.environ.get("MEDIA_DIR", CATALOG_DIR / "images"))
MIGRATIONS_DIR = Path(os.environ.get("MIGRATIONS_DIR", ROOT / "migrations"))
# Importer le catalogue YAML à chaque démarrage (idempotent)
IMPORT_CATALOG_ON_START = os.environ.get("IMPORT_CATALOG_ON_START", "true").lower() == "true"
# Boosters gratuits par joueur sur 24 h glissantes (0 = illimité)
PACKS_PER_DAY = int(os.environ.get("PACKS_PER_DAY", "0"))
CORS_ORIGINS = [o for o in os.environ.get("CORS_ORIGINS", "").split(",") if o]
