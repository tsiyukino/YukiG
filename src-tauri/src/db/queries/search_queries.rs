/// Database query functions for search operations.
///
/// Provides FTS5-backed item search, plain LIKE-based collection/tag search,
/// and a combined `search_all` that returns categorised results.
use rusqlite::{Connection, Result};
use serde::Serialize;

use crate::db::models::{Collection, Item, Tag};

/// Categorised results from a global search across all entity types.
#[derive(Debug, Serialize)]
pub struct SearchAllResult {
    pub collections: Vec<Collection>,
    pub items: Vec<Item>,
    pub tags: Vec<Tag>,
}

// ─── Public search functions ──────────────────────────────────────────────────

/// Searches items across all collections using FTS5 prefix matching.
///
/// Returns items whose name or description matches the query string.
pub fn search_items(conn: &Connection, query: &str) -> Result<Vec<Item>> {
    let safe_query = build_fts_query(query);
    query_fts_items(conn, &safe_query, None)
}

/// Searches items within a specific collection using FTS5 prefix matching.
pub fn search_items_in_collection(
    conn: &Connection,
    collection_id: &str,
    query: &str,
) -> Result<Vec<Item>> {
    let safe_query = build_fts_query(query);
    query_fts_items(conn, &safe_query, Some(collection_id))
}

/// Searches collections, items, and tags, returning results grouped by category.
///
/// Collections and tags are searched with a case-insensitive LIKE query.
/// Items are searched via FTS5 for better relevance ranking.
pub fn search_all(conn: &Connection, query: &str) -> Result<SearchAllResult> {
    let collections = search_collections(conn, query)?;
    let items = search_items(conn, query)?;
    let tags = search_tags(conn, query)?;
    Ok(SearchAllResult { collections, items, tags })
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/// Searches collections by name (case-insensitive substring match).
fn search_collections(conn: &Connection, query: &str) -> Result<Vec<Collection>> {
    let pattern = format!("%{}%", query.replace('%', "\\%").replace('_', "\\_"));
    let mut stmt = conn.prepare(
        "SELECT id, name, icon, color, description, default_strategy, sort_order, created_at, updated_at
         FROM collections
         WHERE name LIKE ?1 ESCAPE '\\'
         ORDER BY name ASC
         LIMIT 20",
    )?;
    let rows = stmt.query_map([&pattern], |row| {
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
    })?;
    rows.collect()
}

/// Searches tags by name (case-insensitive substring match).
fn search_tags(conn: &Connection, query: &str) -> Result<Vec<Tag>> {
    let pattern = format!("%{}%", query.replace('%', "\\%").replace('_', "\\_"));
    let mut stmt = conn.prepare(
        "SELECT id, name, color, group_id, tag_type FROM tags WHERE name LIKE ?1 ESCAPE '\\' ORDER BY name ASC LIMIT 20",
    )?;
    let rows = stmt.query_map([&pattern], |row| {
        Ok(Tag {
            id: row.get(0)?,
            name: row.get(1)?,
            color: row.get(2)?,
            group_id: row.get(3)?,
            tag_type: row.get(4)?,
        })
    })?;
    rows.collect()
}

/// Runs the FTS5 query. If `collection_id` is provided, filters to that collection only.
///
/// fts_items is a standalone FTS5 table (no content= setting). We match against it
/// to get item_ids, then join to items for the full row data.
fn query_fts_items(
    conn: &Connection,
    fts_query: &str,
    collection_id: Option<&str>,
) -> Result<Vec<Item>> {
    let map_item = |row: &rusqlite::Row| {
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
    };

    if let Some(cid) = collection_id {
        let mut stmt = conn.prepare(
            "SELECT i.id, i.collection_id, i.parent_id, i.name, i.folder_path, i.strategy_type,
                    i.category, i.description, i.notes, i.thumbnail_path, i.sort_order,
                    i.is_favorite, i.created_at, i.updated_at
             FROM fts_items f
             JOIN items i ON i.id = f.item_id
             WHERE fts_items MATCH ?1
               AND i.collection_id = ?2
             ORDER BY rank
             LIMIT 50",
        )?;
        let rows = stmt.query_map(rusqlite::params![fts_query, cid], map_item)?;
        rows.collect()
    } else {
        let mut stmt = conn.prepare(
            "SELECT i.id, i.collection_id, i.parent_id, i.name, i.folder_path, i.strategy_type,
                    i.category, i.description, i.notes, i.thumbnail_path, i.sort_order,
                    i.is_favorite, i.created_at, i.updated_at
             FROM fts_items f
             JOIN items i ON i.id = f.item_id
             WHERE fts_items MATCH ?1
             ORDER BY rank
             LIMIT 50",
        )?;
        let rows = stmt.query_map([fts_query], map_item)?;
        rows.collect()
    }
}

/// Builds an FTS5 query that matches all tokens as prefixes.
///
/// Each whitespace-separated word becomes `"word"*` so partial input like
/// "gam" matches "game". Words are AND-ed by FTS5 by default.
fn build_fts_query(query: &str) -> String {
    query
        .split_whitespace()
        .map(|word| {
            let escaped = word.replace('"', "\"\"");
            format!("\"{}\"*", escaped)
        })
        .collect::<Vec<_>>()
        .join(" ")
}
