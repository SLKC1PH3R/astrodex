"""Connexion Postgres et migrations SQL versionnées (backend/migrations/NNN_nom.sql)."""
import logging

import psycopg
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from . import config

log = logging.getLogger("astrodex.db")
pool: ConnectionPool | None = None


def open_pool() -> ConnectionPool:
    global pool
    if pool is None:
        pool = ConnectionPool(config.DATABASE_URL, min_size=1, max_size=10,
                              kwargs={"row_factory": dict_row}, open=True)
        pool.wait(timeout=30)
    return pool


def close_pool() -> None:
    global pool
    if pool is not None:
        pool.close()
        pool = None


def connection():
    return open_pool().connection()


def migrate(conn: psycopg.Connection) -> list[str]:
    """Applique, dans l'ordre, les fichiers .sql pas encore appliqués. Chaque fichier = une transaction."""
    conn.execute("CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())")
    conn.commit()
    # verrou consultatif : deux réplicas qui démarrent ensemble ne migrent pas en même temps
    conn.execute("SELECT pg_advisory_lock(424242)")
    try:
        done = {r["version"] for r in conn.execute("SELECT version FROM schema_migrations").fetchall()}
        applied = []
        for f in sorted(config.MIGRATIONS_DIR.glob("*.sql")):
            if f.stem in done:
                continue
            with conn.transaction():
                conn.execute(f.read_text(encoding="utf-8"))
                conn.execute("INSERT INTO schema_migrations (version) VALUES (%s)", (f.stem,))
            log.info("migration appliquée : %s", f.stem)
            applied.append(f.stem)
        return applied
    finally:
        conn.execute("SELECT pg_advisory_unlock(424242)")
        conn.commit()
