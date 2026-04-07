-- Migration 012: Game status and mood tag type.
--
-- game_status: stores the play-state for each item.
--   story_status: tracks single-player / narrative progress.
--   online_status: tracks live-service / multiplayer activity.
--   snooze_until: ISO 8601 timestamp; game is hidden from Play pool until this date.
--
-- tags.tag_type: distinguishes regular organisational tags from mood tags.
--   'regular' (default) — shown in tag pickers as usual.
--   'mood'              — shown in the mood filter on the Play page.

CREATE TABLE IF NOT EXISTS game_status (
    item_id         TEXT    NOT NULL PRIMARY KEY REFERENCES items(id) ON DELETE CASCADE,
    story_status    TEXT    NOT NULL DEFAULT 'unplayed',
    -- allowed values: unplayed | playing | on_hold | snoozed | completed | abandoned
    online_status   TEXT    NOT NULL DEFAULT 'inactive',
    -- allowed values: inactive | active | snoozed
    snooze_until    TEXT    NULL
    -- ISO 8601, only meaningful when story_status = 'snoozed' or online_status = 'snoozed'
);

ALTER TABLE tags ADD COLUMN tag_type TEXT NOT NULL DEFAULT 'regular';
-- allowed values: regular | mood
