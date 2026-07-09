-- Demote legacy Steam-collection grouping tags to regular tags.
--
-- Old versions created a YukiG collection per Steam Collection (with the
-- description "Steam collection: <name>"), and migration 015 turned those
-- collections into grouping tags. Under the current model a Steam Collection is
-- a regular tag, not a grouping — so it should not appear as a collection card
-- on the Games page. Steam sync already creates these as regular tags going
-- forward; this migration reclassifies the historical ones.
--
-- Item membership (item_tags) is left untouched: games keep the tag, it simply
-- becomes a plain label instead of a group. The system "Steam" grouping
-- (steam-system) is preserved — it is the home for all Steam games.

UPDATE tags
SET tag_type = 'regular',
    icon = '',
    description = '',
    sort_order = 0
WHERE tag_type = 'grouping'
  AND id != 'steam-system'
  AND description LIKE 'Steam collection:%';
