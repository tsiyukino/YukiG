/// Tauri command handlers for read-only folder browsing (detail views).
use std::path::Path;

use crate::services::fs_browse::{self, ImageEntry, TreeNode};

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

/// Reads a folder tree up to `max_depth` levels, capped in size.
///
/// Backs the Mods file-tree preview on the game detail page.
///
/// # Errors
/// Returns an error string if the path is missing, not a directory, or
/// unreadable.
#[tauri::command]
pub fn folder_tree(path: String, max_depth: u32) -> Result<TreeNode, String> {
    fs_browse::dir_tree(Path::new(&path), max_depth).map_err(|e| e.to_string())
}
