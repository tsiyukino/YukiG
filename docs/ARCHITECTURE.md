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
3. **Tray behavior**: On `CloseRequested`, the window is hidden via `api.prevent_close()` + `window.hide()`. The Rust backend and tray icon keep running. Left-clicking the tray icon or selecting "Open YukiFileManager" from the right-click menu calls `show_or_create_window`, which un-hides and focuses the window (or recreates it if it was fully destroyed).
4. **All invoke() through tauriCommands.ts**: Enforces a single point of backend communication. Enables easy mocking and type safety.
5. **Migrations on startup**: SQL migration files in `src-tauri/migrations/` are applied automatically. The `schema_migrations` table tracks applied migrations.

## State Management

No external state library. React component state + custom hooks. The database is the source of truth — React state is ephemeral UI state only.

## Phase Roadmap

- **Phase 1**: Foundation (current) — scaffold, DB, collection CRUD, home screen
- **Phase 2**: Items and strategies — item CRUD, GameStrategy, DocumentStrategy, detail views
- **Phase 3**: Organization — tags, FTS5 search, sort
- **Phase 4**: System integration — tray (hide-on-close, restore-on-click), thumbnail caching, file preview (image/text/PDF inline), file watcher (`notify` crate, `file-changed` events)
- **Phase 5**: Polish — dark mode, drag-and-drop, keyboard shortcuts
