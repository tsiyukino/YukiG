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

/// Returns all root items tagged with `tag_id`, ordered like a collection.
///
/// The grouping-tag equivalent of `get_by_collection`: an item belongs to a
/// group when it has an `item_tags` row for that group's tag.
///
/// # Errors
/// Returns a `rusqlite::Error` if the query fails.
pub fn get_by_tag(conn: &Connection, tag_id: &str) -> Result<Vec<Item>> {
    let mut stmt = conn.prepare(
        "SELECT i.id, i.collection_id, i.parent_id, i.name, i.folder_path, i.strategy_type, i.category,
                i.description, i.notes, i.thumbnail_path, i.sort_order, i.is_favorite, i.created_at, i.updated_at
         FROM items i
         JOIN item_tags it ON it.item_id = i.id
         WHERE it.tag_id = ?1 AND i.parent_id IS NULL
         ORDER BY i.sort_order ASC, i.name ASC",
    )?;

    let rows = stmt.query_map([tag_id], map_row)?;
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
    get_favorite_items_where(conn, "i.is_favorite = 1")
}

/// Retrieves every root game item with cover fields, deduplicated.
///
/// Unlike walking each grouping's members (which returns a game once per group
/// it belongs to), this returns each game exactly once — the correct source
/// for an all-games count and the now-playing banner.
///
/// # Errors
/// Returns a `rusqlite::Error` if the query fails.
pub fn get_all_games_full(conn: &Connection) -> Result<Vec<FavoriteItem>> {
    get_favorite_items_where(
        conn,
        "i.parent_id IS NULL AND i.strategy_type IN ('game', 'steam_game')",
    )
}

/// Retrieves root games that are not filed in any collection (library root).
///
/// These are the "unfiled" games shown in the Games page's staging column,
/// from where they can be dragged into a collection.
///
/// # Errors
/// Returns a `rusqlite::Error` if the query fails.
pub fn get_ungrouped_games(conn: &Connection) -> Result<Vec<FavoriteItem>> {
    get_favorite_items_where(
        conn,
        "i.parent_id IS NULL AND i.collection_id IS NULL \
         AND i.strategy_type IN ('game', 'steam_game')",
    )
}

/// Moves an item into a collection, or unfiles it when `collection_id` is None.
///
/// This is the storage-location change behind dragging a game between the
/// unfiled column and a collection (folder-storage model). `parent_id` is
/// cleared too: a moved item lands at the collection's (or library) root, never
/// stranded inside a virtual folder of its old location.
///
/// # Errors
/// Returns a `rusqlite::Error` if the update fails.
pub fn set_collection(conn: &Connection, item_id: &str, collection_id: Option<&str>) -> Result<()> {
    conn.execute(
        "UPDATE items SET collection_id = ?1, parent_id = NULL, updated_at = datetime('now') WHERE id = ?2",
        rusqlite::params![collection_id, item_id],
    )?;
    Ok(())
}

/// Shared body for the cover-joined item queries: same SELECT/JOIN/mapping,
/// parameterised only by the WHERE clause.
fn get_favorite_items_where(conn: &Connection, where_clause: &str) -> Result<Vec<FavoriteItem>> {
    let sql = format!(
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
         WHERE {where_clause}
         ORDER BY i.name ASC"
    );
    let mut stmt = conn.prepare(&sql)?;
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

#[cfg(test)]
mod tests {
    use super::*;

    fn test_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        crate::db::migrations::run(&conn).unwrap();
        conn.execute(
            "INSERT INTO collections (id, name, icon, color, description, sort_order, created_at, updated_at)
             VALUES ('c1', 'RPGs', 'folder', '#000', '', 0, 't', 't')",
            [],
        ).unwrap();
        conn
    }

    fn insert_game(conn: &Connection, id: &str, collection_id: Option<&str>) {
        conn.execute(
            "INSERT INTO items (id, collection_id, name, folder_path, strategy_type, created_at, updated_at)
             VALUES (?1, ?2, ?1, 'C:/g', 'game', 't', 't')",
            rusqlite::params![id, collection_id],
        ).unwrap();
    }

    #[test]
    fn ungrouped_returns_only_unfiled_games() {
        let conn = test_db();
        insert_game(&conn, "filed", Some("c1"));
        insert_game(&conn, "unfiled", None);

        let ids: Vec<String> = get_ungrouped_games(&conn).unwrap().into_iter().map(|g| g.item.id).collect();
        assert_eq!(ids, vec!["unfiled"]);
    }

    #[test]
    fn set_collection_files_and_unfiles() {
        let conn = test_db();
        insert_game(&conn, "g1", None);

        // File into c1.
        set_collection(&conn, "g1", Some("c1")).unwrap();
        let cid: Option<String> = conn
            .query_row("SELECT collection_id FROM items WHERE id = 'g1'", [], |r| r.get(0)).unwrap();
        assert_eq!(cid.as_deref(), Some("c1"));

        // Unfile back to root.
        set_collection(&conn, "g1", None).unwrap();
        let cid2: Option<String> = conn
            .query_row("SELECT collection_id FROM items WHERE id = 'g1'", [], |r| r.get(0)).unwrap();
        assert_eq!(cid2, None);
    }

    #[test]
    fn set_collection_clears_parent_id() {
        let conn = test_db();
        // A virtual folder and a game nested inside it (parent_id set).
        conn.execute(
            "INSERT INTO items (id, collection_id, name, folder_path, strategy_type, created_at, updated_at)
             VALUES ('folder1', 'c1', 'Folder', 'C:/g', 'virtual_folder', 't', 't')",
            [],
        ).unwrap();
        conn.execute(
            "INSERT INTO items (id, collection_id, parent_id, name, folder_path, strategy_type, created_at, updated_at)
             VALUES ('child', 'c1', 'folder1', 'child', 'C:/g', 'game', 't', 't')",
            [],
        ).unwrap();

        // Filing it elsewhere moves it to that collection's root, not a stranded folder.
        set_collection(&conn, "child", None).unwrap();
        let parent: Option<String> = conn
            .query_row("SELECT parent_id FROM items WHERE id = 'child'", [], |r| r.get(0)).unwrap();
        assert_eq!(parent, None, "parent_id must be cleared on move");

        // And it now shows in the ungrouped list.
        let ids: Vec<String> = get_ungrouped_games(&conn).unwrap().into_iter().map(|g| g.item.id).collect();
        assert!(ids.contains(&"child".to_string()));
    }
}
