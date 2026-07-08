/// Launch-and-track business logic, shared by the Tauri command layer and
/// the tray menu.
///
/// Owns the full lifecycle: resolve the item from the database, ask its
/// strategy for a launch action, spawn or open the target, passively track
/// the spawned process tree, then persist playtime metadata. Callers only
/// need an item id — the database is the source of truth for everything
/// else (folder path, strategy type, metadata).
use std::collections::HashMap;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

use tauri::Manager;

use crate::db::connection::DbConnection;
use crate::db::queries::{item_queries, play_session_queries, strategy_metadata_queries};
use crate::services::process_tracker;
use crate::services::session_registry::SessionRegistry;
use crate::strategies::{LaunchAction, StrategyRegistry};

/// Errors surfaced while launching an item.
#[derive(Debug, thiserror::Error)]
pub enum LauncherError {
    #[error("Database error: {0}")]
    Database(#[from] rusqlite::Error),
    #[error("Database lock poisoned")]
    LockPoisoned,
    #[error("Strategy error: {0}")]
    Strategy(String),
    #[error("No launch action available for this item.")]
    NoLaunchAction,
    #[error("Failed to launch '{target}': {source}")]
    Spawn {
        target: String,
        source: std::io::Error,
    },
    #[error("Failed to open '{0}'")]
    Open(String),
    #[error("Launch task failed: {0}")]
    Join(String),
    #[error("Unknown action type: {0}")]
    UnknownAction(String),
    #[error("Process tracking failed: {0}")]
    Tracking(String),
}

/// Returns the directory containing `exe_path`, used as the child process's
/// working directory. Games and mod loaders resolve DLLs, INIs, and plugin
/// paths relative to the working directory, so inheriting YukiG's own cwd
/// breaks them.
fn exe_working_dir(exe_path: &str) -> Option<std::path::PathBuf> {
    let parent = Path::new(exe_path).parent()?;
    if parent.as_os_str().is_empty() {
        None
    } else {
        Some(parent.to_path_buf())
    }
}

/// Launches an item and blocks (asynchronously) until it exits, then
/// persists playtime metadata. Returns the session length in seconds.
///
/// The game is spawned as a plain detached process with its working
/// directory set to the exe's folder — no Job Object, nothing inherited
/// from YukiG — so launchers such as Mod Organizer 2 behave exactly as if
/// double-clicked. `process_tracker::track_process_tree` then follows
/// parent-PID links from the outside and keeps the session alive while any
/// descendant is running. The blocking watch runs on a dedicated thread
/// via `spawn_blocking` so the Tauri async executor stays responsive.
///
/// Playtime is stored in strategy metadata:
/// - `total_playtime_seconds`: cumulative seconds across all sessions (authoritative)
/// - `total_playtime_minutes`: derived from seconds, for display
/// - `last_launched`: Unix timestamp (seconds) of this launch
///
/// # Errors
/// Returns a `LauncherError` if the item or strategy is unknown, there is
/// no launch action, or the process could not be spawned.
pub async fn launch_tracked(app: tauri::AppHandle, item_id: String) -> Result<u64, LauncherError> {
    use tauri_plugin_opener::OpenerExt;

    let action = resolve_action(&app, &item_id)?;
    // DB lock released here before the blocking wait begins.

    let now_secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    let session_secs: u64 = match action.action_type.as_str() {
        "run_exe" => {
            let target = action.target_path.clone();
            let registry = app.state::<SessionRegistry>().inner().clone();
            let app_for_task = app.clone();
            let item_for_task = item_id.clone();
            // Offload the blocking process-tree watch to a dedicated OS thread.
            // Session bookkeeping happens inside the task (only after spawn
            // succeeds) and always unwinds before the task returns, so a
            // tracking error cannot leave a stuck "now playing" badge or an
            // unclosed play_sessions row.
            tokio::task::spawn_blocking(move || -> Result<u64, LauncherError> {
                let mut cmd = std::process::Command::new(&target);
                if let Some(dir) = exe_working_dir(&target) {
                    cmd.current_dir(dir);
                }
                let child = cmd.spawn().map_err(|source| LauncherError::Spawn {
                    target: target.clone(),
                    source,
                })?;

                // Durable history row + live registry entry. A failed row
                // insert is non-fatal: tracking and the badge still work.
                let session_id = open_session_row(&app_for_task, &item_for_task).ok();
                registry.start(&app_for_task, &item_for_task);

                let result = process_tracker::track_process_tree(child.id())
                    .map_err(|e| LauncherError::Tracking(e.to_string()));

                registry.end(&app_for_task, &item_for_task);
                if let Some(id) = session_id {
                    let _ = close_session_row(&app_for_task, &id);
                }
                result
            })
            .await
            .map_err(|e| LauncherError::Join(e.to_string()))??
        }
        "open_with_default" => {
            app.opener()
                .open_path(&action.target_path, None::<&str>)
                .map_err(|e| LauncherError::Open(e.to_string()))?;
            0
        }
        other => return Err(LauncherError::UnknownAction(other.to_string())),
    };

    persist_playtime(&app, &item_id, session_secs, now_secs)?;
    Ok(session_secs)
}

/// Loads the item and asks its strategy for the launch action.
fn resolve_action(app: &tauri::AppHandle, item_id: &str) -> Result<LaunchAction, LauncherError> {
    let db = app.state::<DbConnection>();
    let registry = app.state::<StrategyRegistry>();
    let conn = db.0.lock().map_err(|_| LauncherError::LockPoisoned)?;

    let item = item_queries::get_by_id(&conn, item_id)?;
    let strategy = registry
        .get(&item.strategy_type)
        .map_err(|e| LauncherError::Strategy(e.to_string()))?;
    let metadata = strategy_metadata_queries::get_by_item(&conn, item_id)?;

    strategy
        .get_launch_action(Path::new(&item.folder_path), &metadata)
        .ok_or(LauncherError::NoLaunchAction)
}

/// Opens a durable `play_sessions` history row and returns its id.
///
/// This history is separate from the in-memory registry: the row survives
/// restarts and feeds Phase 6 stats, whereas the registry only answers "who is
/// playing right now". A failure here is non-fatal to launch.
fn open_session_row(app: &tauri::AppHandle, item_id: &str) -> Result<String, LauncherError> {
    let db = app.state::<DbConnection>();
    let conn = db.0.lock().map_err(|_| LauncherError::LockPoisoned)?;
    let now = chrono::Utc::now().to_rfc3339();
    Ok(play_session_queries::open(&conn, item_id, &now)?)
}

/// Closes the given `play_sessions` history row.
fn close_session_row(app: &tauri::AppHandle, session_id: &str) -> Result<(), LauncherError> {
    let db = app.state::<DbConnection>();
    let conn = db.0.lock().map_err(|_| LauncherError::LockPoisoned)?;
    let now = chrono::Utc::now().to_rfc3339();
    play_session_queries::close(&conn, session_id, &now)?;
    Ok(())
}

/// Adds this session to the cumulative playtime metadata and stamps
/// `last_launched` with the launch time.
fn persist_playtime(
    app: &tauri::AppHandle,
    item_id: &str,
    session_secs: u64,
    launched_at_secs: u64,
) -> Result<(), LauncherError> {
    let db = app.state::<DbConnection>();
    let conn = db.0.lock().map_err(|_| LauncherError::LockPoisoned)?;
    let prev = strategy_metadata_queries::get_by_item(&conn, item_id).unwrap_or_default();

    let prev_secs: u64 = prev
        .get("total_playtime_seconds")
        .and_then(|v| v.parse().ok())
        .unwrap_or_else(|| {
            // Migrate from old minutes-only data.
            prev.get("total_playtime_minutes")
                .and_then(|v| v.parse::<u64>().ok())
                .unwrap_or(0)
                * 60
        });

    let new_total_secs = prev_secs + session_secs;

    let mut updates = HashMap::new();
    updates.insert(
        "total_playtime_seconds".to_string(),
        new_total_secs.to_string(),
    );
    updates.insert(
        "total_playtime_minutes".to_string(),
        (new_total_secs / 60).to_string(),
    );
    updates.insert("last_launched".to_string(), launched_at_secs.to_string());
    strategy_metadata_queries::upsert_all(&conn, item_id, &updates)?;

    Ok(())
}
