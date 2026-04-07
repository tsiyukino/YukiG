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
/// Also persists the scan metadata to the database for the given item.
/// Called after the user manually triggers a rescan from the item detail view.
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
    strategy_metadata_queries::upsert_all(&conn, &item_id, &result.metadata)
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

/// Executes the launch action for an item.
///
/// For `run_exe` actions, spawns the executable as a detached child process so
/// the game runs independently of YukiFileManager. For `open_with_default` actions,
/// opens the path with the system default application via the opener plugin.
///
/// Using the Rust backend for launch avoids the need for shell plugin allowlist
/// entries — the exe path is already trusted since the user chose the folder.
///
/// # Errors
/// Returns an error string if the strategy is unknown, metadata fetch fails,
/// there is no launch action, or the process could not be spawned.
#[tauri::command]
pub fn strategy_execute_launch(
    db: State<DbConnection>,
    registry: State<StrategyRegistry>,
    app: tauri::AppHandle,
    item_id: String,
    folder_path: String,
    strategy_type: String,
) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;

    let strategy = registry.get(&strategy_type).map_err(|e| e.to_string())?;
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let metadata = strategy_metadata_queries::get_by_item(&conn, &item_id)
        .map_err(|e| e.to_string())?;

    let action = strategy
        .get_launch_action(Path::new(&folder_path), &metadata)
        .ok_or_else(|| "No launch action available for this item.".to_string())?;

    match action.action_type.as_str() {
        "run_exe" => {
            std::process::Command::new(&action.target_path)
                .spawn()
                .map_err(|e| format!("Failed to launch '{}': {}", action.target_path, e))?;
        }
        "open_with_default" => {
            app.opener()
                .open_path(&action.target_path, None::<&str>)
                .map_err(|e| e.to_string())?;
        }
        other => {
            return Err(format!("Unknown action type: {}", other));
        }
    }

    Ok(())
}

/// Executes the launch action for an item and tracks playtime.
///
/// For `run_exe` actions, spawns the process, waits for it to exit, then
/// records elapsed seconds as a session. Updates two metadata keys:
/// - `last_launched`: Unix timestamp (seconds) of this launch
/// - `total_playtime_minutes`: cumulative minutes across all sessions
///
/// Blocks until the game process exits, so this must be called from a
/// background thread on the frontend (it will not time out normally).
///
/// For `open_with_default` actions, falls back to fire-and-forget launch
/// since process lifetime cannot be tracked via the opener plugin.
///
/// # Errors
/// Returns an error string if the strategy is unknown, metadata fetch fails,
/// there is no launch action, or the process could not be spawned.
#[tauri::command]
pub fn strategy_execute_launch_tracked(
    db: State<DbConnection>,
    registry: State<StrategyRegistry>,
    app: tauri::AppHandle,
    item_id: String,
    folder_path: String,
    strategy_type: String,
) -> Result<u64, String> {
    use tauri_plugin_opener::OpenerExt;
    use std::time::{SystemTime, UNIX_EPOCH};

    let strategy = registry.get(&strategy_type).map_err(|e| e.to_string())?;
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let metadata = strategy_metadata_queries::get_by_item(&conn, &item_id)
        .map_err(|e| e.to_string())?;

    let action = strategy
        .get_launch_action(Path::new(&folder_path), &metadata)
        .ok_or_else(|| "No launch action available for this item.".to_string())?;

    let now_secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    let started_at = chrono::DateTime::<chrono::Utc>::from_timestamp(now_secs as i64, 0)
        .unwrap_or_else(chrono::Utc::now)
        .to_rfc3339();
    let session_id = uuid::Uuid::new_v4().to_string();

    // Record session start before spawning so the row exists even if the app crashes.
    conn.execute(
        "INSERT INTO play_sessions (id, item_id, started_at, ended_at) VALUES (?1, ?2, ?3, NULL)",
        rusqlite::params![session_id, item_id, started_at],
    ).map_err(|e| e.to_string())?;

    let session_minutes: u64 = match action.action_type.as_str() {
        "run_exe" => {
            let mut child = std::process::Command::new(&action.target_path)
                .spawn()
                .map_err(|e| format!("Failed to launch '{}': {}", action.target_path, e))?;

            // Release the DB lock while the game runs so other queries can proceed.
            drop(conn);

            let _ = child.wait();

            let elapsed = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs()
                .saturating_sub(now_secs);

            let ended_at = chrono::Utc::now().to_rfc3339();

            // Re-acquire lock to update metadata and close session.
            let conn2 = db.0.lock().map_err(|e| e.to_string())?;

            // Close play_sessions row.
            conn2.execute(
                "UPDATE play_sessions SET ended_at = ?1 WHERE id = ?2",
                rusqlite::params![ended_at, session_id],
            ).map_err(|e| e.to_string())?;

            let prev = strategy_metadata_queries::get_by_item(&conn2, &item_id)
                .unwrap_or_default();
            let prev_minutes: u64 = prev
                .get("total_playtime_minutes")
                .and_then(|v| v.parse().ok())
                .unwrap_or(0);
            let session_mins = elapsed / 60;
            let new_total = prev_minutes + session_mins;
            let mut updates = HashMap::new();
            updates.insert("last_launched".to_string(), now_secs.to_string());
            updates.insert("total_playtime_minutes".to_string(), new_total.to_string());
            strategy_metadata_queries::upsert_all(&conn2, &item_id, &updates)
                .map_err(|e| e.to_string())?;

            session_mins
        }
        "open_with_default" => {
            app.opener()
                .open_path(&action.target_path, None::<&str>)
                .map_err(|e| e.to_string())?;
            // Close session immediately — can't track open_with_default lifetime.
            let ended_at = chrono::Utc::now().to_rfc3339();
            conn.execute(
                "UPDATE play_sessions SET ended_at = ?1 WHERE id = ?2",
                rusqlite::params![ended_at, session_id],
            ).map_err(|e| e.to_string())?;
            // Update last_launched but not playtime.
            let mut ts_update = HashMap::new();
            ts_update.insert("last_launched".to_string(), now_secs.to_string());
            strategy_metadata_queries::upsert_all(&conn, &item_id, &ts_update)
                .map_err(|e| e.to_string())?;
            0
        }
        other => {
            return Err(format!("Unknown action type: {}", other));
        }
    };

    Ok(session_minutes)
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

        // Local games store playtime in `total_playtime_minutes` + `last_launched`.
        // Steam games store it in `steam_playtime_minutes` + `steam_last_played`.
        // Fall back so both game types report accurate playtime to the Play page.
        let playtime = meta
            .get("total_playtime_minutes")
            .or_else(|| meta.get("steam_playtime_minutes"))
            .cloned();
        if let Some(v) = playtime {
            entry.insert("total_playtime_minutes".to_string(), v);
        }

        let last_launched = meta
            .get("last_launched")
            .or_else(|| meta.get("steam_last_played"))
            .cloned();
        if let Some(v) = last_launched {
            entry.insert("last_launched".to_string(), v);
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
