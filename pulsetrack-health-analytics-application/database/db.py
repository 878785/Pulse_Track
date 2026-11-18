"""SQLite connection and persistence helpers for PulseTrack."""

import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parent.parent
DATABASE_PATH = Path(
    os.environ.get("PULSETRACK_DATABASE", str(ROOT_DIR / "data" / "pulsetrack.db"))
).resolve()
DATA_DIR = DATABASE_PATH.parent
SCHEMA_PATH = Path(__file__).with_name("schema.sql")


@contextmanager
def get_connection():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DATABASE_PATH, timeout=10)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def initialize_database():
    with get_connection() as connection:
        connection.executescript(SCHEMA_PATH.read_text(encoding="utf-8"))


def fetch_all_records():
    with get_connection() as connection:
        rows = connection.execute(
            "SELECT id, date, steps, calories, sleep FROM health_records ORDER BY date, id"
        ).fetchall()
    return [dict(row) for row in rows]


def fetch_record_by_date(date):
    with get_connection() as connection:
        row = connection.execute(
            "SELECT id, date, steps, calories, sleep FROM health_records WHERE date = ?",
            (date,),
        ).fetchone()
    return dict(row) if row else None


def insert_record(record):
    with get_connection() as connection:
        cursor = connection.execute(
            "INSERT INTO health_records (date, steps, calories, sleep) VALUES (?, ?, ?, ?)",
            (record["date"], record["steps"], record["calories"], record["sleep"]),
        )
        return cursor.lastrowid


def update_record(record_id, record):
    with get_connection() as connection:
        cursor = connection.execute(
            """UPDATE health_records
               SET date = ?, steps = ?, calories = ?, sleep = ?, updated_at = CURRENT_TIMESTAMP
               WHERE id = ?""",
            (record["date"], record["steps"], record["calories"], record["sleep"], record_id),
        )
        return cursor.rowcount > 0


def delete_record(record_id):
    with get_connection() as connection:
        cursor = connection.execute("DELETE FROM health_records WHERE id = ?", (record_id,))
        return cursor.rowcount > 0


def delete_all_records():
    with get_connection() as connection:
        connection.execute("DELETE FROM health_records")


def record_count():
    with get_connection() as connection:
        return connection.execute("SELECT COUNT(*) FROM health_records").fetchone()[0]


def last_saved_at():
    with get_connection() as connection:
        row = connection.execute("SELECT MAX(updated_at) FROM health_records").fetchone()
    return row[0]
