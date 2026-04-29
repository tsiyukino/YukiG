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

/// Executes the launch action for an item and tracks playtime via a Job Object.
///
/// Runs the blocking wait on a dedicated thread via `spawn_blocking` so the
/// Tauri async executor and UI remain responsive while the game is running.
///
/// Playtime is stored in two metadata keys:
/// - `total_playtime_seconds`: cumulative seconds across all sessions (authoritative)
/// - `total_playtime_minutes`: derived from seconds, for display
/// - `last_launched`: Unix timestamp (seconds) of this launch
///
/// # Errors
/// Returns an error string if the strategy is unknown, metadata fetch fails,
/// there is no launch action, or the process could not be spawned.
#[tauri::command]
pub async fn strategy_execute_launch_tracked(
    db: State<'_, DbConnection>,
    registry: State<'_, StrategyRegistry>,
    app: tauri::AppHandle,
    item_id: String,
    folder_path: String,
    strategy_type: String,
) -> Result<u64, String> {
    use tauri_plugin_opener::OpenerExt;
    use std::time::{SystemTime, UNIX_EPOCH};

    let strategy = registry.get(&strategy_type).map_err(|e| e.to_string())?;
    let action = {
        let conn = db.0.lock().map_err(|e| e.to_string())?;
        let metadata = strategy_metadata_queries::get_by_item(&conn, &item_id)
            .map_err(|e| e.to_string())?;
        strategy
            .get_launch_action(Path::new(&folder_path), &metadata)
            .ok_or_else(|| "No launch action available for this item.".to_string())?
    };
    // DB lock released here before the blocking wait begins.

    let now_secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    let session_secs: u64 = match action.action_type.as_str() {
        "run_exe" => {
            let target = action.target_path.clone();
            // Offload the blocking process-tree wait to a dedicated OS thread.
            tokio::task::spawn_blocking(move || -> Result<u64, String> {
                #[cfg(target_os = "windows")]
                { wait_for_process_tree_windows(&target) }
                #[cfg(not(target_os = "windows"))]
                {
                    let mut child = std::process::Command::new(&target)
                        .spawn()
                        .map_err(|e| format!("Failed to launch '{}': {}", target, e))?;
                    let start = std::time::Instant::now();
                    let _ = child.wait();
                    Ok(start.elapsed().as_secs())
                }
            })
            .await
            .map_err(|e: tokio::task::JoinError| e.to_string())??
        }
        "open_with_default" => {
            app.opener()
                .open_path(&action.target_path, None::<&str>)
                .map_err(|e| e.to_string())?;
            0
        }
        other => return Err(format!("Unknown action type: {}", other)),
    };

    // Re-acquire lock to persist results.
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let prev = strategy_metadata_queries::get_by_item(&conn, &item_id).unwrap_or_default();

    let prev_secs: u64 = prev
        .get("total_playtime_seconds")
        .and_then(|v| v.parse().ok())
        .unwrap_or_else(|| {
            prev.get("total_playtime_minutes")
                .and_then(|v| v.parse::<u64>().ok())
                .unwrap_or(0) * 60
        });

    let new_total_secs = prev_secs + session_secs;
    let new_total_mins = new_total_secs / 60;

    let mut updates = HashMap::new();
    updates.insert("total_playtime_seconds".to_string(), new_total_secs.to_string());
    updates.insert("total_playtime_minutes".to_string(), new_total_mins.to_string());
    updates.insert("last_launched".to_string(), now_secs.to_string());
    strategy_metadata_queries::upsert_all(&conn, &item_id, &updates)
        .map_err(|e| e.to_string())?;

    Ok(session_secs)
}

/// Spawns an exe inside a Windows Job Object and blocks until every process in
/// the job tree has exited. Returns the elapsed wall-clock seconds.
///
/// Uses `CreateProcessW` with `CREATE_SUSPENDED` so the process is in the job
/// before its first instruction runs, then resumes via `ResumeThread`. After the
/// direct child exits, polls `QueryInformationJobObject` every 500 ms until
/// `ActiveProcesses == 0`. This handles launcher stubs that spawn the real game
/// and exit immediately.
#[cfg(target_os = "windows")]
fn wait_for_process_tree_windows(exe_path: &str) -> Result<u64, String> {
    use std::time::Instant;
    use windows::core::PWSTR;
    use windows::Win32::Foundation::CloseHandle;
    use windows::Win32::System::JobObjects::{
        AssignProcessToJobObject, CreateJobObjectW,
        JobObjectBasicAccountingInformation,
        JOBOBJECT_BASIC_ACCOUNTING_INFORMATION,
        QueryInformationJobObject,
    };
    use windows::Win32::System::Threading::{
        CreateProcessW, ResumeThread, WaitForSingleObject,
        PROCESS_INFORMATION, STARTUPINFOW,
        CREATE_SUSPENDED, INFINITE,
    };

    let job = unsafe { CreateJobObjectW(None, None) }
        .map_err(|e| format!("CreateJobObjectW failed: {}", e))?;

    let mut exe_wide: Vec<u16> = exe_path.encode_utf16().chain(std::iter::once(0)).collect();
    let mut si = STARTUPINFOW {
        cb: std::mem::size_of::<STARTUPINFOW>() as u32,
        ..Default::default()
    };
    let mut pi = PROCESS_INFORMATION::default();

    let spawn_result = unsafe {
        CreateProcessW(
            None,
            Some(PWSTR(exe_wide.as_mut_ptr())),
            None,
            None,
            false,
            CREATE_SUSPENDED,
            None,
            None,
            &mut si,
            &mut pi,
        )
    };

    if let Err(e) = spawn_result {
        unsafe { CloseHandle(job).ok() };
        return Err(format!("CreateProcessW failed: {}", e));
    }

    let start = Instant::now();

    if let Err(e) = unsafe { AssignProcessToJobObject(job, pi.hProcess) } {
        unsafe {
            windows::Win32::System::Threading::TerminateProcess(pi.hProcess, 1).ok();
            CloseHandle(pi.hProcess).ok();
            CloseHandle(pi.hThread).ok();
            CloseHandle(job).ok();
        }
        return Err(format!("AssignProcessToJobObject failed: {}", e));
    }

    // Resume the primary thread now that it's safely in the job.
    unsafe { ResumeThread(pi.hThread) };
    unsafe { CloseHandle(pi.hThread).ok() };

    // Wait for the direct child to exit, then poll for grandchildren.
    unsafe { WaitForSingleObject(pi.hProcess, INFINITE) };
    unsafe { CloseHandle(pi.hProcess).ok() };

    loop {
        let mut info = JOBOBJECT_BASIC_ACCOUNTING_INFORMATION::default();
        let ok = unsafe {
            QueryInformationJobObject(
                Some(job),
                JobObjectBasicAccountingInformation,
                &mut info as *mut _ as *mut std::ffi::c_void,
                std::mem::size_of::<JOBOBJECT_BASIC_ACCOUNTING_INFORMATION>() as u32,
                None,
            )
        };
        if ok.is_err() || info.ActiveProcesses == 0 { break; }
        std::thread::sleep(std::time::Duration::from_millis(500));
    }

    unsafe { CloseHandle(job).ok() };
    Ok(start.elapsed().as_secs())
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
