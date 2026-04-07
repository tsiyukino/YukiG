/// Tauri command handlers for item CRUD operations.
///
/// Commands are thin: they parse input, delegate to query functions,
/// and convert errors to strings for Tauri serialization.
use std::path::Path;
use tauri::State;

use tauri::{AppHandle, Manager};

use crate::db::connection::DbConnection;
use crate::db::models::{Item, UpdateItem};
use crate::db::queries::item_queries::{self, NewItem};
use crate::db::queries::strategy_metadata_queries;
use crate::services::{config, thumbnail};
use crate::strategies::StrategyRegistry;

/// Strategy types that benefit from thumbnail generation on item creation.
const THUMBNAIL_STRATEGIES: &[&str] = &["game"];

/// Returns all game root items (strategy_type IN ('game', 'steam_game')) across all collections.
///
/// Used by the Play page so both local and Steam-imported games appear in the candidate pool.
#[tauri::command]
pub fn item_get_all_games(db: State<DbConnection>) -> Result<Vec<Item>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    item_queries::get_all_games(&conn).map_err(|e| e.to_string())
}

/// Returns all non-Steam root items across all collections in a single query.
///
/// Used by the Status page to avoid N per-collection round trips.
#[tauri::command]
pub fn item_get_all_local(db: State<DbConnection>) -> Result<Vec<Item>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    item_queries::get_all_local(&conn).map_err(|e| e.to_string())
}

/// Returns all root items (parent_id IS NULL) belonging to a collection.
#[tauri::command]
pub fn item_get_by_collection(
    db: State<DbConnection>,
    collection_id: String,
) -> Result<Vec<Item>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    item_queries::get_by_collection(&conn, &collection_id).map_err(|e| e.to_string())
}

/// Returns all child items of a given parent virtual_folder or virtual_group.
#[tauri::command]
pub fn item_get_by_parent(
    db: State<DbConnection>,
    parent_id: String,
) -> Result<Vec<Item>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    item_queries::get_by_parent(&conn, &parent_id).map_err(|e| e.to_string())
}

/// Returns a single item by UUID.
///
/// # Errors
/// Returns an error string if the id does not exist.
#[tauri::command]
pub fn item_get_by_id(db: State<DbConnection>, id: String) -> Result<Item, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    item_queries::get_by_id(&conn, &id).map_err(|e| e.to_string())
}

/// Creates a new item, runs the strategy scan, and persists the scan metadata.
///
/// After the item row is inserted, the selected strategy's `scan()` is called on
/// the folder path. Any discovered metadata (e.g., `exe_path`, `mod_folder`) is
/// stored in `strategy_metadata`. Scan failures are non-fatal — the item is still
/// created and the error is silently ignored so the user can fix metadata manually.
///
/// `parent_id` is optional — when provided, the item is nested inside a
/// virtual_folder or virtual_group instead of appearing at the collection root.
///
/// # Errors
/// Returns an error string if the collection does not exist or the insert fails.
#[tauri::command]
pub fn item_create(
    db: State<DbConnection>,
    registry: State<StrategyRegistry>,
    app: AppHandle,
    collection_id: String,
    name: String,
    folder_path: String,
    strategy_type: String,
    description: String,
    parent_id: Option<String>,
) -> Result<Item, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    // For "file" strategy, detect category from the scan before inserting.
    let category = if strategy_type == "file" {
        registry
            .get("file")
            .ok()
            .and_then(|s| s.scan(Path::new(&folder_path)).ok())
            .and_then(|r| r.metadata.get("category").cloned())
            .unwrap_or_default()
    } else {
        String::new()
    };

    let input = NewItem {
        collection_id,
        parent_id,
        name,
        folder_path: folder_path.clone(),
        strategy_type: strategy_type.clone(),
        category,
        description,
    };
    let item = item_queries::create(&conn, &input).map_err(|e| e.to_string())?;

    // Run the strategy scan and persist metadata. Non-fatal if scan fails.
    if let Ok(strategy) = registry.get(&strategy_type) {
        if let Ok(scan_result) = strategy.scan(Path::new(&folder_path)) {
            let _ = strategy_metadata_queries::upsert_all(&conn, &item.id, &scan_result.metadata);
        }
    }

    // Generate thumbnail at creation time for strategies that use them.
    // Non-fatal — item is still created even if no image is found.
    if THUMBNAIL_STRATEGIES.contains(&strategy_type.as_str()) {
        if let (Ok(default_dd), Ok(config_dir)) = (
            app.path().app_data_dir(),
            app.path().app_config_dir(),
        ) {
            let cfg = config::read(&config_dir).unwrap_or_default();
            let data_dir = config::resolve_data_dir(&cfg, &default_dd);
            if let Ok(thumb_path) = thumbnail::get_or_generate(
                Path::new(&folder_path),
                &item.id,
                &data_dir.join("thumbnails"),
            ) {
                let path_str = thumb_path.to_string_lossy().into_owned();
                let _ = conn.execute(
                    "UPDATE items SET thumbnail_path = ?1 WHERE id = ?2",
                    rusqlite::params![&path_str, &item.id],
                );
                if let Ok(updated) = item_queries::get_by_id(&conn, &item.id) {
                    return Ok(updated);
                }
            }
        }
    }

    Ok(item)
}

/// Updates an item's name, description, strategy_type, notes, and/or parent_id.
///
/// # Errors
/// Returns an error string if the id does not exist or the update fails.
#[tauri::command]
pub fn item_update(
    db: State<DbConnection>,
    id: String,
    name: Option<String>,
    description: Option<String>,
    strategy_type: Option<String>,
    notes: Option<String>,
    parent_id: Option<String>,
) -> Result<Item, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let input = UpdateItem { name, description, strategy_type, notes, parent_id };
    item_queries::update(&conn, &id, &input).map_err(|e| e.to_string())
}

/// Moves an item to a new parent (or to the collection root).
///
/// # Arguments
/// * `id` - The item to move
/// * `new_parent_id` - Some(id) to nest under a folder/group, None to move to root
///
/// # Errors
/// Returns an error string if the item does not exist or the update fails.
#[tauri::command]
pub fn item_reparent(
    db: State<DbConnection>,
    id: String,
    new_parent_id: Option<String>,
) -> Result<Item, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    item_queries::reparent(&conn, &id, new_parent_id.as_deref()).map_err(|e| e.to_string())
}

/// Deletes an item by id. Cascades to strategy_metadata and item_tags.
/// Children with parent_id pointing to this item will have their parent_id set to NULL
/// (ON DELETE SET NULL), making them orphaned at the collection root.
///
/// # Errors
/// Returns an error string if the delete fails.
#[tauri::command]
pub fn item_delete(db: State<DbConnection>, id: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    item_queries::delete(&conn, &id).map_err(|e| e.to_string())
}

/// Deletes a `folder` item and all of its descendants recursively.
///
/// Unlike `item_delete` (which relies on ON DELETE SET NULL to orphan children),
/// this walks the item tree depth-first and deletes every descendant before
/// deleting the folder itself. Use this for disk-backed `folder` strategy items.
///
/// # Errors
/// Returns an error string if any delete fails.
#[tauri::command]
pub fn folder_delete(db: State<DbConnection>, id: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    delete_item_recursive(&conn, &id).map_err(|e| e.to_string())
}

/// Recursively deletes an item and all of its children depth-first.
fn delete_item_recursive(
    conn: &rusqlite::Connection,
    id: &str,
) -> Result<(), crate::strategies::StrategyError> {
    // Fetch direct children and recurse before deleting this node.
    let children = item_queries::get_by_parent(conn, id)
        .map_err(crate::strategies::StrategyError::Database)?;
    for child in children {
        delete_item_recursive(conn, &child.id)?;
    }
    conn.execute("DELETE FROM items WHERE id = ?1", rusqlite::params![id])
        .map_err(crate::strategies::StrategyError::Database)?;
    Ok(())
}

/// Returns every favourited item across all collections, with `header_image` metadata joined in.
///
/// Used by the home dashboard to render local and Steam favourites in a single grid.
///
/// # Errors
/// Returns an error string if the query fails.
#[tauri::command]
pub fn item_get_all_favorites(db: State<DbConnection>) -> Result<Vec<item_queries::FavoriteItem>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    item_queries::get_all_favorites(&conn).map_err(|e| e.to_string())
}

/// Returns all items in a collection where `is_favorite = 1`, regardless of nesting depth.
///
/// Used by the frontend to populate the virtual "Favorites" group without relying on
/// the root-only item list that `item_get_by_collection` returns.
///
/// # Errors
/// Returns an error string if the query fails.
#[tauri::command]
pub fn item_get_favorites(
    db: State<DbConnection>,
    collection_id: String,
) -> Result<Vec<Item>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    item_queries::get_favorites_by_collection(&conn, &collection_id).map_err(|e| e.to_string())
}

/// Sets or clears the `is_favorite` flag on an item.
///
/// # Errors
/// Returns an error string if the item does not exist or the update fails.
#[tauri::command]
pub fn item_set_favorite(
    db: State<DbConnection>,
    id: String,
    is_favorite: bool,
) -> Result<Item, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    item_queries::set_favorite(&conn, &id, is_favorite).map_err(|e| e.to_string())
}

/// Bulk-updates sort_order for multiple items in one transaction.
///
/// Accepts a list of `[id, sort_order]` pairs and applies them atomically.
///
/// # Errors
/// Returns an error string if any update fails.
#[tauri::command]
pub fn item_reorder(
    db: State<DbConnection>,
    order: Vec<(String, i64)>,
) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    item_queries::reorder(&conn, &order).map_err(|e| e.to_string())
}

// folder_import and import_folder_recursive archived — folder strategy removed.
