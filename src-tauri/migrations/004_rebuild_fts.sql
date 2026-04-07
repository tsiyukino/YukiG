-- Re-populate the FTS5 index from scratch to ensure all existing items are indexed.
-- We delete all rows from the shadow tables via the special 'delete-all' command,
-- then reinsert every item manually. This avoids the content-table rebuild bug
-- where FTS5 generates invalid SQL for UNINDEXED columns like item_id.
INSERT INTO fts_items(fts_items) VALUES ('delete-all');

INSERT INTO fts_items(rowid, item_id, name, description)
SELECT rowid, id, name, description FROM items;
