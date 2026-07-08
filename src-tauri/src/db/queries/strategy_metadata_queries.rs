/// Database query functions for the strategy_metadata table.
///
/// All functions operate on a `Connection` reference and return typed results.
/// No business logic or filesystem operations belong here.
use rusqlite::{Connection, Result};
use uuid::Uuid;

use crate::db::models::StrategyMetadata;

/// Retrieves all metadata entries for a given item, as a key-value map.
///
/// # Errors
/// Returns a `rusqlite::Error` if the query fails.
pub fn get_by_item(
    conn: &Connection,
    item_id: &str,
) -> Result<std::collections::HashMap<String, String>> {
    let mut stmt = conn.prepare(
        "SELECT key, value FROM strategy_metadata WHERE item_id = ?1",
    )?;

    let rows = stmt.query_map([item_id], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
    })?;

    let mut map = std::collections::HashMap::new();
    for row in rows {
        let (k, v) = row?;
        map.insert(k, v);
    }
    Ok(map)
}

/// Returns the item id whose metadata has the given (key, value) pair, if any.
///
/// Used to resolve external identities back to items — e.g. mapping a Steam
/// `RunningAppID` to the library item via its `steam_app_id` metadata. If more
/// than one item matches (should not happen for unique keys like app id), the
/// first row is returned.
///
/// # Errors
/// Returns a `rusqlite::Error` if the query fails.
pub fn find_item_by_metadata(
    conn: &Connection,
    key: &str,
    value: &str,
) -> Result<Option<String>> {
    conn.query_row(
        "SELECT item_id FROM strategy_metadata WHERE key = ?1 AND value = ?2 LIMIT 1",
        rusqlite::params![key, value],
        |row| row.get::<_, String>(0),
    )
    .map(Some)
    .or_else(|e| match e {
        rusqlite::Error::QueryReturnedNoRows => Ok(None),
        other => Err(other),
    })
}

/// Inserts or replaces a single metadata entry for an item.
///
/// Uses INSERT OR REPLACE so calling this is idempotent — subsequent calls
/// with the same (item_id, key) pair will update the value.
///
/// # Errors
/// Returns a `rusqlite::Error` if the upsert fails.
pub fn upsert(
    conn: &Connection,
    item_id: &str,
    key: &str,
    value: &str,
) -> Result<StrategyMetadata> {
    let id = Uuid::new_v4().to_string();

    conn.execute(
        "INSERT INTO strategy_metadata (id, item_id, key, value)
         VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(item_id, key) DO UPDATE SET value = excluded.value",
        rusqlite::params![&id, item_id, key, value],
    )?;

    conn.query_row(
        "SELECT id, item_id, key, value FROM strategy_metadata
         WHERE item_id = ?1 AND key = ?2",
        rusqlite::params![item_id, key],
        |row| {
            Ok(StrategyMetadata {
                id: row.get(0)?,
                item_id: row.get(1)?,
                key: row.get(2)?,
                value: row.get(3)?,
            })
        },
    )
}

/// Inserts all key-value pairs from a map as metadata for an item.
///
/// Calls `upsert` for each entry. Stops and returns the first error encountered.
///
/// # Errors
/// Returns a `rusqlite::Error` if any upsert fails.
pub fn upsert_all(
    conn: &Connection,
    item_id: &str,
    metadata: &std::collections::HashMap<String, String>,
) -> Result<()> {
    for (key, value) in metadata {
        upsert(conn, item_id, key, value)?;
    }
    Ok(())
}

/// Inserts each key only if the item does not already have that key.
///
/// Non-destructive: existing values (which may be user-set, e.g. an explicit
/// `exe_path`) are never overwritten. Used by rescans so filesystem
/// auto-detection can fill gaps but cannot clobber a deliberate choice — a
/// game folder that gains a stray `.exe` (e.g. Mod Organizer's `helper.exe`)
/// must not silently replace the launch target.
///
/// # Errors
/// Returns a `rusqlite::Error` if any insert fails.
pub fn insert_missing(
    conn: &Connection,
    item_id: &str,
    metadata: &std::collections::HashMap<String, String>,
) -> Result<()> {
    for (key, value) in metadata {
        let id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO strategy_metadata (id, item_id, key, value)
             VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT(item_id, key) DO NOTHING",
            rusqlite::params![id, item_id, key, value],
        )?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    /// In-memory database with migrations applied and one game item ('i1').
    fn test_db() -> Connection {
        let conn = Connection::open_in_memory().expect("open in-memory db");
        crate::db::migrations::run(&conn).expect("apply migrations");
        conn.execute(
            "INSERT INTO collections (id, name, icon, color, description, sort_order, created_at, updated_at)
             VALUES ('c1', 'Test', 'folder', '#000', '', 0, '2026-01-01', '2026-01-01')",
            [],
        )
        .expect("insert collection");
        conn.execute(
            "INSERT INTO items (id, collection_id, name, folder_path, strategy_type, created_at, updated_at)
             VALUES ('i1', 'c1', 'Game', 'C:\\g', 'game', '2026-01-01', '2026-01-01')",
            [],
        )
        .expect("insert item");
        conn
    }

    fn map(pairs: &[(&str, &str)]) -> HashMap<String, String> {
        pairs.iter().map(|(k, v)| (k.to_string(), v.to_string())).collect()
    }

    #[test]
    fn insert_missing_does_not_overwrite_existing_value() {
        let conn = test_db();
        upsert(&conn, "i1", "exe_path", "C:\\g\\ModOrganizer.exe").unwrap();

        // A rescan re-detects a different exe first (e.g. helper.exe).
        insert_missing(&conn, "i1", &map(&[("exe_path", "C:\\g\\helper.exe")])).unwrap();

        let meta = get_by_item(&conn, "i1").unwrap();
        assert_eq!(meta.get("exe_path").map(String::as_str), Some("C:\\g\\ModOrganizer.exe"));
    }

    #[test]
    fn insert_missing_fills_absent_keys() {
        let conn = test_db();
        insert_missing(&conn, "i1", &map(&[("exe_path", "C:\\g\\Game.exe"), ("mod_folder", "C:\\g\\mods")])).unwrap();

        let meta = get_by_item(&conn, "i1").unwrap();
        assert_eq!(meta.get("exe_path").map(String::as_str), Some("C:\\g\\Game.exe"));
        assert_eq!(meta.get("mod_folder").map(String::as_str), Some("C:\\g\\mods"));
    }

    #[test]
    fn find_item_by_metadata_resolves_and_misses() {
        let conn = test_db();
        upsert(&conn, "i1", "steam_app_id", "1086940").unwrap();

        assert_eq!(find_item_by_metadata(&conn, "steam_app_id", "1086940").unwrap(), Some("i1".to_string()));
        assert_eq!(find_item_by_metadata(&conn, "steam_app_id", "999").unwrap(), None);
    }
}
