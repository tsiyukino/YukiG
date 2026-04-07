-- Adds a category column to items for fast display without joining strategy_metadata.
-- For "file" strategy items this is the detected file category (e.g. "image", "pdf").
-- For all other strategies it is an empty string.
ALTER TABLE items ADD COLUMN category TEXT NOT NULL DEFAULT '';
