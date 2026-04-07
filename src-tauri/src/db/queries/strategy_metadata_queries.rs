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
