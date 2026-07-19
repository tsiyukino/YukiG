-- Remove the grouping tag type — collections are collections again.
--
-- Migration 015 mirrored every collection into a "grouping" tag (reusing the
-- collection id) and synthesized item_tags membership from items.collection_id.
-- That direction was reverted: the app reads collections and items.collection_id
-- directly again, so the mirrored tags are dead data.
--
-- 1. Delete grouping tags whose id matches a collection (the mirrors created by
--    015, including the system 'steam-system' tag) together with their
--    item_tags rows. Memberships are deleted explicitly because migrations run
--    with foreign keys off, so ON DELETE CASCADE does not fire.
-- 2. Demote any remaining grouping tags back to regular. These are pre-existing
--    user tags that 015 promoted because their name matched a collection; their
--    membership is kept, since genuine pre-015 assignments cannot be told apart
--    from synthesized ones.
-- 3. Rebuild the tags table without icon / description / sort_order — those
--    columns existed only so a grouping tag could carry collection-card data.

DELETE FROM item_tags
WHERE tag_id IN (
    SELECT id FROM tags
    WHERE tag_type = 'grouping'
      AND id IN (SELECT id FROM collections)
);

DELETE FROM tags
WHERE tag_type = 'grouping'
  AND id IN (SELECT id FROM collections);

UPDATE tags SET tag_type = 'regular' WHERE tag_type = 'grouping';

CREATE TABLE tags_new (
    id       TEXT PRIMARY KEY NOT NULL,
    name     TEXT NOT NULL UNIQUE,
    color    TEXT NOT NULL DEFAULT '#94a3b8',
    group_id TEXT REFERENCES tag_groups(id) ON DELETE SET NULL,
    tag_type TEXT NOT NULL DEFAULT 'regular'
);

INSERT INTO tags_new (id, name, color, group_id, tag_type)
SELECT id, name, color, group_id, tag_type FROM tags;

DROP TABLE tags;
ALTER TABLE tags_new RENAME TO tags;
