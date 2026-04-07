# Tauri Commands API

All commands return `Result<T, String>` (Tauri requirement). Error strings are forwarded from the underlying `rusqlite::Error` or `AppError`.

## Collections

### `collection_get_all`
- **Parameters**: none
- **Returns**: `Collection[]`
- **Owner**: `commands/collection_commands.rs`

### `collection_get_by_id`
- **Parameters**: `id: string`
- **Returns**: `Collection`
- **Errors**: "Query returned no rows" if id not found
- **Owner**: `commands/collection_commands.rs`

### `collection_create`
- **Parameters**: `name: string`, `icon: string`, `color: string`, `description: string`
- **Returns**: `Collection`
- **Errors**: UNIQUE constraint error if name taken
- **Owner**: `commands/collection_commands.rs`

### `collection_update`
- **Parameters**: `id: string`, `name?: string`, `icon?: string`, `color?: string`, `description?: string`, `sort_order?: number`
- **Returns**: `Collection`
- **Errors**: "Query returned no rows" if id not found; UNIQUE constraint if new name taken
- **Owner**: `commands/collection_commands.rs`

### `collection_delete`
- **Parameters**: `id: string`
- **Returns**: `void`
- **Owner**: `commands/collection_commands.rs`
- **Note**: Cascades to all items, strategy_metadata, and item_tags

## Items

### `item_get_by_collection`
- **Parameters**: `collection_id: string`
- **Returns**: `Item[]`
- **Owner**: `commands/item_commands.rs`

### `item_get_by_id`
- **Parameters**: `id: string`
- **Returns**: `Item`
- **Owner**: `commands/item_commands.rs`

### `item_create`
- **Parameters**: `collection_id: string`, `name: string`, `folder_path: string`, `strategy_type: string`, `description: string`
- **Returns**: `Item`
- **Owner**: `commands/item_commands.rs`

### `item_delete`
- **Parameters**: `id: string`
- **Returns**: `void`
- **Owner**: `commands/item_commands.rs`

## Tags

### `tag_get_all`
- **Parameters**: none
- **Returns**: `Tag[]`
- **Owner**: `commands/tag_commands.rs`

### `tag_create`
- **Parameters**: `name: string`, `color: string`
- **Returns**: `Tag`
- **Owner**: `commands/tag_commands.rs`

### `tag_delete`
- **Parameters**: `tag_id: string`
- **Returns**: `void`
- **Owner**: `commands/tag_commands.rs`
- **Note**: Cascades to all `item_tags` rows via FK

### `tag_get_by_item`
- **Parameters**: `item_id: string`
- **Returns**: `Tag[]` ordered alphabetically
- **Owner**: `commands/tag_commands.rs`

### `tag_get_by_collection`
- **Parameters**: `collection_id: string`
- **Returns**: `ItemTagRow[]` — `{ item_id, tag_id, tag_name, tag_color }[]`
- **Owner**: `commands/tag_commands.rs`
- **Note**: Used by CollectionPage to build the item→tag map in one query (avoids N+1)

### `tag_assign`
- **Parameters**: `item_id: string`, `tag_id: string`
- **Returns**: `void`
- **Owner**: `commands/tag_commands.rs`
- **Note**: No-ops if the assignment already exists (`INSERT OR IGNORE`)

### `tag_remove`
- **Parameters**: `item_id: string`, `tag_id: string`
- **Returns**: `void`
- **Owner**: `commands/tag_commands.rs`

## Strategies

### `strategy_list`
- **Parameters**: none
- **Returns**: `Array<{ strategy_type: string, display_name: string, group: string }>` — `group` is empty for top-level strategies; sub-strategies have `group = "<prefix>"` (e.g. `"files"` for `"files/image"`). Used by the frontend to build grouped `<optgroup>` dropdowns.
- **Owner**: `commands/strategy_commands.rs`

### `strategy_scan`
- **Parameters**: `item_id: string`, `folder_path: string`, `strategy_type: string`
- **Returns**: `ScanResult { metadata: Record<string, string>, summary: string }`
- **Errors**: Unknown strategy type; path not found; DB write failure
- **Owner**: `commands/strategy_commands.rs`
- **Note**: Persists scan metadata to `strategy_metadata` table. Used for manual rescan from item detail.

### `strategy_get_display_items`
- **Parameters**: `folder_path: string`, `strategy_type: string`
- **Returns**: `DisplayItem[]`
- **Errors**: Unknown strategy type; path not found
- **Owner**: `commands/strategy_commands.rs`

### `strategy_get_launch_action`
- **Parameters**: `item_id: string`, `folder_path: string`, `strategy_type: string`
- **Returns**: `LaunchAction | null` — `{ action_type: "run_exe" | "open_with_default", target_path: string }` or null
- **Errors**: Unknown strategy type; DB failure
- **Owner**: `commands/strategy_commands.rs`

### `strategy_execute_launch`
- **Parameters**: `item_id: string`, `folder_path: string`, `strategy_type: string`
- **Returns**: `void`
- **Errors**: Unknown strategy; no launch action; process spawn failure
- **Owner**: `commands/strategy_commands.rs`
- **Note**: For `run_exe`, spawns the exe via `std::process::Command` (detached). For `open_with_default`, uses `tauri-plugin-opener`. Runs on the Rust backend to avoid shell plugin allowlist requirements.

### `strategy_get_metadata_schema`
- **Parameters**: `strategy_type: string`
- **Returns**: `MetadataField[]` — `{ key, label, required, field_type: "file_path" | "folder_path" | "text" }[]`
- **Errors**: Unknown strategy type
- **Owner**: `commands/strategy_commands.rs`

### `strategy_get_metadata`
- **Parameters**: `item_id: string`
- **Returns**: `Record<string, string>` — key-value map of stored metadata
- **Errors**: DB failure
- **Owner**: `commands/strategy_commands.rs`

## Settings

### `settings_get_app_data_dir`
- **Parameters**: none
- **Returns**: `string` — absolute path to the app data directory
- **Owner**: `commands/settings_commands.rs`
- **Note**: On Windows resolves to `%APPDATA%\com.yukifilemanager.app\`. Used by the Settings page to display and open the data directory.

## Thumbnails

### `thumbnail_get`
- **Parameters**: `item_id: string`, `folder_path: string`
- **Returns**: `string | null` — absolute path to the cached thumbnail file, or `null` if no image found
- **Owner**: `commands/thumbnail_commands.rs`
- **Note**: Caches the first image file found at the top level of `folder_path` under `{app_data}/thumbnails/{item_id}.{ext}`. Returns the cached path on subsequent calls without rescanning. Frontend uses the returned path directly in `<img src="...">` (Tauri v2 serves app data files via the asset protocol).

## Preview

### `preview_get`
- **Parameters**: `file_path: string`
- **Returns**: `FilePreview { kind: "image"|"text"|"pdf"|"unsupported", content: string, mime_type: string, truncated: boolean }`
- **Owner**: `commands/preview_commands.rs`
- **Note**: For images and PDFs, `content` is base64-encoded. For text, `content` is raw UTF-8 truncated to 32 KiB. Frontend wraps images in a data URI: `data:{mime_type};base64,{content}`.

## Watcher

### `watcher_add`
- **Parameters**: `item_id: string`, `folder_path: string`
- **Returns**: `void`
- **Owner**: `commands/watcher_commands.rs`
- **Note**: Registers `folder_path` for OS-level file watching (recursive). When any file inside changes, emits a `file-changed` Tauri event with payload `{ item_id, folder_path, kind }`. Replaces any existing watch for the same `item_id`.

### `watcher_remove`
- **Parameters**: `item_id: string`
- **Returns**: `void`
- **Owner**: `commands/watcher_commands.rs`
- **Note**: Stops watching the folder for the given item. No-ops if not currently watched.

## Search

### `search_items`
- **Parameters**: `query: string`
- **Returns**: `Item[]` ordered by FTS5 relevance
- **Owner**: `commands/search_commands.rs`
- **Note**: Query is sanitized and wrapped in double quotes for phrase matching

## Play Sessions

### `session_start`
- **Parameters**: `item_id: string`
- **Returns**: `string` — new session UUID
- **Owner**: `commands/play_session_commands.rs`

### `session_end`
- **Parameters**: `session_id: string`
- **Returns**: `void`
- **Errors**: "Session not found" if id does not exist
- **Owner**: `commands/play_session_commands.rs`

### `session_get_by_item`
- **Parameters**: `item_id: string`
- **Returns**: `PlaySession[]` — `{ id, item_id, started_at, ended_at }[]`, newest first
- **Owner**: `commands/play_session_commands.rs`

## Game Status

### `game_status_get`
- **Parameters**: `item_id: string`
- **Returns**: `GameStatus` — `{ item_id, story_status, online_status, snooze_until }`
- **Note**: Returns default `unplayed`/`inactive` if no row exists (without inserting)
- **Owner**: `commands/game_status_commands.rs`

### `game_status_set`
- **Parameters**: `item_id: string`, `story_status: string`, `online_status: string`, `snooze_until: string | null`
- **Returns**: `GameStatus`
- **Owner**: `commands/game_status_commands.rs`

### `game_status_get_all`
- **Parameters**: none
- **Returns**: `GameStatus[]`
- **Owner**: `commands/game_status_commands.rs`

### `game_status_get_bulk`
- **Parameters**: `item_ids: string[]`
- **Returns**: `GameStatus[]` — only rows that exist; missing items are not included
- **Owner**: `commands/game_status_commands.rs`

### `game_status_bulk_init`
- **Parameters**: none
- **Returns**: `number` — count of rows inserted
- **Note**: Inserts default rows for all `game` and `steam_game` items without an existing row. Safe to call on every startup.
- **Owner**: `commands/game_status_commands.rs`
