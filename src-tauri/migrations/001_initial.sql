-- Initial schema for YukiFileManager
-- Creates the core tables: collections, items, strategy_metadata, tags, item_tags

CREATE TABLE collections (
    id          TEXT    PRIMARY KEY NOT NULL,
    name        TEXT    NOT NULL UNIQUE,
    icon        TEXT    NOT NULL DEFAULT 'folder',
    color       TEXT    NOT NULL DEFAULT '#6366f1',
    description TEXT    NOT NULL DEFAULT '',
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT    NOT NULL,
    updated_at  TEXT    NOT NULL
);

CREATE TABLE items (
    id              TEXT    PRIMARY KEY NOT NULL,
    collection_id   TEXT    NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    name            TEXT    NOT NULL,
    folder_path     TEXT    NOT NULL,
    strategy_type   TEXT    NOT NULL,
    description     TEXT    NOT NULL DEFAULT '',
    thumbnail_path  TEXT,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT    NOT NULL,
    updated_at      TEXT    NOT NULL
);

CREATE TABLE strategy_metadata (
    id      TEXT    PRIMARY KEY NOT NULL,
    item_id TEXT    NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    key     TEXT    NOT NULL,
    value   TEXT    NOT NULL,
    UNIQUE(item_id, key)
);

CREATE TABLE tags (
    id      TEXT    PRIMARY KEY NOT NULL,
    name    TEXT    NOT NULL UNIQUE,
    color   TEXT    NOT NULL DEFAULT '#94a3b8'
);

CREATE TABLE item_tags (
    item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    tag_id  TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (item_id, tag_id)
);

-- Full-text search virtual table covering item names and descriptions
CREATE VIRTUAL TABLE fts_items USING fts5(
    item_id UNINDEXED,
    name,
    description,
    content='items',
    content_rowid='rowid'
);

-- Keep FTS index in sync with the items table
CREATE TRIGGER items_ai AFTER INSERT ON items BEGIN
    INSERT INTO fts_items(rowid, item_id, name, description)
    VALUES (new.rowid, new.id, new.name, new.description);
END;

CREATE TRIGGER items_ad AFTER DELETE ON items BEGIN
    INSERT INTO fts_items(fts_items, rowid, item_id, name, description)
    VALUES ('delete', old.rowid, old.id, old.name, old.description);
END;

CREATE TRIGGER items_au AFTER UPDATE ON items BEGIN
    INSERT INTO fts_items(fts_items, rowid, item_id, name, description)
    VALUES ('delete', old.rowid, old.id, old.name, old.description);
    INSERT INTO fts_items(rowid, item_id, name, description)
    VALUES (new.rowid, new.id, new.name, new.description);
END;
