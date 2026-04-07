/// Background file watcher service.
///
/// Watches registered item folders for external changes (create, modify, delete,
/// rename) and emits a `file-changed` Tauri event to all frontend windows.
///
/// Each item is tracked by its UUID. The watcher state is stored as Tauri
/// managed state (`WatcherState`) so commands can register/deregister paths.
///
/// ## Event payload
/// ```json
/// { "item_id": "<uuid>", "folder_path": "<path>", "kind": "modify" }
/// ```
/// `kind` is one of `"create"`, `"modify"`, `"remove"`, `"rename"`, `"other"`.
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use notify::{Config, Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use tauri::{AppHandle, Emitter};
use thiserror::Error;

/// Errors that can occur in the file watcher.
#[derive(Debug, Error)]
pub enum WatcherError {
    #[error("Notify error: {0}")]
    Notify(#[from] notify::Error),
    #[error("Watcher lock poisoned")]
    LockPoisoned,
}

/// Payload emitted as the `file-changed` Tauri event.
#[derive(Debug, Clone, Serialize)]
pub struct FileChangedEvent {
    /// UUID of the item whose folder changed.
    pub item_id: String,
    /// Absolute path to the watched folder.
    pub folder_path: String,
    /// Kind of change: "create", "modify", "remove", "rename", or "other".
    pub kind: String,
}

/// Per-item watcher entry kept alive to prevent the watcher from dropping.
struct WatchEntry {
    _watcher: RecommendedWatcher,
    // Stored for potential future use (e.g. listing active watches via a command).
    #[allow(dead_code)]
    folder_path: PathBuf,
}

/// Tauri managed state holding all active watchers.
///
/// Each item UUID maps to one `WatchEntry`. The inner `Arc<Mutex<...>>` allows
/// the `notify` callback closure to share the app handle safely.
pub struct WatcherState {
    entries: Mutex<HashMap<String, WatchEntry>>,
}

impl WatcherState {
    /// Creates an empty watcher state. Called once at app setup.
    pub fn new() -> Self {
        Self {
            entries: Mutex::new(HashMap::new()),
        }
    }
}

/// Begins watching `folder_path` for the item identified by `item_id`.
///
/// If the item was already being watched, the old watcher is replaced.
/// Changes inside the folder emit `file-changed` events to the frontend.
///
/// # Errors
/// Returns `WatcherError::Notify` if the OS watcher cannot be initialised.
/// Returns `WatcherError::LockPoisoned` if the internal mutex is poisoned.
pub fn add(
    state: &WatcherState,
    app: AppHandle,
    item_id: String,
    folder_path: PathBuf,
) -> Result<(), WatcherError> {
    let item_id_clone = item_id.clone();
    let folder_path_clone = folder_path.clone();

    // Wrap the app handle so the closure can capture it.
    let app = Arc::new(app);

    let watcher_app = Arc::clone(&app);
    let mut watcher = RecommendedWatcher::new(
        move |result: notify::Result<Event>| {
            if let Ok(event) = result {
                let kind = classify_event(&event.kind);
                let payload = FileChangedEvent {
                    item_id: item_id_clone.clone(),
                    folder_path: folder_path_clone.display().to_string(),
                    kind,
                };
                // Best-effort emit — ignore errors (window may be hidden).
                let _ = watcher_app.emit("file-changed", &payload);
            }
        },
        Config::default(),
    )?;

    watcher.watch(&folder_path, RecursiveMode::Recursive)?;

    let mut entries = state
        .entries
        .lock()
        .map_err(|_| WatcherError::LockPoisoned)?;

    entries.insert(
        item_id,
        WatchEntry {
            _watcher: watcher,
            folder_path,
        },
    );

    Ok(())
}

/// Stops watching the folder for the item identified by `item_id`.
///
/// Silently succeeds if the item was not being watched.
///
/// # Errors
/// Returns `WatcherError::LockPoisoned` if the internal mutex is poisoned.
pub fn remove(state: &WatcherState, item_id: &str) -> Result<(), WatcherError> {
    let mut entries = state
        .entries
        .lock()
        .map_err(|_| WatcherError::LockPoisoned)?;
    entries.remove(item_id);
    Ok(())
}

// ─── Internal helpers ────────────────────────────────────────────────────────

/// Maps a `notify` `EventKind` to a simple string label for the frontend.
fn classify_event(kind: &EventKind) -> String {
    match kind {
        EventKind::Create(_) => "create",
        EventKind::Modify(_) => "modify",
        EventKind::Remove(_) => "remove",
        EventKind::Access(_) => "other",
        EventKind::Other => "other",
        _ => "other",
    }
    .to_string()
}
