-- Give Steam Collections their own tag type.
--
-- Steam sync maps each Steam Collection (the user's in-Steam grouping) to a tag
-- so a game can belong to several at once. Until now those were created as plain
-- 'regular' tags, indistinguishable from user-authored tags — the Steam page had
-- to guess which tags were collections by their fixed blue-grey colour.
--
-- This one-time migration reclassifies the historical ones to 'steam_collection'
-- using that same colour as the only available signal, restricted to tags that
-- are actually assigned to a steam_game item (so a user tag that merely happens
-- to share the colour is not caught). Going forward, sync writes the type
-- directly, so no colour guessing is ever needed again.

UPDATE tags
SET tag_type = 'steam_collection'
WHERE tag_type = 'regular'
  AND color = '#66c0f4'
  AND id IN (
      SELECT DISTINCT it.tag_id
      FROM item_tags it
      JOIN items i ON i.id = it.item_id
      WHERE i.strategy_type = 'steam_game'
  );
