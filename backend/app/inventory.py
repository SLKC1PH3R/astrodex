"""Déplacements de cartes entre collections (échanges, marché, recyclage). À appeler dans une transaction."""
from __future__ import annotations

from fastapi import HTTPException

# Éclats gagnés en recyclant un exemplaire, selon la rareté
RECYCLE_VALUE = {"C": 5, "PC": 10, "R": 25, "UR": 80, "L": 250}


def owned(conn, player_id, card_id, *, lock: bool = False) -> int:
    row = conn.execute("SELECT quantite FROM player_cards WHERE player_id = %s AND card_id = %s" + (" FOR UPDATE" if lock else ""),
                       (player_id, card_id)).fetchone()
    return row["quantite"] if row else 0


def take(conn, player_id, card_id, qty: int = 1, *, error: str = "Carte absente de la collection") -> None:
    """Retire qty exemplaires de la collection ; la ligne disparaît quand il n'en reste plus."""
    have = owned(conn, player_id, card_id, lock=True)
    if have < qty:
        raise HTTPException(409, error)
    if have == qty:
        conn.execute("DELETE FROM player_cards WHERE player_id = %s AND card_id = %s", (player_id, card_id))
    else:
        conn.execute("UPDATE player_cards SET quantite = quantite - %s WHERE player_id = %s AND card_id = %s", (qty, player_id, card_id))


def give(conn, player_id, card_id, qty: int = 1) -> None:
    conn.execute("""INSERT INTO player_cards (player_id, card_id, quantite) VALUES (%s, %s, %s)
                    ON CONFLICT (player_id, card_id) DO UPDATE SET quantite = player_cards.quantite + EXCLUDED.quantite""",
                 (player_id, card_id, qty))


def add_eclats(conn, player_id, amount: int) -> int:
    return conn.execute("UPDATE players SET eclats = eclats + %s WHERE id = %s RETURNING eclats", (amount, player_id)).fetchone()["eclats"]
