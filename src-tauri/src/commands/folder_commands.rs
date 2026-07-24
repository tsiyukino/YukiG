/// Tauri command handlers for read-only folder browsing (detail views).
use std::path::Path;

use crate::services::fs_browse::{self, DirListing, ImageEntry};

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
