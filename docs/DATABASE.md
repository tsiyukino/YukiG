# Database

## Engine

SQLite with WAL mode, bundled via the `rusqlite` crate (`features = ["bundled"]`). Database file: `{app_data_dir}/filevault.db`.

## Connection

Single `Mutex<Connection>` stored as Tauri managed state (`DbConnection`). WAL mode and foreign key enforcement enabled via pragmas on startup.

## Migration System

- Migration files: `src-tauri/migrations/NNN_name.sql`
- Applied in order on every app startup
- Tracking table: `schema_migrations(name TEXT PRIMARY KEY, applied_at TEXT)`
- Each migration runs in a transaction — failure leaves the DB unchanged

### Applied Migrations

| File | Status | Description |
|---|---|---|
| `001_initial.sql` | Applied | Core tables + FTS5 triggers |
| `002_collection_default_strategy.sql` | Applied | `default_strategy` column on collections |
| `003_item_notes.sql` | Applied | `notes TEXT NOT NULL DEFAULT ''` column on items |
| `004_rebuild_fts.sql` | Applied | Rebuild FTS index |
| `005_fix_fts.sql` | Applied | Recreate `fts_items` as a standalone table + new triggers |
| `006_tag_groups.sql` | Applied | `tag_groups` table + `group_id` column on tags |
| `007_item_parent.sql` | Applied | `parent_id` column on items (virtual folders/groups) |
| `008_item_category.sql` | Applied | `category` column on items |
| `009_item_favorite.sql` | Applied | `is_favorite` column on items |
| `010_steam_games.sql` | Applied | `steam_imports` table |
| `011_play_sessions.sql` | Applied | `play_sessions` table |
| `012_game_status.sql` | Applied | `game_status` table + `tag_type` column on `tags` |
| `013_nullable_collection.sql` | Applied | Items rebuild: `collection_id` nullable (NULL = unfiled), FK → SET NULL |
| `014_steam_system_collection.sql` | Applied | Fixed system "Steam" collection (`id = 'steam-system'`) |
| `015_collections_to_grouping_tags.sql` | Applied | Mirrored collections into `grouping` tags (direction later reverted) |
| `016_demote_steam_collection_groupings.sql` | Applied | Demoted legacy "Steam collection:" groupings to regular tags |
| `017_remove_grouping_tags.sql` | Applied | Removed grouping tags and the `icon`/`description`/`sort_order` tag columns (015 revert) |

## Schema

### collections

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | TEXT | PRIMARY KEY | UUID v4 |
| name | TEXT | NOT NULL, UNIQUE | Display name |
| icon | TEXT | NOT NULL DEFAULT 'folder' | Icon identifier |
| color | TEXT | NOT NULL DEFAULT '#6366f1' | Hex color |
| description | TEXT | NOT NULL DEFAULT '' | Optional description |
| sort_order | INTEGER | NOT NULL DEFAULT 0 | Manual sort position |
| created_at | TEXT | NOT NULL | ISO 8601 (RFC 3339) |
| updated_at | TEXT | NOT NULL | ISO 8601 (RFC 3339) |

### items

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | TEXT | PRIMARY KEY | UUID v4 |
| collection_id | TEXT | NOT NULL, FK → collections.id CASCADE | Parent collection |
| name | TEXT | NOT NULL | Display name |
| folder_path | TEXT | NOT NULL | Absolute path |
| strategy_type | TEXT | NOT NULL | e.g. "game", "document" |
| description | TEXT | NOT NULL DEFAULT '' | User description |
| notes | TEXT | NOT NULL DEFAULT '' | Free-form inline notes (editable in detail view) |
| thumbnail_path | TEXT | NULL | Cached thumbnail path |
| sort_order | INTEGER | NOT NULL DEFAULT 0 | Manual sort position |
| created_at | TEXT | NOT NULL | ISO 8601 |
| updated_at | TEXT | NOT NULL | ISO 8601 |

### strategy_metadata

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | TEXT | PRIMARY KEY | UUID v4 |
| item_id | TEXT | NOT NULL, FK → items.id CASCADE | Parent item |
| key | TEXT | NOT NULL | e.g. "exe_path", "mod_folder" |
| value | TEXT | NOT NULL | Metadata value |
| UNIQUE(item_id, key) | | | One value per key per item |

### tags

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | TEXT | PRIMARY KEY | UUID v4 |
| name | TEXT | NOT NULL, UNIQUE | Tag display name |
| color | TEXT | NOT NULL DEFAULT '#94a3b8' | Hex color |
| group_id | TEXT | NULL, FK → tag_groups.id SET NULL | Owning tag group, NULL = ungrouped |
| tag_type | TEXT | NOT NULL DEFAULT 'regular' | `regular \| category \| functional \| element \| mood` |

### tag_groups

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | TEXT | PRIMARY KEY | UUID v4 |
| name | TEXT | NOT NULL, UNIQUE | Group display name |
| prefix | TEXT | NOT NULL DEFAULT '' | Free-form prefix string (e.g. "genre:") |
| sort_order | INTEGER | NOT NULL DEFAULT 0 | Manual sort position |
| created_at | TEXT | NOT NULL | ISO 8601 |

### item_tags

| Column | Type | Constraints | Description |
|---|---|---|---|
| item_id | TEXT | NOT NULL, FK → items.id CASCADE | |
| tag_id | TEXT | NOT NULL, FK → tags.id CASCADE | |
| PRIMARY KEY(item_id, tag_id) | | | |

### play_sessions

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | TEXT | PRIMARY KEY | UUID v4 |
| item_id | TEXT | NOT NULL, FK → items.id CASCADE | Parent item |
| started_at | TEXT | NOT NULL | ISO 8601 UTC |
| ended_at | TEXT | NULL | ISO 8601 UTC; NULL while session is in progress |

### game_status

| Column | Type | Constraints | Description |
|---|---|---|---|
| item_id | TEXT | PRIMARY KEY, FK → items.id CASCADE | |
| story_status | TEXT | NOT NULL DEFAULT 'unplayed' | `unplayed \| playing \| on_hold \| snoozed \| completed \| abandoned` |
| online_status | TEXT | NOT NULL DEFAULT 'inactive' | `inactive \| active \| snoozed` |
| snooze_until | TEXT | NULL | ISO 8601; only meaningful when snoozed |

### fts_items (FTS5 virtual table)

Covers `name` and `description` from the `items` table. Three triggers (`items_ai`, `items_ad`, `items_au`) keep the index in sync automatically.

## Quirks

- FTS5 query syntax: user input must be escaped before passing to FTS5 (see `search_queries::sanitize_fts_query`). Wrapping in double quotes treats input as a phrase match.
- `rusqlite` dynamic parameters: When building queries with a dynamic number of parameters, use `Vec<Box<dyn rusqlite::ToSql>>` and collect refs before passing to `execute`. See `collection_queries::update` for the pattern.
