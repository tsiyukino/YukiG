-- Migration 010: Steam game import tracking table.
--
-- Tracks which Steam app IDs have been imported into YukiG so that
-- re-imports can skip duplicates. Each row links a Steam appid to the
-- YukiG item that was created for it.

CREATE TABLE IF NOT EXISTS steam_imports (
    app_id      INTEGER NOT NULL,
    item_id     TEXT    NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    PRIMARY KEY (app_id)
);
