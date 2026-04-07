/// Tauri command handlers for search operations.
use tauri::State;

use crate::db::connection::DbConnection;
use crate::db::models::Item;
use crate::db::queries::search_queries;

/// Searches items across all collections using full-text search.
///
/// Returns items matching the query in name or description, ordered by relevance.
#[tauri::command]
pub fn search_items(db: State<DbConnection>, query: String) -> Result<Vec<Item>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    search_queries::search_items(&conn, &query).map_err(|e| e.to_string())
}

/// Searches collections, items, and tags in one call.
///
/// Returns a `SearchAllResult` with three categorised lists. Each category
/// is queried independently so results are always grouped by type.
///
/// # Errors
/// Returns an error string if any query fails.
#[tauri::command]
pub fn search_all(
    db: State<DbConnection>,
    query: String,
) -> Result<search_queries::SearchAllResult, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    search_queries::search_all(&conn, &query).map_err(|e| e.to_string())
}

/// Searches items within a specific collection.
///
/// Limits FTS results to items belonging to `collection_id`.
///
/// # Errors
/// Returns an error string if the query fails.
#[tauri::command]
pub fn search_items_in_collection(
    db: State<DbConnection>,
    collection_id: String,
    query: String,
) -> Result<Vec<Item>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    search_queries::search_items_in_collection(&conn, &collection_id, &query)
        .map_err(|e| e.to_string())
}
