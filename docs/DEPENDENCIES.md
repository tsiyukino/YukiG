# Dependencies

## Rust (Cargo)

### `tauri = "2"` + `features = ["tray-icon", "image-png"]`
Core Tauri v2 framework. `tray-icon` enables system tray; `image-png` required for PNG tray icons on Windows.

### `tauri-plugin-dialog = "2"`
File and folder picker dialogs. Used for the add-item flow (folder selection). Must be initialized with `tauri_plugin_dialog::init()` in `lib.rs`.

**Quirk — tauri.conf.json**: Do NOT include `"dialog": {}` in the `plugins` block. Tauri v2 deserializes plugin config strictly; an empty object causes a panic at startup (`invalid type: map, expected unit`). Omit the key entirely if there is no config.

### `tauri-plugin-opener = "2"`
Opens files/URLs with the system default app. Used by DocumentStrategy's launch action. Must be initialized with `tauri_plugin_opener::init()`.

**Quirk — tauri.conf.json**: Same as dialog — omit from `plugins` block if no config is needed.

### `tauri-plugin-shell = "2"`
Shell command execution. Initialized with `tauri_plugin_shell::init()`.

**Config**: Requires `"shell": { "open": true }` in the `plugins` block of `tauri.conf.json` to allow opening URLs/files.

**Quirk — launching game executables**: `Command.create` from the frontend requires the command to be declared in `tauri.conf.json` under `"shell": { "scope": [...] }`. Since game exe paths are dynamic (user-chosen), they cannot be pre-declared. **Solution**: launch exes from the Rust backend via `std::process::Command::new(exe_path).spawn()` inside `services/launcher.rs` (`launch_tracked`). This bypasses the allowlist requirement because the backend is fully trusted.

### `rusqlite = "0.32"` + `features = ["bundled"]`
SQLite bindings. `bundled` compiles SQLite from source, avoiding system library dependency. This is required on Windows to avoid missing DLL issues.

**Quirk — dynamic parameters**: `rusqlite` does not support `Vec<&dyn ToSql>` directly from a `Vec<Box<dyn ToSql>>`. Must collect refs: `let param_refs: Vec<&dyn ToSql> = params.iter().map(|p| p.as_ref()).collect();` then pass `.as_slice()`.

### `uuid = "1"` + `features = ["v4"]`
UUID generation for primary keys. All IDs are UUID v4 strings.

### `chrono = "0.4"` + `features = ["serde"]`
Date/time handling. Used for `created_at` / `updated_at` fields (RFC 3339 format). Serde feature enables serialization.

### `thiserror = "2"`
Derive macro for custom error types. Every module defines its own error enum using `#[derive(thiserror::Error)]`.

### `serde = "1"` + `features = ["derive"]` + `serde_json = "1"`
Serialization. Required by Tauri for passing data across the IPC boundary.

### `notify = "7"` + `features = ["macos_kqueue"]`
Cross-platform filesystem event watching. Used by `services/file_watcher.rs` to detect external changes to item folders and emit `file-changed` Tauri events.

**Quirk — feature flag**: The `macos_kqueue` feature is required to compile on macOS. On Windows it is a no-op but must be present to avoid compile errors on cross-platform builds.

**Quirk — recursive mode**: Use `RecursiveMode::Recursive` to catch changes in nested subdirectories. `NonRecursive` only fires for the immediate folder children.

**Quirk — event noise**: Access events (`EventKind::Access`) fire frequently (e.g. on antivirus scans). The `classify_event` helper maps these to `"other"` so the frontend can ignore them if desired.

**Quirk — watcher lifetime**: The `RecommendedWatcher` must be kept alive for as long as watching is active. It is stored inside `WatchEntry` in the `WatcherState` mutex; dropping the entry stops the watch automatically.

### `windows = "0.61"` (Windows only)
Win32 API bindings. Used in `services/file_drop.rs` for the OLE `IDropTarget` implementation and in `commands/icon_commands.rs` for GDI icon extraction.

**Version constraint**: Must match the version used internally by `webview2-com`. When `webview2-com = "0.38"` is present, `windows` must be `"0.61"` and `windows-core` must be `"0.61"` to avoid duplicate-crate conflicts with the `#[implement]` proc macro. Upgrading either crate in isolation will likely break compilation.

**Required features**: `Win32_UI_Shell`, `Win32_UI_WindowsAndMessaging`, `Win32_Graphics_Gdi`, `Win32_Foundation`, `Win32_Storage_FileSystem`, `Win32_System_Com`, `Win32_System_Com_StructuredStorage` (for `STGMEDIUM`), `Win32_System_Ole` (for `IDropTarget`, `RegisterDragDrop`, `CF_HDROP`).

**API differences from 0.58 → 0.61**: Several GDI functions changed to take `Option<HWND>`/`Option<HDC>` instead of bare handles. `HBRUSH`/`HBITMAP` must be cast `.into()` for `DeleteObject`. `GetDC(None)` replaces `GetDC(HWND(null_mut()))`.

### `webview2-com = "0.38"` (Windows only)
WebView2 COM bindings. Used in `services/file_drop.rs` to call `ICoreWebView2Controller4::SetAllowExternalDrop(true)`, which enables browser-level `dragenter`/`dragover`/`drop` DOM events for external files (used for the drop overlay animation). Internally depends on `windows = "0.61"`.

### `image = "0.25"` + `default-features = false, features = ["jpeg", "png", "webp", "gif", "bmp"]`
Image decoding and resizing. Used only by `services/image_thumb.rs` to generate cached screenshot thumbnails. Default features are off — enable exactly the formats `fs_browse::IMAGE_EXTS` lists, since the crate pulls a heavy dependency tree per format and enabling all of them noticeably inflates build time and binary size.

**Quirk — canvas is not an option in the webview**: an earlier attempt downscaled screenshots with a `<canvas>` on the frontend. `toDataURL` on an image loaded via the Tauri asset protocol trips cross-origin tainting and silently fails, so thumbnailing must happen in Rust. Generate on Tauri's blocking pool (`spawn_blocking`) — decoding on the async runtime's core threads would stall other commands.

## npm Packages

### `@tauri-apps/api = "^2"`
JavaScript bindings for Tauri v2 core APIs (including `invoke`). Always use `@tauri-apps/api/core` for `invoke`.

**Drag-and-drop file events**: We keep `"dragDropEnabled": false` in `tauri.conf.json` so HTML5 `draggable` reordering works without interference. External file/folder drops from Explorer are handled by a custom Win32 `IDropTarget` registered in Rust (`services/file_drop.rs`), which emits a `file-dropped` Tauri event with the path. The frontend listens with `listen("file-dropped", ...)` from `@tauri-apps/api/event`. See `src/hooks/useDragDrop.ts`.

### `@tauri-apps/plugin-dialog = "^2"`
Frontend bindings for the dialog plugin.

### `@tauri-apps/plugin-opener = "^2"`
Frontend bindings for the opener plugin.

### `@tauri-apps/plugin-shell = "^2"`
Frontend bindings for the shell plugin.

### `react = "^18"` + `react-dom = "^18"`
React 18 with concurrent features.

### `react-router-dom = "^6"`
Client-side routing. Using `BrowserRouter` + `Routes`/`Route`.

### `lucide-react = "^0.469"`
Icon set. All icons in the app come from Lucide. Import by name: `import { FolderOpen } from "lucide-react"`.

### `@fontsource-variable/geist = "^5"` + `@fontsource-variable/sora = "^5"`
Self-hosted variable fonts, bundled into the app at build time (no network fetch — the app must render correctly offline). Imported once in `src/main.tsx`; registered family names are `"Geist Variable"` (body, `--font-sans`) and `"Sora Variable"` (display headings/numbers, `--font-display`).

**Quirk — family names**: The fontsource variable packages register the family with a ` Variable` suffix. `font-family: "Geist"` will silently fall back to the system stack; it must be `"Geist Variable"`.

### `vite = "^6"` + `@vitejs/plugin-react = "^4"`
Build tool and React plugin. Configured in `vite.config.ts`.

### `typescript = "^5"`
TypeScript compiler. `strict` mode enabled.
