-- Fix the historical Steam-collection reclassification missed by migration 018.
--
-- Migration 018 tried to reclassify Steam-collection tags to the
-- `steam_collection` type but keyed off the wrong colour: it assumed the current
-- code's `#66c0f4`, whereas the older sync scheme created collection tags as
-- plain `regular` tags coloured `#1b2838` (Steam's dark blue). So every
-- pre-existing collection stayed `regular` and dropped out of the Steam page
-- sidebar, landing games in "Steam — Uncategorized".
--
-- The reliable signal for a historical collection tag is: colour `#1b2838`,
-- type `regular`, and assigned to at least one `steam_game` item — excluding the
-- system placeholder "Steam — Uncategorized", which shares the colour but is not
-- a real collection. Category/feature tags use their own distinct colours, so
-- they are not caught. Going forward, sync reclassifies collection tags directly
-- (upsert_reclassify), so no colour guessing is needed again.

UPDATE tags
SET tag_type = 'steam_collection'
WHERE tag_type = 'regular'
  AND color = '#1b2838'
  AND name <> 'Steam — Uncategorized'
  AND id IN (
      SELECT DISTINCT it.tag_id
      FROM item_tags it
      JOIN items i ON i.id = it.item_id
      WHERE i.strategy_type = 'steam_game'
  );
