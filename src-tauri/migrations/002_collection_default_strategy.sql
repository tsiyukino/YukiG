-- Add default_strategy column to collections.
-- Stores the strategy type that is pre-selected when adding items to this collection.
-- Empty string means no default (user must choose).
ALTER TABLE collections ADD COLUMN default_strategy TEXT NOT NULL DEFAULT '';
