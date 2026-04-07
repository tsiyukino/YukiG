/// Tauri command handlers for the file watcher.
///
/// Allows the frontend to register item folders for change notifications.
/// When a watched folder changes, the backend emits a `file-changed` event
/// that the frontend `useFileWatcher` hook listens to.
use std::path::PathBuf;
use tauri::{AppHandle, State};

use crate::services::file_watcher::WatcherState;
use crate::services::file_watcher;

/// Begins watching `folder_path` for the item identified by `item_id`.
///
/// Replaces any existing watch for the same `item_id`. Changes inside the
/// folder cause the backend to emit `file-changed` events to all windows.
///
/// # Errors
/// Returns an error string if the OS watcher cannot be initialised.
#[tauri::command]
pub fn watcher_add(
    app: AppHandle,
    state: State<WatcherState>,
    item_id: String,
    folder_path: String,
) -> Result<(), String> {
    file_watcher::add(&state, app, item_id, PathBuf::from(folder_path))
        .map_err(|e| e.to_string())
}

/// Stops watching the folder for the item identified by `item_id`.
///
/// No-ops if the item was not being watched.
///
/// # Errors
/// Returns an error string if the internal state cannot be accessed.
#[tauri::command]
pub fn watcher_remove(
    state: State<WatcherState>,
    item_id: String,
) -> Result<(), String> {
    file_watcher::remove(&state, &item_id).map_err(|e| e.to_string())
}
