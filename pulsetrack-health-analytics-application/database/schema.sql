CREATE TABLE IF NOT EXISTS health_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL UNIQUE,
    steps INTEGER NOT NULL CHECK (steps >= 0 AND steps <= 200000),
    calories INTEGER NOT NULL CHECK (calories >= 0 AND calories <= 20000),
    sleep REAL NOT NULL CHECK (sleep >= 0 AND sleep <= 24),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
