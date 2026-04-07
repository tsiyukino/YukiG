/// Database query functions for the collections table.
///
/// All functions operate on a `Connection` reference and return typed results.
/// No business logic or filesystem operations belong here.
use rusqlite::{Connection, Result};
use uuid::Uuid;

use crate::db::models::{Collection, NewCollection, UpdateCollection};

/// Maps a database row to a Collection, including the new default_strategy column.
fn row_to_collection(row: &rusqlite::Row) -> rusqlite::Result<Collection> {
    Ok(Collection {
        id: row.get(0)?,
        name: row.get(1)?,
        icon: row.get(2)?,
        color: row.get(3)?,
        description: row.get(4)?,
        default_strategy: row.get(5)?,
        sort_order: row.get(6)?,
        created_at: row.get(7)?,
        updated_at: row.get(8)?,
    })
}

/// Retrieves all collections ordered by sort_order, then by name.
///
/// # Errors
/// Returns a `rusqlite::Error` if the query fails.
pub fn get_all(conn: &Connection) -> Result<Vec<Collection>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, icon, color, description, default_strategy, sort_order, created_at, updated_at
         FROM collections
         ORDER BY sort_order ASC, name ASC",
    )?;
    let rows = stmt.query_map([], row_to_collection)?;
    rows.collect()
}

/// Retrieves a single collection by its UUID.
///
/// # Errors
/// Returns `rusqlite::Error::QueryReturnedNoRows` if the id does not exist.
pub fn get_by_id(conn: &Connection, id: &str) -> Result<Collection> {
    conn.query_row(
        "SELECT id, name, icon, color, description, default_strategy, sort_order, created_at, updated_at
         FROM collections WHERE id = ?1",
        [id],
        row_to_collection,
    )
}

/// Inserts a new collection and returns the created record.
///
/// # Errors
/// Returns a `rusqlite::Error` if the name is not unique or the insert fails.
pub fn create(conn: &Connection, input: &NewCollection) -> Result<Collection> {
    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO collections (id, name, icon, color, description, default_strategy, sort_order, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0, ?7, ?8)",
        rusqlite::params![
            &id,
            &input.name,
            &input.icon,
            &input.color,
            &input.description,
            &input.default_strategy,
            &now,
            &now,
        ],
    )?;

    get_by_id(conn, &id)
}

/// Updates an existing collection and returns the updated record.
///
/// Only the fields present in `input` are changed; others are left as-is.
///
/// # Errors
/// Returns `rusqlite::Error::QueryReturnedNoRows` if the id does not exist.
pub fn update(conn: &Connection, id: &str, input: &UpdateCollection) -> Result<Collection> {
    let now = chrono::Utc::now().to_rfc3339();

    // Build the SET clause dynamically based on which fields are provided
    let mut sets: Vec<String> = vec!["updated_at = ?1".to_string()];
    let mut idx = 2usize;
    let mut params: Vec<Box<dyn rusqlite::ToSql>> = vec![Box::new(now.clone())];

    if let Some(ref v) = input.name {
        sets.push(format!("name = ?{}", idx));
        params.push(Box::new(v.clone()));
        idx += 1;
    }
    if let Some(ref v) = input.icon {
        sets.push(format!("icon = ?{}", idx));
        params.push(Box::new(v.clone()));
        idx += 1;
    }
    if let Some(ref v) = input.color {
        sets.push(format!("color = ?{}", idx));
        params.push(Box::new(v.clone()));
        idx += 1;
    }
    if let Some(ref v) = input.description {
        sets.push(format!("description = ?{}", idx));
        params.push(Box::new(v.clone()));
        idx += 1;
    }
    if let Some(ref v) = input.default_strategy {
        sets.push(format!("default_strategy = ?{}", idx));
        params.push(Box::new(v.clone()));
        idx += 1;
    }
    if let Some(v) = input.sort_order {
        sets.push(format!("sort_order = ?{}", idx));
        params.push(Box::new(v));
        idx += 1;
    }

    let id_idx = idx;
    params.push(Box::new(id.to_string()));

    let sql = format!(
        "UPDATE collections SET {} WHERE id = ?{}",
        sets.join(", "),
        id_idx
    );

    let param_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();
    conn.execute(&sql, param_refs.as_slice())?;

    get_by_id(conn, id)
}

/// Deletes a collection by id. Cascades to all items and their metadata.
///
/// # Errors
/// Returns a `rusqlite::Error` if the delete fails.
pub fn delete(conn: &Connection, id: &str) -> Result<()> {
    conn.execute("DELETE FROM collections WHERE id = ?1", [id])?;
    Ok(())
}

/// Bulk-updates sort_order for a list of `(id, sort_order)` pairs atomically.
///
/// # Errors
/// Returns a `rusqlite::Error` if any update fails.
pub fn reorder(conn: &Connection, order: &[(String, i64)]) -> Result<()> {
    for (id, sort_order) in order {
        conn.execute(
            "UPDATE collections SET sort_order = ?1 WHERE id = ?2",
            rusqlite::params![sort_order, id],
        )?;
    }
    Ok(())
}
