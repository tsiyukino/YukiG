-- Migrate collections into grouping tags.
--
-- Collections become the "grouping" tag type: same organisational role, but
-- many-to-many (a game can be in several groups) and unified with the tag
-- system. Tags gain icon / description / sort_order so a grouping tag carries
-- everything a collection card needs (the cover mosaic is generated from member
-- games, so no cover column is needed).
--
-- Name collisions: tags.name and collections.name are both UNIQUE but separate.
-- If a tag already shares a collection's name, it is reused (promoted to
-- grouping) rather than duplicated. So the migration is: promote matching tags
-- first, then insert grouping tags only for collections with no name match,
-- then rebuild membership in item_tags from items.collection_id.
--
-- collections and items.collection_id are left in place for now (read-only
-- legacy); a later migration drops them once all code reads grouping tags.

ALTER TABLE tags ADD COLUMN icon TEXT NOT NULL DEFAULT '';
ALTER TABLE tags ADD COLUMN description TEXT NOT NULL DEFAULT '';
ALTER TABLE tags ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;

-- 1. Promote existing tags whose name matches a collection: adopt the
--    collection's colour/icon/description/sort order and mark them grouping.
UPDATE tags
SET tag_type = 'grouping',
    color = (SELECT c.color FROM collections c WHERE c.name = tags.name),
    icon = (SELECT c.icon FROM collections c WHERE c.name = tags.name),
    description = (SELECT c.description FROM collections c WHERE c.name = tags.name),
    sort_order = (SELECT c.sort_order FROM collections c WHERE c.name = tags.name)
WHERE name IN (SELECT name FROM collections);

-- 2. Insert grouping tags for collections that had no matching tag. The tag id
--    reuses the collection id so membership rebuild (step 3) can join directly.
INSERT INTO tags (id, name, color, group_id, tag_type, icon, description, sort_order)
SELECT c.id, c.name, c.color, NULL, 'grouping', c.icon, c.description, c.sort_order
FROM collections c
WHERE c.name NOT IN (SELECT name FROM tags);

-- 3. Rebuild membership: every item's collection_id becomes an item_tags row
--    pointing at the grouping tag for that collection (matched by name, which
--    is unique on both sides). INSERT OR IGNORE tolerates any pre-existing row.
INSERT OR IGNORE INTO item_tags (item_id, tag_id)
SELECT i.id, t.id
FROM items i
JOIN collections c ON c.id = i.collection_id
JOIN tags t ON t.name = c.name
WHERE i.collection_id IS NOT NULL;
