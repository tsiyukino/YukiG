/// Tauri command handlers for play-session recording.
///
/// Thin wrappers over `db::queries::play_session_queries`. A session row is
/// created with `session_start` when a game launches and closed with
/// `session_end` when the process exits. `session_get_by_item` returns the
/// full history for an item so the UI can display totals.
///
/// Games launched through YukiG open and close their session rows directly in
/// `services::launcher`; these commands exist for callers that manage the
/// lifecycle themselves.
use tauri::State;

use crate::db::connection::DbConnection;
use crate::db::queries::play_session_queries::{self, PlaySession};
use crate::services::session_registry::{ActiveSession, SessionRegistry};

/// Opens a new play session for the given item and returns its id.
///
/// # Errors
/// Returns an error string if the database write fails.
#[tauri::command]
pub fn session_start(db: State<DbConnection>, item_id: String) -> Result<String, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().to_rfc3339();
    play_session_queries::open(&conn, &item_id, &now).map_err(|e| e.to_string())
}

/// Closes an existing play session by recording its end time.
///
/// # Errors
/// Returns an error string if the session id is not found or the update fails.
#[tauri::command]
pub fn session_end(db: State<DbConnection>, session_id: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().to_rfc3339();
    let rows = play_session_queries::close(&conn, &session_id, &now).map_err(|e| e.to_string())?;
    if rows == 0 {
        return Err(format!("Session not found: {}", session_id));
    }
    Ok(())
}

/// Returns all play sessions for an item, newest first.
///
/// # Errors
/// Returns an error string if the database query fails.
#[tauri::command]
pub fn session_get_by_item(
    db: State<DbConnection>,
    item_id: String,
) -> Result<Vec<PlaySession>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    play_session_queries::get_by_item(&conn, &item_id).map_err(|e| e.to_string())
}

/// Returns the items currently being played (local games launched via YukiG).
///
/// Reads the in-memory `SessionRegistry`, the source of truth for live "now
/// playing" state. The frontend calls this on window (re)creation to rebuild
/// its badges, since the tray flow destroys the webview and its React state.
///
/// Steam games are not included here — their running state is observed
/// separately (Steam launches them, not YukiG).
#[tauri::command]
pub fn session_get_active(registry: State<SessionRegistry>) -> Vec<ActiveSession> {
    registry.active()
}
