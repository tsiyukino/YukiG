/// Database query functions for the items table.
///
/// All functions operate on a `Connection` reference and return typed results.
/// No business logic or filesystem operations belong here.
use rusqlite::{Connection, Result};
use serde::Serialize;
use uuid::Uuid;

use crate::db::models::{Item, UpdateItem};

/// An item marked as favourite, extended with Steam image metadata.
///
/// Used by the home dashboard to render Steam and local favourites in the same grid
/// without requiring a separate per-item metadata fetch.
#[derive(Debug, Clone, Serialize)]
pub struct FavoriteItem {
    #[serde(flatten)]
    pub item: Item,
    /// `header_image` from strategy_metadata, or None for non-Steam items.
    pub header_image: Option<String>,
    /// `icon_url` from strategy_metadata — fast-loading square community icon.
    /// Reliable for all Steam games. None for non-Steam items.
    pub icon_url: Option<String>,
}

/// Input for creating a new item.
#[derive(Debug)]
pub struct NewItem {
    /// Collection to file the item under, or None for a library item that
    /// belongs to no collection (e.g. an un-filed Steam game).
    pub collection_id: Option<String>,
    /// UUID of the parent virtual_folder or virtual_group item, or None for root.
    pub parent_id: Option<String>,
    pub name: String,
    pub folder_path: String,
    pub strategy_type: String,
    /// Detected file category for `"file"` items (e.g. `"image"`). Empty for others.
    pub category: String,
    pub description: String,
}

/// Retrieves every root game item (strategy_type IN ('game', 'steam_game')) across all collections.
///
/// Used by the Play page so both local and Steam-imported games appear in the pool.
///
/// # Errors
/// Returns a `rusqlite::Error` if the query fails.
pub fn get_all_games(conn: &Connection) -> Result<Vec<Item>> {
    let mut stmt = conn.prepare(
        "SELECT id, collection_id, parent_id, name, folder_path, strategy_type, category,
                description, notes, thumbnail_path, sort_order, is_favorite, created_at, updated_at
         FROM items
         WHERE parent_id IS NULL AND strategy_type IN ('game', 'steam_game')
         ORDER BY collection_id, sort_order ASC, name ASC",
    )?;
    let rows = stmt.query_map([], map_row)?;
    rows.collect()
}

/// Retrieves every non-Steam root item across all collections in a single query.
///
/// Used by the Status page to avoid N per-collection round trips.
/// Steam games (strategy_type = "steam_game") are excluded.
///
/// # Errors
/// Returns a `rusqlite::Error` if the query fails.
pub fn get_all_local(conn: &Connection) -> Result<Vec<Item>> {
    let mut stmt = conn.prepare(
        "SELECT id, collection_id, parent_id, name, folder_path, strategy_type, category,
                description, notes, thumbnail_path, sort_order, is_favorite, created_at, updated_at
         FROM items
         WHERE parent_id IS NULL AND strategy_type != 'steam_game'
         ORDER BY collection_id, sort_order ASC, name ASC",
    )?;
    let rows = stmt.query_map([], map_row)?;
    rows.collect()
}

/// Retrieves all root items (parent_id IS NULL) belonging to a collection,
/// ordered by sort_order then name.
///
/// # Errors
/// Returns a `rusqlite::Error` if the query fails.
pub fn get_by_collection(conn: &Connection, collection_id: &str) -> Result<Vec<Item>> {
    let mut stmt = conn.prepare(
        "SELECT id, collection_id, parent_id, name, folder_path, strategy_type, category,
                description, notes, thumbnail_path, sort_order, is_favorite, created_at, updated_at
         FROM items
         WHERE collection_id = ?1 AND parent_id IS NULL
         ORDER BY sort_order ASC, name ASC",
    )?;

    let rows = stmt.query_map([collection_id], map_row)?;
    rows.collect()
}

/// Retrieves all child items of a given parent item (virtual_folder or virtual_group),
/// ordered by sort_order then name.
///
/// # Errors
/// Returns a `rusqlite::Error` if the query fails.
pub fn get_by_parent(conn: &Connection, parent_id: &str) -> Result<Vec<Item>> {
    let mut stmt = conn.prepare(
        "SELECT id, collection_id, parent_id, name, folder_path, strategy_type, category,
                description, notes, thumbnail_path, sort_order, is_favorite, created_at, updated_at
         FROM items
         WHERE parent_id = ?1
         ORDER BY sort_order ASC, name ASC",
    )?;

    let rows = stmt.query_map([parent_id], map_row)?;
    rows.collect()
}

/// Retrieves a single item by its UUID.
///
/// # Errors
/// Returns `rusqlite::Error::QueryReturnedNoRows` if the id does not exist.
pub fn get_by_id(conn: &Connection, id: &str) -> Result<Item> {
    conn.query_row(
        "SELECT id, collection_id, parent_id, name, folder_path, strategy_type, category,
                description, notes, thumbnail_path, sort_order, is_favorite, created_at, updated_at
         FROM items WHERE id = ?1",
        [id],
        map_row,
    )
}

/// Inserts a new item and returns the created record.
///
/// # Errors
/// Returns a `rusqlite::Error` if the insert fails.
pub fn create(conn: &Connection, input: &NewItem) -> Result<Item> {
    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO items
             (id, collection_id, parent_id, name, folder_path, strategy_type, category,
              description, notes, thumbnail_path, sort_order, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, '', NULL, 0, ?9, ?10)",
        rusqlite::params![
            &id,
            &input.collection_id,
            &input.parent_id,
            &input.name,
            &input.folder_path,
            &input.strategy_type,
            &input.category,
            &input.description,
            &now,
            &now,
        ],
    )?;

    get_by_id(conn, &id)
}

/// Updates an existing item's fields. Only provided fields are changed.
/// Returns the updated record.
///
/// # Errors
/// Returns `rusqlite::Error::QueryReturnedNoRows` if the id does not exist.
pub fn update(conn: &Connection, id: &str, input: &UpdateItem) -> Result<Item> {
    let now = chrono::Utc::now().to_rfc3339();
    let mut sets: Vec<String> = vec!["updated_at = ?1".to_string()];
    let mut idx = 2usize;
    let mut params: Vec<Box<dyn rusqlite::ToSql>> = vec![Box::new(now)];

    if let Some(ref v) = input.name {
        sets.push(format!("name = ?{}", idx));
        params.push(Box::new(v.clone()));
        idx += 1;
    }
    if let Some(ref v) = input.description {
        sets.push(format!("description = ?{}", idx));
        params.push(Box::new(v.clone()));
        idx += 1;
    }
    if let Some(ref v) = input.strategy_type {
        sets.push(format!("strategy_type = ?{}", idx));
        params.push(Box::new(v.clone()));
        idx += 1;
    }
    if let Some(ref v) = input.notes {
        sets.push(format!("notes = ?{}", idx));
        params.push(Box::new(v.clone()));
        idx += 1;
    }
    if let Some(ref v) = input.parent_id {
        sets.push(format!("parent_id = ?{}", idx));
        params.push(Box::new(v.clone()));
        idx += 1;
    }

    let id_idx = idx;
    params.push(Box::new(id.to_string()));
    let sql = format!("UPDATE items SET {} WHERE id = ?{}", sets.join(", "), id_idx);
    let param_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();
    conn.execute(&sql, param_refs.as_slice())?;

    get_by_id(conn, id)
}

/// Sets an item's parent_id to a new value or NULL (move to collection root).
///
/// # Arguments
/// * `id` - The item to move
/// * `new_parent_id` - Some(&str) to nest under a folder/group, None to move to root
///
/// # Errors
/// Returns a `rusqlite::Error` if the update fails.
pub fn reparent(conn: &Connection, id: &str, new_parent_id: Option<&str>) -> Result<Item> {
    match new_parent_id {
        Some(pid) => conn.execute(
            "UPDATE items SET parent_id = ?1, updated_at = datetime('now') WHERE id = ?2",
            rusqlite::params![pid, id],
        )?,
        None => conn.execute(
            "UPDATE items SET parent_id = NULL, updated_at = datetime('now') WHERE id = ?1",
            [id],
        )?,
    };
    get_by_id(conn, id)
}

/// Deletes an item by id. Cascades to strategy_metadata and item_tags.
/// Children with parent_id pointing to this item have their parent_id set to NULL
/// (ON DELETE SET NULL), surfacing them at the collection root.
///
/// # Errors
/// Returns a `rusqlite::Error` if the delete fails.
pub fn delete(conn: &Connection, id: &str) -> Result<()> {
    conn.execute("DELETE FROM items WHERE id = ?1", [id])?;
    Ok(())
}

/// Bulk-updates sort_order for a list of `(id, sort_order)` pairs atomically.
///
/// # Errors
/// Returns a `rusqlite::Error` if any update fails.
pub fn reorder(conn: &Connection, order: &[(String, i64)]) -> Result<()> {
    for (id, sort_order) in order {
        conn.execute(
            "UPDATE items SET sort_order = ?1 WHERE id = ?2",
            rusqlite::params![sort_order, id],
        )?;
    }
    Ok(())
}

/// Retrieves all items in a collection where `is_favorite = 1`, regardless of nesting depth.
///
/// Used to populate the virtual "Favorites" group which must surface items even when
/// they are inside virtual_group or virtual_folder containers.
///
/// # Errors
/// Returns a `rusqlite::Error` if the query fails.
pub fn get_favorites_by_collection(conn: &Connection, collection_id: &str) -> Result<Vec<Item>> {
    let mut stmt = conn.prepare(
        "SELECT id, collection_id, parent_id, name, folder_path, strategy_type, category,
                description, notes, thumbnail_path, sort_order, is_favorite, created_at, updated_at
         FROM items
         WHERE collection_id = ?1 AND is_favorite = 1
         ORDER BY sort_order ASC, name ASC",
    )?;
    let rows = stmt.query_map([collection_id], map_row)?;
    rows.collect()
}

/// Retrieves every favourited item across all collections, with its `header_image`
/// strategy metadata joined in. Used by the home dashboard to render a merged
/// favourites grid (local + Steam) without requiring a per-item metadata fetch.
///
/// # Errors
/// Returns a `rusqlite::Error` if the query fails.
pub fn get_all_favorites(conn: &Connection) -> Result<Vec<FavoriteItem>> {
    let mut stmt = conn.prepare(
        "SELECT i.id, i.collection_id, i.parent_id, i.name, i.folder_path, i.strategy_type,
                i.category, i.description, i.notes, i.thumbnail_path, i.sort_order,
                i.is_favorite, i.created_at, i.updated_at,
                sm_header.value AS header_image,
                sm_icon.value   AS icon_url
         FROM items i
         LEFT JOIN strategy_metadata sm_header
               ON sm_header.item_id = i.id AND sm_header.key = 'header_image'
         LEFT JOIN strategy_metadata sm_icon
               ON sm_icon.item_id = i.id AND sm_icon.key = 'icon_url'
         WHERE i.is_favorite = 1
         ORDER BY i.name ASC",
    )?;
    let rows = stmt.query_map([], |row| {
        let is_fav: i64 = row.get(11)?;
        Ok(FavoriteItem {
            item: Item {
                id: row.get(0)?,
                collection_id: row.get(1)?,
                parent_id: row.get(2)?,
                name: row.get(3)?,
                folder_path: row.get(4)?,
                strategy_type: row.get(5)?,
                category: row.get(6)?,
                description: row.get(7)?,
                notes: row.get(8)?,
                thumbnail_path: row.get(9)?,
                sort_order: row.get(10)?,
                is_favorite: is_fav != 0,
                created_at: row.get(12)?,
                updated_at: row.get(13)?,
            },
            header_image: row.get(14)?,
            icon_url: row.get(15)?,
        })
    })?;
    rows.collect()
}

/// Sets or clears the `is_favorite` flag for an item. Returns the updated record.
///
/// # Errors
/// Returns `rusqlite::Error::QueryReturnedNoRows` if the id does not exist.
pub fn set_favorite(conn: &Connection, id: &str, is_favorite: bool) -> Result<Item> {
    conn.execute(
        "UPDATE items SET is_favorite = ?1, updated_at = datetime('now') WHERE id = ?2",
        rusqlite::params![is_favorite as i32, id],
    )?;
    get_by_id(conn, id)
}

/// Maps a database row to an `Item` struct.
fn map_row(row: &rusqlite::Row) -> rusqlite::Result<Item> {
    let is_fav: i32 = row.get(11)?;
    Ok(Item {
        id: row.get(0)?,
        collection_id: row.get(1)?,
        parent_id: row.get(2)?,
        name: row.get(3)?,
        folder_path: row.get(4)?,
        strategy_type: row.get(5)?,
        category: row.get(6)?,
        description: row.get(7)?,
        notes: row.get(8)?,
        thumbnail_path: row.get(9)?,
        sort_order: row.get(10)?,
        is_favorite: is_fav != 0,
        created_at: row.get(12)?,
        updated_at: row.get(13)?,
    })
}
