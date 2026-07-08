# Troubleshooting

## Build Issues

### `create-tauri-app` fails with "not a terminal"
The scaffolding CLI requires an interactive TTY and cannot be run in non-interactive shells. The project was bootstrapped manually instead. Do not attempt to re-run `create-tauri-app` in this directory.

### `create-tauri-app` fails with "Directory is not empty"
Expected — the project is already scaffolded. Ignore.

### `rusqlite` fails to compile — missing C++ build tools
Install Microsoft C++ Build Tools from Visual Studio Installer. Ensure the "Desktop development with C++" workload is selected.

## Runtime Issues

### Window does not appear on startup
Check that WebView2 Runtime is installed. It ships with Windows 11 but may be missing on fresh Windows 10 installs.

### Database not found / migration error on first launch
The app data directory is created automatically. If it fails, check write permissions for `%APPDATA%\filevault`. The error will appear in the Tauri console.

### `PluginInitialization("dialog", ...)` panic on startup
Tauri v2 plugin config in `tauri.conf.json` requires plugins that take no config to be **omitted entirely** from the `plugins` object. Setting them to `{}` causes a deserialization panic. Affected plugins: `dialog`, `opener`. Keep only plugins that require config (e.g. `shell`) in the `plugins` block.

### `@rollup/rollup-win32-x64-msvc` not found (Vite fails to start)
npm has a bug with optional native bindings — they are sometimes skipped during install. Fixed by adding the binding to `optionalDependencies` in `package.json`. If it recurs, run `npm install @rollup/rollup-win32-x64-msvc` manually.

### `invalid args 'someSnakeKey' for command` — missing required key
Tauri v2 maps Rust `snake_case` parameter names to `camelCase` on the JavaScript side. When calling `invoke()`, always pass camelCase keys:
- `collection_id` → `collectionId`
- `folder_path` → `folderPath`
- `strategy_type` → `strategyType`
- `item_id` → `itemId`
- `sort_order` → `sortOrder`

Single-word params (`id`, `name`, `query`) are unaffected. This applies to **incoming** command args only — response structs serialized from Rust use snake_case as-is (no `rename_all` on the models).

### Dropping a file/folder from Explorer does not open the Add Item modal
**Root cause**: The previous implementation used WebView2's `NavigationStarting` event to detect drops (intercepting `file://` navigations). This only fires for *files*, not folders — WebView2 does not attempt to navigate when a folder is dropped.

**Fix**: `services/file_drop.rs` now registers a Win32 OLE `IDropTarget` directly on the window HWND using `RegisterDragDrop`. This receives drops for both files and folders. The `IDropTarget::Drop` implementation reads the path from the `IDataObject` via `CF_HDROP`/`DragQueryFileW` and emits the `file-dropped` Tauri event.

### `#[implement]` macro fails with "windows_core not in scope" or "two versions of windows_core"
Caused by a version mismatch between the `windows` crate and `webview2-com`. The `#[implement]` proc macro expands to code referencing `windows_core`, so both must agree on the same version. Fix: use `windows = "0.61"` and `windows-core = "0.61"` to match `webview2-com = "0.38"` (which internally uses `windows 0.61`).

### FTS5 search returns no results
FTS5 queries are phrase-matched (wrapped in double quotes). Partial prefix search (e.g. `game*`) is not currently supported. This is a known limitation of the phrase-match sanitization approach.

### Steam images missing for newer games (header, capsule, logo all 404)
**Root cause**: Steamworks switched to content-addressed asset URLs for games published after ~2023. Assets like `header.jpg`, `library_600x900.jpg`, and `logo.png` are no longer served at the flat `cdn.cloudflare.steamstatic.com/steam/apps/{id}/{file}` path. Instead they live at `shared.akamai.steamstatic.com/store_item_assets/steam/apps/{id}/{sha1_hash}/{file}`.

The hash paths are stored in `appinfo.vdf` under `common → library_assets_full → {asset} → image → english` (and `common → header_image → english` for the header).

**Fix**: `services/steam.rs` now parses these nested tables from `appinfo.vdf` and constructs Akamai URLs when hash paths are present, falling back to the legacy CDN for older games. `library_hero.jpg` is still reliably available at the flat path for all games.

Note: `icon_url` (community icon, `common → "icon"` hash) is unaffected — it uses a separate CDN path that is not content-addressed and works for all games.

### Component styles bleed between pages (class name collisions)
**Root cause**: before the 2026-07 redesign, pages injected `<style>` blocks with global class names. Once any stylesheet is statically bundled (Vite extracts all imported CSS into one file), same-named classes from different features collide — e.g. SettingsPage and the steam feature both defined `.sp-btn` / `.sp-tab`, so whichever rule came later in the bundle won.

**Fix / prevention**: all components use CSS Modules now (scoped names, collisions impossible). The one remaining global sheet is `src/components/steam/steam.css` (`sp-*` / `sdt-*` prefixes) — do not reuse those prefixes anywhere else, and move classes into modules when reworking steam components.

### CSS module class typos fail silently
`styles.someTypo` compiles fine and renders `undefined` as the class name — TypeScript does not validate CSS module keys. If a component suddenly loses styling after a rename, diff the module file's class names against the `styles.*` references first.

### Launching Mod Organizer 2 from YukiG breaks SKSE / modded games misbehave
**Root cause**: playtime tracking used to spawn the exe inside a Windows Job Object (`CREATE_SUSPENDED` + `AssignProcessToJobObject`). Job membership is inherited by everything MO2 spawns — skse64_loader, the game, usvfs proxy processes — and the job was created without breakaway permissions, so any child calling `CreateProcess` with `CREATE_BREAKAWAY_FROM_JOB` failed with Access Denied; hook-based launchers are generally sensitive to running inside a foreign job. Additionally, neither launch path set a working directory, so children inherited YukiG's own cwd and resolved DLLs/INIs relative to the wrong folder.

**Fix**: `strategy_execute_launch_tracked` now spawns the game as a plain detached process with the working directory set to the exe's folder, and measures the session with `services/process_tracker.rs` — passive process-table polling that follows parent-PID links (creation-time checks guard against PID reuse). Nothing is injected or inherited, so launch behavior is identical to double-clicking the exe.

**Known limitation**: if a launcher starts the game through an *already-running* third process (e.g. MO2 configured to launch via `steam://`), the parent chain breaks and the session ends when the launcher exits. Directly spawned chains (MO2 → skse64_loader → game) track correctly.

### Game exe_path silently changes after playing (e.g. ModOrganizer.exe → helper.exe)
**Symptom**: after launching a game (especially through Mod Organizer 2) a few times, its configured executable flips to a different `.exe` in the same folder and the game no longer launches. Previously only fixable by deleting and re-adding the item.

**Root cause**: `GameItemView` called `rescan()` after every launch to refresh playtime. A rescan runs `GameStrategy::scan`, which picks the **first `.exe` by directory order** as `exe_path`, and the scan result was persisted with `upsert_all` — overwriting the user's choice. MO2 generates `helper.exe` at runtime; it sorts before `ModOrganizer.exe` (`h` < `M`), so once it lands on disk every rescan replaced the launch target.

**Fix** (two layers):
1. `GameItemView` now calls `refresh()` (re-reads metadata only) instead of `rescan()` after launch — a launch never re-scans the filesystem. See `useStrategy`'s `refresh` vs `rescan`.
2. `strategy_scan` persists via `strategy_metadata_queries::insert_missing` (`ON CONFLICT DO NOTHING`) instead of `upsert_all`, so even an explicit manual rescan fills only absent keys and never clobbers a user-set `exe_path`.

**Recovering an already-broken item**: open the game's detail page and set the executable back to the correct exe once. It will no longer change.
