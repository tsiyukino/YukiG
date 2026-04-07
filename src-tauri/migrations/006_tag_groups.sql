-- Tag groups: named groups with a user-set prefix string.
-- Tags can belong to a group (group_id FK), or be ungrouped (NULL).
--
-- The prefix is a free-form string the user assigns — it does NOT need to
-- match the group name. Example: name="Chemistry", prefix="chem:".

CREATE TABLE tag_groups (
    id         TEXT PRIMARY KEY NOT NULL,
    name       TEXT NOT NULL UNIQUE,
    prefix     TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);

-- Add group_id column to tags (nullable = ungrouped).
ALTER TABLE tags ADD COLUMN group_id TEXT REFERENCES tag_groups(id) ON DELETE SET NULL;
