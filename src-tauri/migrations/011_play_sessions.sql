-- Migration 011: Play sessions table.
--
-- Records each play session as a (item_id, started_at, ended_at) row.
-- ended_at is NULL while the game is currently running and filled in on exit.
-- Duration is computed from the two timestamps; no separate duration column.

CREATE TABLE IF NOT EXISTS play_sessions (
    id          TEXT    NOT NULL PRIMARY KEY,
    item_id     TEXT    NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    started_at  TEXT    NOT NULL,  -- ISO 8601
    ended_at    TEXT                -- ISO 8601, NULL if in progress
);

CREATE INDEX IF NOT EXISTS idx_play_sessions_item_id ON play_sessions(item_id);
