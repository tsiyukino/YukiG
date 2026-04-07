/// Tauri command handlers for tag, item-tag, and tag-group operations.
use serde::Serialize;
use tauri::State;

use crate::db::connection::DbConnection;
use crate::db::models::{Item, Tag, TagGroup};
use crate::db::queries::{item_queries, tag_queries};

/// A flat row returned by `tag_get_by_collection`, associating an item with a tag.
#[derive(Debug, Serialize)]
pub struct ItemTagRow {
    pub item_id: String,
    pub tag_id: String,
    pub tag_name: String,
    pub tag_color: String,
    /// `"regular"` or `"mood"`.
    pub tag_type: String,
}

// ─── Tags ─────────────────────────────────────────────────────────────────────

/// Returns a map of tag_id → item count for every tag in a single SQL query.
///
/// Tags with zero items are not included in the result.
/// Used by the Status page to avoid N per-tag round trips.
#[tauri::command]
pub fn tag_get_item_counts(
    db: State<DbConnection>,
) -> Result<std::collections::HashMap<String, i64>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    tag_queries::get_item_counts(&conn).map_err(|e| e.to_string())
}

/// Returns all tags ordered alphabetically.
#[tauri::command]
pub fn tag_get_all(db: State<DbConnection>) -> Result<Vec<Tag>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    tag_queries::get_all(&conn).map_err(|e| e.to_string())
}

/// Creates a new ungrouped tag.
#[tauri::command]
pub fn tag_create(db: State<DbConnection>, name: String, color: String) -> Result<Tag, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    tag_queries::create(&conn, &name, &color).map_err(|e| e.to_string())
}

/// Creates a new mood tag (tag_type = 'mood').
///
/// Mood tags appear as filter chips on the Play page. They are distinct from
/// regular organisational tags and are used to express a game's vibe or play style.
///
/// # Errors
/// Returns an error string if the name is not unique or the database write fails.
#[tauri::command]
pub fn tag_create_mood(db: State<DbConnection>, name: String, color: String) -> Result<Tag, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    tag_queries::create_mood(&conn, &name, &color).map_err(|e| e.to_string())
}

/// Ensures a mood tag with the given name exists, creating it if necessary.
///
/// Returns the existing or newly created tag. Used during Steam import/sync to
/// auto-assign category-derived mood tags without creating duplicates.
///
/// # Errors
/// Returns an error string if the database operation fails.
#[tauri::command]
pub fn tag_upsert_mood(db: State<DbConnection>, name: String, color: String) -> Result<Tag, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    tag_queries::upsert_mood(&conn, &name, &color).map_err(|e| e.to_string())
}

/// Creates a new tag inside a specific group.
#[tauri::command]
pub fn tag_create_in_group(
    db: State<DbConnection>,
    name: String,
    color: String,
    group_id: String,
) -> Result<Tag, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    tag_queries::create_in_group(&conn, &name, &color, &group_id).map_err(|e| e.to_string())
}

/// Moves a tag to a different group, or ungroups it (pass null group_id).
#[tauri::command]
pub fn tag_set_group(
    db: State<DbConnection>,
    tag_id: String,
    group_id: Option<String>,
) -> Result<Tag, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    tag_queries::set_group(&conn, &tag_id, group_id.as_deref()).map_err(|e| e.to_string())
}

/// Deletes a tag by id. Cascades to all item_tags rows for this tag.
#[tauri::command]
pub fn tag_delete(db: State<DbConnection>, tag_id: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    tag_queries::delete(&conn, &tag_id).map_err(|e| e.to_string())
}

/// Returns all tags assigned to a specific item.
#[tauri::command]
pub fn tag_get_by_item(db: State<DbConnection>, item_id: String) -> Result<Vec<Tag>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    tag_queries::get_by_item(&conn, &item_id).map_err(|e| e.to_string())
}

/// Returns all (item_id, tag_id, tag_name, tag_color, tag_type) rows for a list of item ids.
///
/// Used by the Play page to bulk-load mood-tag assignments without N queries.
#[tauri::command]
pub fn tag_get_by_items_bulk(
    db: State<DbConnection>,
    item_ids: Vec<String>,
) -> Result<Vec<ItemTagRow>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let pairs = tag_queries::get_by_items_bulk(&conn, &item_ids)
        .map_err(|e| e.to_string())?;
    Ok(pairs
        .into_iter()
        .map(|(item_id, tag)| ItemTagRow {
            item_id,
            tag_id: tag.id,
            tag_name: tag.name,
            tag_color: tag.color,
            tag_type: tag.tag_type,
        })
        .collect())
}

/// Returns all items that have a specific tag assigned.
#[tauri::command]
pub fn tag_get_items(db: State<DbConnection>, tag_id: String) -> Result<Vec<Item>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let item_ids = tag_queries::get_items_by_tag(&conn, &tag_id).map_err(|e| e.to_string())?;
    let mut items = Vec::with_capacity(item_ids.len());
    for id in item_ids {
        if let Ok(item) = item_queries::get_by_id(&conn, &id) {
            items.push(item);
        }
    }
    Ok(items)
}

/// Returns all (item_id, tag_id, tag_name, tag_color) rows for a collection.
#[tauri::command]
pub fn tag_get_by_collection(
    db: State<DbConnection>,
    collection_id: String,
) -> Result<Vec<ItemTagRow>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let pairs = tag_queries::get_by_collection(&conn, &collection_id)
        .map_err(|e| e.to_string())?;
    Ok(pairs
        .into_iter()
        .map(|(item_id, tag)| ItemTagRow {
            item_id,
            tag_id: tag.id,
            tag_name: tag.name,
            tag_color: tag.color,
            tag_type: tag.tag_type,
        })
        .collect())
}

/// Assigns a tag to an item. No-ops if already assigned.
#[tauri::command]
pub fn tag_assign(
    db: State<DbConnection>,
    item_id: String,
    tag_id: String,
) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    tag_queries::assign(&conn, &item_id, &tag_id).map_err(|e| e.to_string())
}

/// Removes a tag from an item.
#[tauri::command]
pub fn tag_remove(
    db: State<DbConnection>,
    item_id: String,
    tag_id: String,
) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    tag_queries::remove(&conn, &item_id, &tag_id).map_err(|e| e.to_string())
}

// ─── Tag groups ───────────────────────────────────────────────────────────────

/// Returns all tag groups ordered by sort_order.
#[tauri::command]
pub fn tag_group_get_all(db: State<DbConnection>) -> Result<Vec<TagGroup>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    tag_queries::get_all_groups(&conn).map_err(|e| e.to_string())
}

/// Creates a new tag group with a name and prefix.
#[tauri::command]
pub fn tag_group_create(
    db: State<DbConnection>,
    name: String,
    prefix: String,
) -> Result<TagGroup, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    tag_queries::create_group(&conn, &name, &prefix).map_err(|e| e.to_string())
}

/// Updates a tag group's name and prefix.
#[tauri::command]
pub fn tag_group_update(
    db: State<DbConnection>,
    group_id: String,
    name: String,
    prefix: String,
) -> Result<TagGroup, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    tag_queries::update_group(&conn, &group_id, &name, &prefix).map_err(|e| e.to_string())
}

/// Deletes a tag group. Tags in this group become ungrouped.
#[tauri::command]
pub fn tag_group_delete(db: State<DbConnection>, group_id: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    tag_queries::delete_group(&conn, &group_id).map_err(|e| e.to_string())
}

/// Bulk-updates sort_order for multiple tag groups in one transaction.
///
/// Accepts a list of `[id, sort_order]` pairs and applies them atomically.
///
/// # Errors
/// Returns an error string if any update fails.
#[tauri::command]
pub fn tag_group_reorder(
    db: State<DbConnection>,
    order: Vec<(String, i64)>,
) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    tag_queries::reorder_groups(&conn, &order).map_err(|e| e.to_string())
}

/// Bulk-updates sort_order for multiple tags in one transaction.
///
/// Accepts a list of `[id, sort_order]` pairs and applies them atomically.
///
/// # Errors
/// Returns an error string if any update fails.
#[tauri::command]
pub fn tag_reorder(
    db: State<DbConnection>,
    order: Vec<(String, i64)>,
) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    tag_queries::reorder_tags(&conn, &order).map_err(|e| e.to_string())
}
