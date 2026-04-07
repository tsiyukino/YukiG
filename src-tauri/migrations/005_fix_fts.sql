-- Fix the broken FTS5 table.
--
-- The original fts_items was created as a content table (content='items') with
-- item_id as UNINDEXED. FTS5 content tables generate internal SQL that references
-- all columns including UNINDEXED ones via a table alias, which produces the error
-- "no such column: T.item_id" whenever SQLite tries to use the content table path.
--
-- Fix: drop everything FTS-related and recreate fts_items as a standalone (non-
-- content) FTS5 table. The triggers continue to manage inserts/deletes manually,
-- so the index stays in sync without any content-table magic.

-- Drop old triggers first (they reference the old fts_items schema).
DROP TRIGGER IF EXISTS items_ai;
DROP TRIGGER IF EXISTS items_ad;
DROP TRIGGER IF EXISTS items_au;

-- Drop the broken FTS table.
DROP TABLE IF EXISTS fts_items;

-- Recreate as a standalone FTS5 table (no content= or content_rowid=).
-- item_id is stored as a plain indexed column so we can JOIN back to items.
CREATE VIRTUAL TABLE fts_items USING fts5(
    item_id,
    name,
    description,
    tokenize = 'unicode61'
);

-- Populate from current items.
INSERT INTO fts_items(item_id, name, description)
SELECT id, name, description FROM items;

-- Recreate triggers for ongoing sync.
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
