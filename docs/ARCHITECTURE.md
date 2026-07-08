# Architecture

## Overview

YukiFileManager is a Tauri v2 desktop application with a React + TypeScript frontend and a Rust backend. The backend manages all data through SQLite. The frontend is stateless — it always reads from the database via Tauri commands.

## Module Boundaries

```
Frontend (React/TypeScript)           Backend (Rust)
─────────────────────────────         ──────────────────────────────
pages/          ← route components    commands/     ← thin IPC layer
components/     ← shared UI           db/queries/   ← pure SQL
hooks/          ← data + state        db/models/    ← Rust structs
services/       ← invoke() wrappers   strategies/   ← FolderStrategy impls
types/          ← TypeScript types    services/     ← business logic
utils/          ← pure functions      errors.rs     ← shared errors
```

## Data Flow

```
User action → React component
  → hook (useCollections, useItems, …)
  → services/tauriCommands.ts [invoke()]
  → Tauri IPC boundary
  → commands/*.rs [thin handler]
  → db/queries/*.rs [SQL]
  → SQLite database
  → Result<T, String> back through the chain
  → React state update → re-render
```

## Key Architectural Decisions

1. **Single Mutex connection**: SQLite is accessed through a `Mutex<Connection>`. Simple, no connection pool needed for a single-user desktop app.
2. **Strategy registry**: Strategies are registered at startup in `StrategyRegistry`. Adding a new strategy requires no changes to the command layer.
3. **Tray behavior**: On `CloseRequested`, the window is hidden via `api.prevent_close()` + `window.hide()`. The Rust backend and tray icon keep running. Left-clicking the tray icon calls `show_or_create_window`, which un-hides and focuses the window (or recreates it if it was fully destroyed). The tray has **no native menu**: right-clicking shows a custom Steam-style popup — a frameless, transparent, always-on-top webview window (label `tray-menu`, pre-created hidden at startup) that renders `src/tray/TrayMenuApp.tsx` via the `?window=tray` entry in `main.tsx`. The popup lists the 5 most recently played games (local + Steam merged, ordered by the newer of `last_launched` / `steam_last_played` via `db/queries/recent_queries.rs`), then Open / Quit. Data is pulled fresh on every open (no push refresh). Geometry is split cleanly: the frontend measures its own content and calls `tray_menu_present(width, height)`; Rust (`tray.rs` + `commands/tray_commands.rs`) anchors the popup at the recorded click point, clamps to the monitor, shows, and focuses it; focus loss hides it. Clicking a game launches through `services/launcher.rs` — no main webview required.
4. **All invoke() through tauriCommands.ts**: Enforces a single point of backend communication. Enables easy mocking and type safety.
5. **Migrations on startup**: SQL migration files in `src-tauri/migrations/` are applied automatically. The `schema_migrations` table tracks applied migrations.
6. **Passive playtime tracking**: local-game sessions are measured by `services/process_tracker.rs`, which watches the launched process tree from the *outside* — parent-PID links to adopt descendants, plus SYNCHRONIZE handle waits (`WaitForMultipleObjects`) so a process exit is detected immediately rather than on the next poll. Creation-time checks guard against PID reuse. Launched games are never placed in a Job Object or otherwise constrained: launchers that hook process creation (Mod Organizer 2 / usvfs) break when trapped inside an inherited job.
7. **Live "now playing" state**: `services/session_registry.rs` holds an in-memory `item_id → started_at` map — the source of truth for which games are running right now, queryable via `session_get_active` and pushed live via the `play-session-started` / `play-session-ended` Tauri events. It must live in the backend because the tray flow destroys the webview (React state cannot persist). Two independent producers feed it: the local `process_tracker` (games YukiG launched) and `services/steam_running.rs`, which watches `HKCU\Software\Valve\Steam\RunningAppID` via `RegNotifyChangeKeyValue` and maps the running app id back to a library item through `steam_app_id` metadata. Both emit the same events, so the frontend treats local and Steam games uniformly. This is distinct from the `play_sessions` **table**, which is the *durable* session history for stats; the launcher writes both.
7. **Launch logic lives in `services/launcher.rs`**: `launch_tracked(app, item_id)` resolves the item from the database, dispatches the strategy's launch action, tracks the process tree, and persists playtime metadata. Both the `strategy_execute_launch_tracked` command and the tray menu call it — callers pass only an item id, keeping the command layer thin and the tray webview-independent. All launch paths are tracked; the old untracked launch command was removed.
8. **Custom context menus**: the native WebView2 context menu is suppressed globally by `ContextMenuProvider` (mounted in `AppShell`), which owns the single open menu. Elements attach per-element menus via `useContextMenu()` / `useItemContextMenu()`; menu contents are plain data (`MenuContent`), so the menu system knows nothing about domain types.

## State Management

No external state library. React component state + custom hooks. The database is the source of truth — React state is ephemeral UI state only.

## Styling Architecture

Three layers, established in the 2026-07 frontend redesign:

1. **Design tokens** (`src/styles/tokens.css`) — primitive color ramps and the semantic layer (colors, type scale, spacing, radii, shadows, motion). Components consume semantic tokens only. The user-configurable accent color overrides `--color-accent` at runtime (`useAppPrefs.applyAccentColor`); the default accent is left to the token layer so dark mode gets its lighter variant.
2. **CSS Modules** — every component owns a co-located `<Name>.module.css`; feature-shared modules exist for forms, settings, and status. Exception: the steam feature's `steam.css` (see `docs/decisions/2026-07-06_steam-css-exception.md`).
3. **Global** (`src/styles/global.css`) — reset, base elements, shared keyframes only. Self-hosted variable fonts (Geist, Sora) are imported in `main.tsx`.

## Phase Roadmap

- **Phase 1**: Foundation (current) — scaffold, DB, collection CRUD, home screen
- **Phase 2**: Items and strategies — item CRUD, GameStrategy, DocumentStrategy, detail views
- **Phase 3**: Organization — tags, FTS5 search, sort
- **Phase 4**: System integration — tray (hide-on-close, restore-on-click), thumbnail caching, file preview (image/text/PDF inline), file watcher (`notify` crate, `file-changed` events)
- **Phase 5**: Polish — dark mode, drag-and-drop, keyboard shortcuts
