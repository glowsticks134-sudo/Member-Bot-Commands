"""Gecko opt-in announcement subscriber storage (SQLite)."""
from __future__ import annotations

import sqlite3
from contextlib import closing

from .config import SUBSCRIBERS_DB


def db_init() -> None:
    with closing(sqlite3.connect(SUBSCRIBERS_DB)) as con, con:
        con.execute(
            """
            CREATE TABLE IF NOT EXISTS subscribers (
                guild_id INTEGER NOT NULL,
                user_id  INTEGER NOT NULL,
                PRIMARY KEY (guild_id, user_id)
            )
            """
        )


def db_add(guild_id: int, user_id: int) -> bool:
    with closing(sqlite3.connect(SUBSCRIBERS_DB)) as con, con:
        cur = con.execute(
            "INSERT OR IGNORE INTO subscribers (guild_id, user_id) VALUES (?, ?)",
            (guild_id, user_id),
        )
        return cur.rowcount > 0


def db_remove(guild_id: int, user_id: int) -> bool:
    with closing(sqlite3.connect(SUBSCRIBERS_DB)) as con, con:
        cur = con.execute(
            "DELETE FROM subscribers WHERE guild_id = ? AND user_id = ?",
            (guild_id, user_id),
        )
        return cur.rowcount > 0


def db_list(guild_id: int) -> list[int]:
    with closing(sqlite3.connect(SUBSCRIBERS_DB)) as con:
        rows = con.execute(
            "SELECT user_id FROM subscribers WHERE guild_id = ?",
            (guild_id,),
        ).fetchall()
    return [r[0] for r in rows]


def db_count(guild_id: int) -> int:
    with closing(sqlite3.connect(SUBSCRIBERS_DB)) as con:
        (n,) = con.execute(
            "SELECT COUNT(*) FROM subscribers WHERE guild_id = ?",
            (guild_id,),
        ).fetchone()
    return n
