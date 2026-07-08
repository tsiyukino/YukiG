-- Make items.collection_id nullable so an item can live in the library
-- without belonging to a user collection.
--
-- This decouples "in the library" (a row in items) from "in a collection"
-- (collection_id set). Steam library games become library items with a null
-- collection_id, so they are trackable and searchable without polluting the
-- collection views. The FK also changes from ON DELETE CASCADE to ON DELETE
-- SET NULL: deleting a collection no longer deletes the games in it, it just
-- unfiles them.
--
-- SQLite cannot drop a NOT NULL constraint or alter a FK in place, so the
-- table is rebuilt. The dependent triggers reference items by id/name only, so
-- they are dropped and recreated verbatim against the new table.
--
-- The migration runner disables foreign_keys for the whole run, so DROP TABLE
-- here does not cascade-delete child rows (strategy_metadata, item_tags,
-- play_sessions, game_status), and it re-checks all references afterward.

DROP TRIGGER IF EXISTS items_ai;
DROP TRIGGER IF EXISTS items_ad;
DROP TRIGGER IF EXISTS items_au;

CREATE TABLE items_new (
    id              TEXT    PRIMARY KEY NOT NULL,
    collection_id   TEXT    REFERENCES collections(id) ON DELETE SET NULL,
    parent_id       TEXT    REFERENCES items(id) ON DELETE SET NULL,
    name            TEXT    NOT NULL,
    folder_path     TEXT    NOT NULL,
    strategy_type   TEXT    NOT NULL,
    description     TEXT    NOT NULL DEFAULT '',
    notes           TEXT    NOT NULL DEFAULT '',
    category        TEXT    NOT NULL DEFAULT '',
    thumbnail_path  TEXT,
    is_favorite     INTEGER NOT NULL DEFAULT 0,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT    NOT NULL,
    updated_at      TEXT    NOT NULL
);

INSERT INTO items_new (
    id, collection_id, parent_id, name, folder_path, strategy_type,
    description, notes, category, thumbnail_path, is_favorite, sort_order,
    created_at, updated_at
)
SELECT
    id, collection_id, parent_id, name, folder_path, strategy_type,
    description, notes, category, thumbnail_path, is_favorite, sort_order,
    created_at, updated_at
FROM items;

DROP TABLE items;
ALTER TABLE items_new RENAME TO items;

CREATE TRIGGER items_ai AFTER INSERT ON items BEGIN
    INSERT INTO fts_items(item_id, name, description)
    VALUES (new.id, new.name, new.description);
END;

CREATE TRIGGER items_ad AFTER DELETE ON items BEGIN
    DELETE FROM fts_items WHERE item_id = old.id;
END;

CREATE TRIGGER items_au AFTER UPDATE ON items BEGIN
    DELETE FROM fts_items WHERE item_id = old.id;
    INSERT INTO fts_items(item_id, name, description)
    VALUES (new.id, new.name, new.description);
END;
