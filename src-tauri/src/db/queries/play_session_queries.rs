/// Database queries for the `play_sessions` table.
///
/// A session row is opened when a game launches (`ended_at` NULL) and closed
/// when it exits. This is the durable session history — it survives restarts
/// and feeds Phase 6 playtime stats — as distinct from the in-memory
/// `SessionRegistry`, which only answers "who is playing right now".
use rusqlite::{Connection, Result};
use uuid::Uuid;

/// A single play-session record.
#[derive(Debug, Clone, serde::Serialize)]
pub struct PlaySession {
    pub id: String,
    pub item_id: String,
    /// ISO 8601 start time.
    pub started_at: String,
    /// ISO 8601 end time, or null while the session is in progress.
    pub ended_at: Option<String>,
}

/// Opens a new session for `item_id`, stamping `started_at` with `now_iso`,
/// and returns the generated session id.
///
/// # Errors
/// Returns a `rusqlite::Error` if the insert fails.
pub fn open(conn: &Connection, item_id: &str, now_iso: &str) -> Result<String> {
    let id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO play_sessions (id, item_id, started_at, ended_at) VALUES (?1, ?2, ?3, NULL)",
        rusqlite::params![id, item_id, now_iso],
    )?;
    Ok(id)
}

/// Closes the session `session_id` by stamping `ended_at` with `now_iso`.
///
/// Returns the number of rows updated (0 if the id was not found), so callers
/// that care can distinguish a missing session.
///
/// # Errors
/// Returns a `rusqlite::Error` if the update fails.
pub fn close(conn: &Connection, session_id: &str, now_iso: &str) -> Result<usize> {
    conn.execute(
        "UPDATE play_sessions SET ended_at = ?1 WHERE id = ?2",
        rusqlite::params![now_iso, session_id],
    )
}

/// Returns all sessions for `item_id`, newest first.
///
/// # Errors
/// Returns a `rusqlite::Error` if the query fails.
pub fn get_by_item(conn: &Connection, item_id: &str) -> Result<Vec<PlaySession>> {
    let mut stmt = conn.prepare(
        "SELECT id, item_id, started_at, ended_at
         FROM play_sessions
         WHERE item_id = ?1
         ORDER BY started_at DESC",
    )?;
    let rows = stmt
        .query_map(rusqlite::params![item_id], |row| {
            Ok(PlaySession {
                id: row.get(0)?,
                item_id: row.get(1)?,
                started_at: row.get(2)?,
                ended_at: row.get(3)?,
            })
        })?
        .collect::<Result<Vec<_>>>()?;
    Ok(rows)
}
