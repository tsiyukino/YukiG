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

### `strategy_execute_launch_tracked`
- **Parameters**: `item_id: string`
- **Returns**: `number` — session length in whole seconds (0 for `open_with_default` actions)
- **Errors**: Unknown item or strategy; no launch action; process spawn failure; process snapshot failure
- **Owner**: `commands/strategy_commands.rs` (thin wrapper over `services/launcher.rs`)
- **Note**: Folder path and strategy type are resolved from the database — the frontend passes only the item id. For `run_exe`, spawns the exe as a plain detached process (working directory = exe's folder) and measures the session via `services/process_tracker.rs`, which polls the process table once per second and follows parent-PID links until the whole tree has exited. The game is **never placed in a Job Object** and inherits nothing from YukiG, so hook-based launchers (Mod Organizer 2 / usvfs) behave exactly as if double-clicked. On completion, persists `total_playtime_seconds` (authoritative), `total_playtime_minutes` (derived), and `last_launched` (Unix seconds) to `strategy_metadata`. This is the only launch command — the untracked `strategy_execute_launch` was removed when all launch paths switched to tracked launches.

### `game_launch_extra_exe`
- **Parameters**: `exe_path: string`
- **Returns**: `void`
- **Errors**: Process spawn failure
- **Owner**: `commands/strategy_commands.rs` (thin wrapper over `services/launcher.rs::launch_exe_untracked`)
- **Note**: Launches one of a game's extra executables (from the `extra_exes` metadata: server, config tool, …) detached with the exe's folder as working directory, **without** playtime tracking. Only the main `exe_path` (via `strategy_execute_launch_tracked`) counts toward playtime.

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

### `session_get_active`
- **Parameters**: none
- **Returns**: `ActiveSession[]` — `{ item_id, started_at }[]` (started_at is Unix seconds)
- **Owner**: `commands/play_session_commands.rs`
- **Note**: Reads the in-memory `SessionRegistry` (source of truth for live "now playing" state), not the `play_sessions` table. Covers local games launched via YukiG **and** Steam games detected through Steam's registry. Called by the frontend on window (re)creation to rebuild "now playing" badges, since the tray flow destroys the webview and its React state. Complements the `play-session-started` / `play-session-ended` Tauri events, which push live changes; see `docs/ARCHITECTURE.md`.

### `steam_get_running_appid`
- **Parameters**: none
- **Returns**: `number` — the Steam app id currently running, or 0 if none
- **Owner**: `commands/steam_commands.rs`
- **Note**: Reads the `steam_running` watcher's state (mirrors Steam's `RunningAppID`). Keyed by app id — independent of library import — so the Steam page can mark a running game whether launched from Steam or YukiG. Live updates arrive via the `steam-running-changed` event (payload: the app id, 0 = none).

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

## Tray Menu

All tray commands are invoked only from the tray-menu popup window (label `tray-menu`, the `?window=tray` entry). See `docs/ARCHITECTURE.md` § Key Architectural Decisions #3 for the popup lifecycle.

### `tray_get_recent_games`
- **Parameters**: none
- **Returns**: `RecentGame[]` — `{ id, name, strategy_type, thumbnail_path, icon_url }`, up to 5, most recently played first (newer of `last_launched` / `steam_last_played`)
- **Errors**: DB failure
- **Owner**: `commands/tray_commands.rs` (query in `db/queries/recent_queries.rs`)

### `tray_launch_item`
- **Parameters**: `item_id: string`
- **Returns**: `void` — resolves immediately (fire-and-forget)
- **Note**: Spawns `services/launcher.rs::launch_tracked` on the async runtime; playtime tracking continues after the popup hides. Launch failures are logged, not surfaced.
- **Owner**: `commands/tray_commands.rs`

### `tray_menu_present`
- **Parameters**: `width: number`, `height: number` — the frontend's measured content size in logical pixels
- **Returns**: `void`
- **Errors**: Menu window missing; window operation failure
- **Note**: Anchors the popup's bottom-right corner at the recorded tray-click point, clamps to the monitor under the cursor, then shows and focuses it.
- **Owner**: `commands/tray_commands.rs`

### `tray_menu_hide`
- **Parameters**: none
- **Returns**: `void`
- **Errors**: Menu window missing; hide failure
- **Owner**: `commands/tray_commands.rs`

### `tray_open_main`
- **Parameters**: none
- **Returns**: `void` — shows or recreates the main window
- **Owner**: `commands/tray_commands.rs`

### `tray_quit`
- **Parameters**: none
- **Returns**: never — exits the process
- **Owner**: `commands/tray_commands.rs`
