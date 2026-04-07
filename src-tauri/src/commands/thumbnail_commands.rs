/// Tauri command handlers for thumbnail operations.
///
/// Exposes thumbnail generation, manual thumbnail setting, and cache
/// invalidation to the frontend. Thumbnails are cached in
/// `{data_dir}/thumbnails/` and served via the Tauri asset protocol
/// (`convertFileSrc` on the frontend).
use std::path::Path;
use tauri::{AppHandle, Manager};
use tauri::State;

use crate::db::connection::DbConnection;
use crate::services::{config, thumbnail};

/// Returns the absolute path of the cached thumbnail for an item.
///
/// Generates and caches the thumbnail on first call. Subsequent calls return
/// the cached path immediately. Returns `null` if no image is found in the
/// item's folder (the frontend should show a fallback icon in that case).
///
/// Uses the user-configured data directory so thumbnails are always co-located
/// with the database regardless of any data directory migration.
///
/// # Errors
/// Returns an error string only on unexpected IO failures (not when no image
/// is found — that case returns `Ok(None)`).
#[tauri::command]
pub fn thumbnail_get(
    app: AppHandle,
    item_id: String,
    folder_path: String,
) -> Result<Option<String>, String> {
    let default_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let config_dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    let cfg = config::read(&config_dir).unwrap_or_default();
    let data_dir = config::resolve_data_dir(&cfg, &default_data_dir);
    let cache_dir = data_dir.join("thumbnails");

    match thumbnail::get_or_generate(Path::new(&folder_path), &item_id, &cache_dir) {
        Ok(path) => Ok(Some(path.to_string_lossy().into_owned())),
        Err(thumbnail::ThumbnailError::NoImageFound(_)) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

/// Copies a user-selected image file into the thumbnail cache for an item.
///
/// Replaces any existing cached thumbnail (auto-generated or previously set).
/// Saves the new cached path to the items table so collection cards pick it up.
/// Returns the absolute path of the new cached thumbnail so the frontend can
/// display it immediately via `convertFileSrc`.
///
/// # Errors
/// Returns an error string if the source file cannot be copied or the cache
/// directory cannot be created.
#[tauri::command]
pub fn thumbnail_set(
    app: AppHandle,
    db: State<DbConnection>,
    item_id: String,
    source_path: String,
) -> Result<String, String> {
    let default_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let config_dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    let cfg = config::read(&config_dir).unwrap_or_default();
    let data_dir = config::resolve_data_dir(&cfg, &default_data_dir);
    let cache_dir = data_dir.join("thumbnails");

    let cached = thumbnail::set_from_path(Path::new(&source_path), &item_id, &cache_dir)
        .map_err(|e| e.to_string())?;

    let path_str = cached.to_string_lossy().into_owned();

    // Persist the thumbnail path in the DB so collection card views pick it up.
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE items SET thumbnail_path = ?1 WHERE id = ?2",
        rusqlite::params![&path_str, &item_id],
    ).map_err(|e| e.to_string())?;

    Ok(path_str)
}
