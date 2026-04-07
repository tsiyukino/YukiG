-- Adds parent_id to items to support virtual folder/group hierarchy.
-- A NULL parent_id means the item is at the collection root.
-- A non-NULL parent_id references a virtual_folder or virtual_group item.

ALTER TABLE items ADD COLUMN parent_id TEXT REFERENCES items(id) ON DELETE SET NULL;
