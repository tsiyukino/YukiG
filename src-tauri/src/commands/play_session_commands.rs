/// Tauri command handlers for play-session recording.
///
/// A session row is created with `session_start` when a game launches and
/// closed with `session_end` when the process exits. `session_get_by_item`
/// returns the full history for an item so the UI can display totals.
use tauri::State;
use uuid::Uuid;

use crate::db::connection::DbConnection;

/// A single play-session record as returned to the frontend.
#[derive(Debug, serde::Serialize)]
pub struct PlaySession {
    pub id: String,
    pub item_id: String,
    /// ISO 8601
    pub started_at: String,
    /// ISO 8601, or null while the session is in progress.
    pub ended_at: Option<String>,
}

/// Opens a new play session for the given item.
///
/// Records the current UTC time as `started_at` and returns the new session id.
/// The caller must call `session_end` with this id when the game exits.
///
/// # Errors
/// Returns an error string if the database write fails.
#[tauri::command]
pub fn session_start(db: State<DbConnection>, item_id: String) -> Result<String, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();
    let started_at = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO play_sessions (id, item_id, started_at, ended_at) VALUES (?1, ?2, ?3, NULL)",
        rusqlite::params![id, item_id, started_at],
    )
    .map_err(|e| e.to_string())?;

    Ok(id)
}

/// Closes an existing play session by recording its end time.
///
/// # Errors
/// Returns an error string if the session id is not found or the update fails.
#[tauri::command]
pub fn session_end(db: State<DbConnection>, session_id: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let ended_at = chrono::Utc::now().to_rfc3339();

    let rows = conn
        .execute(
            "UPDATE play_sessions SET ended_at = ?1 WHERE id = ?2",
            rusqlite::params![ended_at, session_id],
        )
        .map_err(|e| e.to_string())?;

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

    let mut stmt = conn
        .prepare(
            "SELECT id, item_id, started_at, ended_at
             FROM play_sessions
             WHERE item_id = ?1
             ORDER BY started_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let sessions = stmt
        .query_map(rusqlite::params![item_id], |row| {
            Ok(PlaySession {
                id: row.get(0)?,
                item_id: row.get(1)?,
                started_at: row.get(2)?,
                ended_at: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(sessions)
}
