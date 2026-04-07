/// Tauri command handlers for collection CRUD operations.
///
/// Commands are thin: they parse input, delegate to query functions,
/// and convert errors to strings for Tauri serialization.
use tauri::State;

use crate::db::connection::DbConnection;
use crate::db::models::{Collection, NewCollection, UpdateCollection};
use crate::db::queries::collection_queries;

/// Returns all collections ordered by sort_order, then name.
#[tauri::command]
pub fn collection_get_all(db: State<DbConnection>) -> Result<Vec<Collection>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    collection_queries::get_all(&conn).map_err(|e| e.to_string())
}

/// Returns a single collection by UUID.
///
/// # Errors
/// Returns an error string if the id does not exist.
#[tauri::command]
pub fn collection_get_by_id(db: State<DbConnection>, id: String) -> Result<Collection, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    collection_queries::get_by_id(&conn, &id).map_err(|e| e.to_string())
}

/// Creates a new collection and returns the created record.
///
/// # Errors
/// Returns an error string if the name is already taken.
#[tauri::command]
pub fn collection_create(
    db: State<DbConnection>,
    name: String,
    icon: String,
    color: String,
    description: String,
    default_strategy: String,
) -> Result<Collection, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let input = NewCollection { name, icon, color, description, default_strategy };
    collection_queries::create(&conn, &input).map_err(|e| e.to_string())
}

/// Updates an existing collection. Only provided fields are changed.
///
/// # Errors
/// Returns an error string if the id does not exist or the new name is taken.
#[tauri::command]
pub fn collection_update(
    db: State<DbConnection>,
    id: String,
    name: Option<String>,
    icon: Option<String>,
    color: Option<String>,
    description: Option<String>,
    default_strategy: Option<String>,
    sort_order: Option<i64>,
) -> Result<Collection, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let input = UpdateCollection { name, icon, color, description, default_strategy, sort_order };
    collection_queries::update(&conn, &id, &input).map_err(|e| e.to_string())
}

/// Deletes a collection and all its items (cascade).
///
/// # Errors
/// Returns an error string if the delete fails.
#[tauri::command]
pub fn collection_delete(db: State<DbConnection>, id: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    collection_queries::delete(&conn, &id).map_err(|e| e.to_string())
}

/// Bulk-updates sort_order for multiple collections in one transaction.
///
/// Accepts a list of `[id, sort_order]` pairs and applies them atomically.
///
/// # Errors
/// Returns an error string if any update fails.
#[tauri::command]
pub fn collection_reorder(
    db: State<DbConnection>,
    order: Vec<(String, i64)>,
) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    collection_queries::reorder(&conn, &order).map_err(|e| e.to_string())
}
