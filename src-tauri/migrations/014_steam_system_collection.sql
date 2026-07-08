-- Create the fixed "Steam" system collection that all Steam library games are
-- filed under. Having a single, well-known collection (rather than one per
-- Steam Collection name) keeps the user's own collections clean while still
-- giving Steam games a home card on the dashboard.
--
-- The id is a fixed sentinel so code can reference it without a lookup. Steam
-- Collections (the user's in-Steam groupings) map to tags, not collections.
--
-- INSERT OR IGNORE makes this idempotent and harmless if a collection with this
-- id somehow already exists.

INSERT OR IGNORE INTO collections
    (id, name, icon, color, description, sort_order, created_at, updated_at, default_strategy)
VALUES (
    'steam-system',
    'Steam',
    'steam',
    '#1b2838',
    'Your Steam library, synced automatically.',
    -1,
    datetime('now'),
    datetime('now'),
    'steam_game'
);
