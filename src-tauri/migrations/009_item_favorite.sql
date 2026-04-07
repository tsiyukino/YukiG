-- Migration 009: add is_favorite column to items table.
-- Favorites are a display-only concept: items with is_favorite = 1 are surfaced
-- in a virtual "Favorites" group at the top of the collection view.
ALTER TABLE items ADD COLUMN is_favorite INTEGER NOT NULL DEFAULT 0;
