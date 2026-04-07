/// Tauri command handlers for game status management.
///
/// Game status tracks where a player is in a given game:
///   - `story_status`: unplayed | playing | on_hold | snoozed | completed | abandoned
///   - `online_status`: inactive | active | snoozed
///
/// `game_status_bulk_init` is designed to be called on startup to silently
/// create default status rows for any items that do not yet have one.
use tauri::State;

use crate::db::connection::DbConnection;

/// The persisted status record for a single game.
#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct GameStatus {
    pub item_id: String,
    /// `unplayed | playing | on_hold | snoozed | completed | abandoned`
    pub story_status: String,
    /// `inactive | active | snoozed`
    pub online_status: String,
    /// ISO 8601 snooze expiry, or null.
    pub snooze_until: Option<String>,
}

/// Returns the game status for a single item.
///
/// If no status row exists yet, returns a default `unplayed` / `inactive` record
/// without writing to the database (callers use `game_status_set` to persist).
///
/// # Errors
/// Returns an error string if the database query fails.
#[tauri::command]
pub fn game_status_get(db: State<DbConnection>, item_id: String) -> Result<GameStatus, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    let result = conn.query_row(
        "SELECT item_id, story_status, online_status, snooze_until
         FROM game_status
         WHERE item_id = ?1",
        rusqlite::params![item_id],
        |row| {
            Ok(GameStatus {
                item_id: row.get(0)?,
                story_status: row.get(1)?,
                online_status: row.get(2)?,
                snooze_until: row.get(3)?,
            })
        },
    );

    match result {
        Ok(status) => Ok(status),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(GameStatus {
            item_id,
            story_status: "unplayed".to_string(),
            online_status: "inactive".to_string(),
            snooze_until: None,
        }),
        Err(e) => Err(e.to_string()),
    }
}

/// Upserts the game status for an item.
///
/// All three fields (story_status, online_status, snooze_until) are written
/// together. Pass the existing values when only one field should change.
///
/// # Errors
/// Returns an error string if the database write fails.
#[tauri::command]
pub fn game_status_set(
    db: State<DbConnection>,
    item_id: String,
    story_status: String,
    online_status: String,
    snooze_until: Option<String>,
) -> Result<GameStatus, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO game_status (item_id, story_status, online_status, snooze_until)
         VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(item_id) DO UPDATE SET
             story_status  = excluded.story_status,
             online_status = excluded.online_status,
             snooze_until  = excluded.snooze_until",
        rusqlite::params![item_id, story_status, online_status, snooze_until],
    )
    .map_err(|e| e.to_string())?;

    Ok(GameStatus {
        item_id,
        story_status,
        online_status,
        snooze_until,
    })
}

/// Returns all game status rows — used by the Play page to build the candidate pool.
///
/// # Errors
/// Returns an error string if the database query fails.
#[tauri::command]
pub fn game_status_get_all(db: State<DbConnection>) -> Result<Vec<GameStatus>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT item_id, story_status, online_status, snooze_until FROM game_status",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(GameStatus {
                item_id: row.get(0)?,
                story_status: row.get(1)?,
                online_status: row.get(2)?,
                snooze_until: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(rows)
}

/// Ensures every `game` and `steam_game` item has a status row, then auto-assigns
/// `playing` / `on_hold` based on play history (both YukiG sessions and Steam playtime).
///
/// Rules applied in order:
/// 1. Insert `unplayed` / `inactive` default for items with no row yet.
/// 2. Items with a YukiG session in the last 28 days are promoted to `playing`.
/// 3. Steam games with `steam_playtime_minutes > 0` and `steam_last_played` within 28 days
///    are promoted to `playing` (covers games never launched through YukiG).
/// 4. Steam games with `steam_playtime_minutes > 0` but no recent play (old or zero
///    `steam_last_played`) are promoted to `on_hold` — they were played before but not recently.
/// 5. YukiG-tracked games demoted from `playing` → `on_hold` if no session in 28 days.
/// 6. Auto-set `online_status = 'active'` for Steam games whose `steam_categories` metadata
///    contains any online-multiplayer ID (1=Multi-player, 36=Online PvP, 49=PvP).
/// Manual statuses (`completed`, `abandoned`, `snoozed`) are never touched.
///
/// # Errors
/// Returns an error string if any database query fails.
#[tauri::command]
pub fn game_status_bulk_init(db: State<DbConnection>) -> Result<u32, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    // 1. Insert defaults for items without a row.
    let inserted = conn
        .execute(
            "INSERT OR IGNORE INTO game_status (item_id, story_status, online_status, snooze_until)
             SELECT id, 'unplayed', 'inactive', NULL
             FROM items
             WHERE strategy_type IN ('game', 'steam_game')",
            [],
        )
        .map_err(|e| e.to_string())?;

    // 2. Promote to 'playing' if there is a YukiG session in the last 28 days.
    conn.execute(
        "UPDATE game_status
         SET story_status = 'playing'
         WHERE story_status IN ('unplayed', 'on_hold')
           AND item_id IN (
               SELECT DISTINCT item_id FROM play_sessions
               WHERE ended_at >= datetime('now', '-28 days')
           )",
        [],
    ).map_err(|e| e.to_string())?;

    // 3. Promote Steam games to 'playing' if they have playtime and were played recently.
    //    steam_last_played is a Unix timestamp stored as text in strategy_metadata.
    //    We compare it to unixepoch('now', '-28 days') to find games played in last 28 days.
    conn.execute(
        "UPDATE game_status
         SET story_status = 'playing'
         WHERE story_status = 'unplayed'
           AND item_id IN (
               SELECT sm_pt.item_id
               FROM strategy_metadata sm_pt
               JOIN strategy_metadata sm_lp ON sm_pt.item_id = sm_lp.item_id
               WHERE sm_pt.key = 'steam_playtime_minutes'
                 AND CAST(sm_pt.value AS INTEGER) > 0
                 AND sm_lp.key = 'steam_last_played'
                 AND CAST(sm_lp.value AS INTEGER) > unixepoch('now', '-28 days')
           )",
        [],
    ).map_err(|e| e.to_string())?;

    // 4. Promote Steam games to 'on_hold' if they have playtime but haven't been played recently.
    //    Covers games with old steam_last_played (> 28 days ago) or steam_last_played = 0.
    conn.execute(
        "UPDATE game_status
         SET story_status = 'on_hold'
         WHERE story_status = 'unplayed'
           AND item_id IN (
               SELECT sm_pt.item_id
               FROM strategy_metadata sm_pt
               WHERE sm_pt.key = 'steam_playtime_minutes'
                 AND CAST(sm_pt.value AS INTEGER) > 0
           )
           AND item_id NOT IN (
               SELECT sm_lp.item_id
               FROM strategy_metadata sm_lp
               WHERE sm_lp.key = 'steam_last_played'
                 AND CAST(sm_lp.value AS INTEGER) > unixepoch('now', '-28 days')
           )",
        [],
    ).map_err(|e| e.to_string())?;

    // 5. Demote to 'on_hold' if last YukiG session was more than 28 days ago.
    conn.execute(
        "UPDATE game_status
         SET story_status = 'on_hold'
         WHERE story_status = 'playing'
           AND item_id NOT IN (
               SELECT DISTINCT item_id FROM play_sessions
               WHERE ended_at >= datetime('now', '-28 days')
           )
           AND item_id IN (
               SELECT DISTINCT item_id FROM play_sessions
           )
           AND item_id NOT IN (
               SELECT sm_lp.item_id
               FROM strategy_metadata sm_lp
               WHERE sm_lp.key = 'steam_last_played'
                 AND CAST(sm_lp.value AS INTEGER) > unixepoch('now', '-28 days')
           )",
        [],
    ).map_err(|e| e.to_string())?;

    // 4. Auto-set online_status = 'active' for Steam games whose stored steam_categories
    //    contains any of the online-multiplayer IDs (1=Multi-player, 36=Online PvP, 49=PvP).
    //    The value is a comma-separated string like "1,9,37"; we match whole tokens only.
    //    Only updates rows that are still 'inactive' to avoid overwriting manual changes.
    conn.execute(
        "UPDATE game_status
         SET online_status = 'active'
         WHERE online_status = 'inactive'
           AND item_id IN (
               SELECT sm.item_id
               FROM strategy_metadata sm
               WHERE sm.key = 'steam_categories'
                 AND (
                     sm.value = '1' OR sm.value LIKE '1,%' OR sm.value LIKE '%,1' OR sm.value LIKE '%,1,%'
                     OR sm.value = '36' OR sm.value LIKE '36,%' OR sm.value LIKE '%,36' OR sm.value LIKE '%,36,%'
                     OR sm.value = '49' OR sm.value LIKE '49,%' OR sm.value LIKE '%,49' OR sm.value LIKE '%,49,%'
                 )
           )",
        [],
    ).map_err(|e| e.to_string())?;

    Ok(inserted as u32)
}

/// Returns game status rows for a list of item ids.
///
/// Items with no row in `game_status` are not included; callers should fall back
/// to the `unplayed` / `inactive` default for missing entries.
///
/// # Errors
/// Returns an error string if the query fails.
#[tauri::command]
pub fn game_status_get_bulk(
    db: State<DbConnection>,
    item_ids: Vec<String>,
) -> Result<Vec<GameStatus>, String> {
    if item_ids.is_empty() {
        return Ok(vec![]);
    }

    let conn = db.0.lock().map_err(|e| e.to_string())?;

    // Build a parameterised IN clause dynamically.
    let placeholders: String = (1..=item_ids.len())
        .map(|i| format!("?{}", i))
        .collect::<Vec<_>>()
        .join(", ");

    let sql = format!(
        "SELECT item_id, story_status, online_status, snooze_until
         FROM game_status
         WHERE item_id IN ({})",
        placeholders
    );

    let params: Vec<Box<dyn rusqlite::ToSql>> = item_ids
        .iter()
        .map(|id| Box::new(id.clone()) as Box<dyn rusqlite::ToSql>)
        .collect();

    let params_ref: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();

    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params_ref.as_slice(), |row| {
            Ok(GameStatus {
                item_id: row.get(0)?,
                story_status: row.get(1)?,
                online_status: row.get(2)?,
                snooze_until: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(rows)
}
