/// Tauri command handlers for read-only folder browsing (detail views).
use std::path::Path;

use tauri::{AppHandle, Manager};

use crate::services::fs_browse::{self, DirListing, ImageEntry};
use crate::services::{config, image_thumb};

/// Lists the image files directly inside a folder, newest first.
///
/// Backs the Screenshots preview grid on the game detail page for any
/// user-set screenshots folder (local and Steam games alike).
///
/// # Errors
/// Returns an error string if the path is missing, not a directory, or
/// unreadable.
#[tauri::command]
pub fn folder_list_images(path: String) -> Result<Vec<ImageEntry>, String> {
    fs_browse::list_images(Path::new(&path)).map_err(|e| e.to_string())
}

/// Lists one directory's direct children (non-recursive).
///
/// Backs the Mods file-tree preview: the frontend calls this for the root
/// folder, then again for each directory the user expands, so a deep mod
/// folder is never walked several levels up front.
///
/// # Errors
/// Returns an error string if the path is missing, not a directory, or
/// unreadable.
#[tauri::command]
pub fn folder_children(path: String) -> Result<DirListing, String> {
    fs_browse::dir_children(Path::new(&path)).map_err(|e| e.to_string())
}

/// Returns the cached thumbnail path for a screenshot, generating it if needed.
///
/// The screenshots grid renders this small file instead of decoding the
/// full-resolution source in the webview. Cached under
/// `{data_dir}/screenshot_thumbs/`, keyed by the source path + size + mtime, so
/// an edited screenshot regenerates automatically. Runs on Tauri's blocking
/// pool so decoding never stalls the UI thread.
///
/// # Errors
/// Returns an error string if the source is missing or cannot be decoded.
#[tauri::command]
pub async fn screenshot_thumb(app: AppHandle, path: String) -> Result<String, String> {
    let default_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let config_dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    let cfg = config::read(&config_dir).unwrap_or_default();
    let data_dir = config::resolve_data_dir(&cfg, &default_data_dir);
    let cache_dir = data_dir.join("screenshot_thumbs");

    // Decoding/resizing is CPU-bound; keep it off the async runtime's core.
    tauri::async_runtime::spawn_blocking(move || {
        image_thumb::get_or_generate(Path::new(&path), &cache_dir)
            .map(|p| p.to_string_lossy().into_owned())
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}
