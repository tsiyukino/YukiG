/// Tauri command handlers for strategy-specific operations.
///
/// These commands expose the folder strategy system to the frontend, allowing
/// it to list available strategies, scan folders, retrieve display items,
/// fetch launch actions, and query the metadata schema for each strategy.
use std::collections::HashMap;
use std::path::Path;
use tauri::State;

use crate::db::connection::DbConnection;
use crate::db::queries::strategy_metadata_queries;
use crate::services::launcher;
use crate::strategies::{DisplayItem, LaunchAction, MetadataField, ScanResult, StrategyRegistry};

/// Returns all registered strategy types, their display names, and their group.
///
/// Strategies whose `strategy_type` contains `/` are sub-strategies. The prefix
/// before `/` is returned as the `group` field (e.g. `"files"` for `"files/image"`).
/// Top-level strategies have an empty `group` field.
///
/// Used by the add-item flow to build a grouped strategy picker.
#[tauri::command]
pub fn strategy_list(registry: State<StrategyRegistry>) -> Vec<HashMap<String, String>> {
    registry
        .list()
        .into_iter()
        .map(|(strategy_type, display_name)| {
            let group = if let Some(idx) = strategy_type.find('/') {
                strategy_type[..idx].to_string()
            } else {
                String::new()
            };
            let mut m = HashMap::new();
            m.insert("strategy_type".to_string(), strategy_type.to_string());
            m.insert("display_name".to_string(), display_name.to_string());
            m.insert("group".to_string(), group);
            m
        })
        .collect()
}

/// Runs the strategy scan for the given folder path and returns the result.
///
/// Persists auto-detected metadata **non-destructively**: keys the item
/// already has (which may be user-set, e.g. an explicit `exe_path`) are kept;
/// only absent keys are filled in. This prevents a rescan from replacing the
/// chosen launch target when the folder gains a new `.exe` — notably Mod
/// Organizer's `helper.exe`, which sorts before `ModOrganizer.exe`.
///
/// Called when the user manually triggers a rescan from the item detail view.
///
/// # Errors
/// Returns an error string if the strategy is unknown, path is invalid, or DB write fails.
#[tauri::command]
pub fn strategy_scan(
    db: State<DbConnection>,
    registry: State<StrategyRegistry>,
    item_id: String,
    folder_path: String,
    strategy_type: String,
) -> Result<ScanResult, String> {
    let strategy = registry.get(&strategy_type).map_err(|e| e.to_string())?;
    let result = strategy.scan(Path::new(&folder_path)).map_err(|e| e.to_string())?;

    let conn = db.0.lock().map_err(|e| e.to_string())?;
    strategy_metadata_queries::insert_missing(&conn, &item_id, &result.metadata)
        .map_err(|e| e.to_string())?;

    Ok(result)
}

/// Returns the display items for a folder as determined by the strategy.
///
/// # Errors
/// Returns an error string if the strategy is unknown or the path is invalid.
#[tauri::command]
pub fn strategy_get_display_items(
    registry: State<StrategyRegistry>,
    folder_path: String,
    strategy_type: String,
) -> Result<Vec<DisplayItem>, String> {
    let strategy = registry.get(&strategy_type).map_err(|e| e.to_string())?;
    strategy
        .get_display_items(Path::new(&folder_path))
        .map_err(|e| e.to_string())
}

/// Returns the launch action for an item, using its stored strategy metadata.
///
/// # Errors
/// Returns an error string if the strategy is unknown or the metadata fetch fails.
#[tauri::command]
pub fn strategy_get_launch_action(
    db: State<DbConnection>,
    registry: State<StrategyRegistry>,
    item_id: String,
    folder_path: String,
    strategy_type: String,
) -> Result<Option<LaunchAction>, String> {
    let strategy = registry.get(&strategy_type).map_err(|e| e.to_string())?;
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let metadata = strategy_metadata_queries::get_by_item(&conn, &item_id)
        .map_err(|e| e.to_string())?;

    Ok(strategy.get_launch_action(Path::new(&folder_path), &metadata))
}

/// Returns the metadata schema (field definitions) for the given strategy type.
///
/// Used by the add-item flow to render the correct metadata input fields.
///
/// # Errors
/// Returns an error string if the strategy type is unknown.
#[tauri::command]
pub fn strategy_get_metadata_schema(
    registry: State<StrategyRegistry>,
    strategy_type: String,
) -> Result<Vec<MetadataField>, String> {
    let strategy = registry.get(&strategy_type).map_err(|e| e.to_string())?;
    Ok(strategy.metadata_schema())
}

/// Executes the launch action for an item and tracks playtime by passively
/// watching the spawned process tree. Returns the session length in seconds.
///
/// Thin wrapper around `services::launcher::launch_tracked` (see there for
/// the tracking semantics).
///
/// # Errors
/// Returns an error string if the item or strategy is unknown, there is no
/// launch action, or the process could not be spawned.
#[tauri::command]
pub async fn strategy_execute_launch_tracked(
    app: tauri::AppHandle,
    item_id: String,
) -> Result<u64, String> {
    launcher::launch_tracked(app, item_id)
        .await
        .map_err(|e| e.to_string())
}

/// Returns playtime summary for all items in a collection.
///
/// Reads `total_playtime_minutes` and `last_launched` metadata keys for every
/// item in the given list and returns them as a map of item_id → (minutes, last_launched).
///
/// # Errors
/// Returns an error string if any database query fails.
#[tauri::command]
pub fn strategy_get_playtime_bulk(
    db: State<DbConnection>,
    item_ids: Vec<String>,
) -> Result<HashMap<String, HashMap<String, String>>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut result = HashMap::new();
    for id in &item_ids {
        let meta = strategy_metadata_queries::get_by_item(&conn, id)
            .unwrap_or_default();
        let mut entry = HashMap::new();

        // Steam items are identified by the presence of `steam_app_type` in metadata.
        let is_steam = meta.contains_key("steam_app_type");
        if is_steam {
            if let Some(v) = meta.get("steam_playtime_minutes").cloned() {
                entry.insert("total_playtime_minutes".to_string(), v);
            }
            if let Some(v) = meta.get("steam_last_played").cloned() {
                entry.insert("last_launched".to_string(), v);
            }
        } else {
            // Local games: use seconds as the authoritative value; derive minutes for display.
            let secs: u64 = meta.get("total_playtime_seconds")
                .and_then(|v| v.parse().ok())
                .unwrap_or_else(|| {
                    // Migrate from old minutes-only data.
                    meta.get("total_playtime_minutes")
                        .and_then(|v| v.parse::<u64>().ok())
                        .unwrap_or(0) * 60
                });
            if secs > 0 {
                entry.insert("total_playtime_seconds".to_string(), secs.to_string());
                entry.insert("total_playtime_minutes".to_string(), (secs / 60).to_string());
            }
            if let Some(v) = meta.get("last_launched").cloned() {
                entry.insert("last_launched".to_string(), v);
            }
        }

        // Pass through `is_installed` for the Play page installed-only filter.
        if let Some(v) = meta.get("is_installed") {
            entry.insert("is_installed".to_string(), v.clone());
        }

        // Pass through `steam_app_type` so the Play page can exclude non-game Steam items.
        // Key presence (even with empty value) signals "this is a Steam item".
        if let Some(v) = meta.get("steam_app_type") {
            entry.insert("steam_app_type".to_string(), v.clone());
        }

        result.insert(id.clone(), entry);
    }
    Ok(result)
}

/// Returns all stored strategy metadata for an item as a key-value map.
///
/// Used by the item detail view to show the current metadata values.
///
/// # Errors
/// Returns an error string if the database query fails.
#[tauri::command]
pub fn strategy_get_metadata(
    db: State<DbConnection>,
    item_id: String,
) -> Result<HashMap<String, String>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    strategy_metadata_queries::get_by_item(&conn, &item_id).map_err(|e| e.to_string())
}

/// Opens a path with the system default application (Explorer for folders).
///
/// Used by the frontend to open mod folders, screenshot folders, and other
/// paths directly without going through a full launch action.
///
/// # Errors
/// Returns an error string if the opener plugin fails.
#[tauri::command]
pub fn shell_open_path(app: tauri::AppHandle, path: String) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    app.opener()
        .open_path(&path, None::<&str>)
        .map_err(|e| e.to_string())
}

/// Upserts a set of metadata key-value pairs for an item.
///
/// Called after item creation to persist user-provided metadata (e.g., manually
/// picked exe_path or mod_folder). Runs after the auto-scan so that explicit
/// user choices always win over auto-detected values.
///
/// # Errors
/// Returns an error string if the database write fails.
#[tauri::command]
pub fn strategy_upsert_metadata(
    db: State<DbConnection>,
    item_id: String,
    metadata: HashMap<String, String>,
) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    strategy_metadata_queries::upsert_all(&conn, &item_id, &metadata)
        .map_err(|e| e.to_string())
}
