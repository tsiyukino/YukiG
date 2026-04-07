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
