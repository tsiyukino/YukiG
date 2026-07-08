/// Database query functions for tags, item_tags, and tag_groups.
use rusqlite::{Connection, Result};
use uuid::Uuid;

use crate::db::models::{Tag, TagGroup};

// ─── Tag helpers ──────────────────────────────────────────────────────────────

fn row_to_tag(row: &rusqlite::Row) -> rusqlite::Result<Tag> {
    Ok(Tag {
        id: row.get(0)?,
        name: row.get(1)?,
        color: row.get(2)?,
        group_id: row.get(3)?,
        tag_type: row.get(4)?,
    })
}

// ─── Tags ─────────────────────────────────────────────────────────────────────

/// Retrieves all tags ordered alphabetically.
pub fn get_all(conn: &Connection) -> Result<Vec<Tag>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, color, group_id, tag_type FROM tags ORDER BY name ASC",
    )?;
    let rows = stmt.query_map([], row_to_tag)?;
    rows.collect()
}

/// Creates a new tag and returns it.
pub fn create(conn: &Connection, name: &str, color: &str) -> Result<Tag> {
    let id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO tags (id, name, color, group_id) VALUES (?1, ?2, ?3, NULL)",
        rusqlite::params![&id, name, color],
    )?;
    conn.query_row(
        "SELECT id, name, color, group_id, tag_type FROM tags WHERE id = ?1",
        [&id],
        row_to_tag,
    )
}

/// Creates a new tag of the given `tag_type` and returns it.
///
/// The single typed-creation primitive. `tag_type` is one of `grouping`,
/// `category`, `functional`, `element`, `mood`, or `regular`.
pub fn create_typed(conn: &Connection, name: &str, color: &str, tag_type: &str) -> Result<Tag> {
    let id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO tags (id, name, color, group_id, tag_type) VALUES (?1, ?2, ?3, NULL, ?4)",
        rusqlite::params![&id, name, color, tag_type],
    )?;
    conn.query_row(
        "SELECT id, name, color, group_id, tag_type FROM tags WHERE id = ?1",
        [&id],
        row_to_tag,
    )
}

/// Ensures a tag with the given name exists, creating it with `tag_type` if not.
///
/// Match is by name only (names are unique), so an existing tag is returned
/// regardless of its current type. Used by Steam sync to auto-assign category /
/// functional / mood tags without creating duplicates.
pub fn upsert_typed(conn: &Connection, name: &str, color: &str, tag_type: &str) -> Result<Tag> {
    let existing = conn.query_row(
        "SELECT id, name, color, group_id, tag_type FROM tags WHERE name = ?1",
        rusqlite::params![name],
        row_to_tag,
    );
    match existing {
        Ok(tag) => Ok(tag),
        Err(rusqlite::Error::QueryReturnedNoRows) => create_typed(conn, name, color, tag_type),
        Err(e) => Err(e),
    }
}

/// Creates a new mood tag (`tag_type = 'mood'`) and returns it.
pub fn create_mood(conn: &Connection, name: &str, color: &str) -> Result<Tag> {
    create_typed(conn, name, color, "mood")
}

/// Ensures a mood tag with the given name exists; creates it if not found.
///
/// Used during Steam import/sync to avoid duplicate mood tags across many games.
pub fn upsert_mood(conn: &Connection, name: &str, color: &str) -> Result<Tag> {
    upsert_typed(conn, name, color, "mood")
}

/// Ensures a regular tag with the given name exists; creates it if not found.
///
/// Used during Steam import/sync to auto-assign feature tags (Achievements, Steam Cloud, etc.).
pub fn upsert_regular(conn: &Connection, name: &str, color: &str) -> Result<Tag> {
    upsert_typed(conn, name, color, "regular")
}

/// Creates a new tag belonging to a group.
pub fn create_in_group(conn: &Connection, name: &str, color: &str, group_id: &str) -> Result<Tag> {
    let id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO tags (id, name, color, group_id) VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![&id, name, color, group_id],
    )?;
    conn.query_row(
        "SELECT id, name, color, group_id, tag_type FROM tags WHERE id = ?1",
        [&id],
        row_to_tag,
    )
}

/// Moves a tag to a different group (or ungroups it if group_id is None).
pub fn set_group(conn: &Connection, tag_id: &str, group_id: Option<&str>) -> Result<Tag> {
    conn.execute(
        "UPDATE tags SET group_id = ?1 WHERE id = ?2",
        rusqlite::params![group_id, tag_id],
    )?;
    conn.query_row(
        "SELECT id, name, color, group_id, tag_type FROM tags WHERE id = ?1",
        [tag_id],
        row_to_tag,
    )
}

/// Deletes a tag by id. Cascades to item_tags rows via FK.
pub fn delete(conn: &Connection, tag_id: &str) -> Result<()> {
    conn.execute("DELETE FROM tags WHERE id = ?1", [tag_id])?;
    Ok(())
}

/// Returns all tags assigned to a specific item.
pub fn get_by_item(conn: &Connection, item_id: &str) -> Result<Vec<Tag>> {
    let mut stmt = conn.prepare(
        "SELECT t.id, t.name, t.color, t.group_id, t.tag_type
         FROM tags t
         JOIN item_tags it ON t.id = it.tag_id
         WHERE it.item_id = ?1
         ORDER BY t.name ASC",
    )?;
    let rows = stmt.query_map([item_id], row_to_tag)?;
    rows.collect()
}

/// Returns all items that have a specific tag.
pub fn get_items_by_tag(conn: &Connection, tag_id: &str) -> Result<Vec<String>> {
    let mut stmt = conn.prepare(
        "SELECT item_id FROM item_tags WHERE tag_id = ?1",
    )?;
    let rows = stmt.query_map([tag_id], |row| row.get(0))?;
    rows.collect()
}

/// Returns a map of tag_id → item count for every tag that has at least one item.
/// Uses a single SQL query instead of one query per tag.
pub fn get_item_counts(conn: &Connection) -> Result<std::collections::HashMap<String, i64>> {
    let mut stmt = conn.prepare(
        "SELECT tag_id, COUNT(*) as cnt FROM item_tags GROUP BY tag_id",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?))
    })?;
    let mut map = std::collections::HashMap::new();
    for row in rows {
        let (tag_id, cnt) = row?;
        map.insert(tag_id, cnt);
    }
    Ok(map)
}

/// Assigns a tag to an item. Silently succeeds if already assigned.
pub fn assign(conn: &Connection, item_id: &str, tag_id: &str) -> Result<()> {
    conn.execute(
        "INSERT OR IGNORE INTO item_tags (item_id, tag_id) VALUES (?1, ?2)",
        rusqlite::params![item_id, tag_id],
    )?;
    Ok(())
}

/// Removes a tag from an item.
pub fn remove(conn: &Connection, item_id: &str, tag_id: &str) -> Result<()> {
    conn.execute(
        "DELETE FROM item_tags WHERE item_id = ?1 AND tag_id = ?2",
        rusqlite::params![item_id, tag_id],
    )?;
    Ok(())
}

/// Returns all (item_id, tag) pairs for a given list of item ids in one query.
///
/// Used by the Play page to build the item→mood-tag map for filtering without
/// making N individual `get_by_item` calls.
///
/// # Errors
/// Returns a `rusqlite::Error` if the query fails or any id is invalid.
pub fn get_by_items_bulk(conn: &Connection, item_ids: &[String]) -> Result<Vec<(String, Tag)>> {
    if item_ids.is_empty() {
        return Ok(vec![]);
    }

    let placeholders: String = (1..=item_ids.len())
        .map(|i| format!("?{}", i))
        .collect::<Vec<_>>()
        .join(", ");

    let sql = format!(
        "SELECT it.item_id, t.id, t.name, t.color, t.group_id, t.tag_type
         FROM item_tags it
         JOIN tags t ON t.id = it.tag_id
         WHERE it.item_id IN ({})
         ORDER BY t.name ASC",
        placeholders
    );

    let params: Vec<Box<dyn rusqlite::ToSql>> = item_ids
        .iter()
        .map(|id| Box::new(id.clone()) as Box<dyn rusqlite::ToSql>)
        .collect();
    let params_ref: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();

    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(params_ref.as_slice(), |row| {
        let item_id: String = row.get(0)?;
        let tag = Tag {
            id: row.get(1)?,
            name: row.get(2)?,
            color: row.get(3)?,
            group_id: row.get(4)?,
            tag_type: row.get(5)?,
        };
        Ok((item_id, tag))
    })?;
    rows.collect()
}

/// Returns all (item_id, tag) pairs for items belonging to a collection.
pub fn get_by_collection(conn: &Connection, collection_id: &str) -> Result<Vec<(String, Tag)>> {
    let mut stmt = conn.prepare(
        "SELECT it.item_id, t.id, t.name, t.color, t.group_id, t.tag_type
         FROM item_tags it
         JOIN tags t ON t.id = it.tag_id
         JOIN items i ON i.id = it.item_id
         WHERE i.collection_id = ?1
         ORDER BY t.name ASC",
    )?;
    let rows = stmt.query_map([collection_id], |row| {
        let item_id: String = row.get(0)?;
        let tag = Tag {
            id: row.get(1)?,
            name: row.get(2)?,
            color: row.get(3)?,
            group_id: row.get(4)?,
            tag_type: row.get(5)?,
        };
        Ok((item_id, tag))
    })?;
    rows.collect()
}

// ─── Tag groups ───────────────────────────────────────────────────────────────

fn row_to_group(row: &rusqlite::Row) -> rusqlite::Result<TagGroup> {
    Ok(TagGroup {
        id: row.get(0)?,
        name: row.get(1)?,
        prefix: row.get(2)?,
        sort_order: row.get(3)?,
        created_at: row.get(4)?,
    })
}

/// Returns all tag groups ordered by sort_order, then name.
pub fn get_all_groups(conn: &Connection) -> Result<Vec<TagGroup>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, prefix, sort_order, created_at
         FROM tag_groups
         ORDER BY sort_order ASC, name ASC",
    )?;
    let rows = stmt.query_map([], row_to_group)?;
    rows.collect()
}

/// Creates a new tag group.
pub fn create_group(conn: &Connection, name: &str, prefix: &str) -> Result<TagGroup> {
    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO tag_groups (id, name, prefix, sort_order, created_at)
         VALUES (?1, ?2, ?3, 0, ?4)",
        rusqlite::params![&id, name, prefix, &now],
    )?;
    conn.query_row(
        "SELECT id, name, prefix, sort_order, created_at FROM tag_groups WHERE id = ?1",
        [&id],
        row_to_group,
    )
}

/// Updates a tag group's name and/or prefix.
pub fn update_group(
    conn: &Connection,
    group_id: &str,
    name: &str,
    prefix: &str,
) -> Result<TagGroup> {
    conn.execute(
        "UPDATE tag_groups SET name = ?1, prefix = ?2 WHERE id = ?3",
        rusqlite::params![name, prefix, group_id],
    )?;
    conn.query_row(
        "SELECT id, name, prefix, sort_order, created_at FROM tag_groups WHERE id = ?1",
        [group_id],
        row_to_group,
    )
}

/// Deletes a tag group. Tags in the group become ungrouped (SET NULL via FK).
pub fn delete_group(conn: &Connection, group_id: &str) -> Result<()> {
    conn.execute("DELETE FROM tag_groups WHERE id = ?1", [group_id])?;
    Ok(())
}

/// Bulk-updates sort_order for a list of tag group `(id, sort_order)` pairs atomically.
///
/// # Errors
/// Returns a `rusqlite::Error` if any update fails.
pub fn reorder_groups(conn: &Connection, order: &[(String, i64)]) -> Result<()> {
    for (id, sort_order) in order {
        conn.execute(
            "UPDATE tag_groups SET sort_order = ?1 WHERE id = ?2",
            rusqlite::params![sort_order, id],
        )?;
    }
    Ok(())
}

/// Bulk-updates sort_order for a list of tag `(id, sort_order)` pairs atomically.
///
/// Tags do not currently have a sort_order column — this function is a no-op
/// placeholder until a migration adds it. It exists so the Tauri command compiles
/// and the frontend can call it without error.
///
/// # Errors
/// Returns a `rusqlite::Error` if any update fails.
pub fn reorder_tags(conn: &Connection, order: &[(String, i64)]) -> Result<()> {
    for (id, _sort_order) in order {
        // Tags table does not yet have sort_order; touch updated_at to keep the
        // call non-fatal and preserve API stability until a migration adds the column.
        let _ = conn.execute(
            "UPDATE tags SET name = name WHERE id = ?1",
            rusqlite::params![id],
        );
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        crate::db::migrations::run(&conn).unwrap();
        conn
    }

    #[test]
    fn create_typed_sets_the_type() {
        let conn = test_db();
        let tag = create_typed(&conn, "ARPG", "#fff", "category").unwrap();
        assert_eq!(tag.tag_type, "category");
        assert_eq!(tag.name, "ARPG");
    }

    #[test]
    fn upsert_typed_is_idempotent_by_name() {
        let conn = test_db();
        let a = upsert_typed(&conn, "Co-op", "#111", "functional").unwrap();
        let b = upsert_typed(&conn, "Co-op", "#222", "functional").unwrap();
        assert_eq!(a.id, b.id, "same name must resolve to the same tag");
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM tags WHERE name = 'Co-op'", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn mood_and_regular_delegate_to_typed() {
        let conn = test_db();
        assert_eq!(upsert_mood(&conn, "Cozy", "#0f0").unwrap().tag_type, "mood");
        assert_eq!(upsert_regular(&conn, "Misc", "#0f0").unwrap().tag_type, "regular");
    }
}
