/// Rust structs that mirror the SQLite database tables.
///
/// These are the canonical data types passed between the database layer
/// and the command/service layers. All fields map directly to database columns.
use serde::{Deserialize, Serialize};

/// Represents a user-created collection that groups related items.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Collection {
    pub id: String,
    pub name: String,
    pub icon: String,
    pub color: String,
    pub description: String,
    pub default_strategy: String,
    pub sort_order: i64,
    pub created_at: String,
    pub updated_at: String,
}

/// Represents a folder (or file) added to a collection.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Item {
    pub id: String,
    /// UUID of the collection this item is filed under, or None for a library
    /// item that belongs to no user collection (e.g. an un-filed Steam game).
    pub collection_id: Option<String>,
    /// UUID of the parent virtual_folder or virtual_group item, or None for root items.
    pub parent_id: Option<String>,
    pub name: String,
    pub folder_path: String,
    pub strategy_type: String,
    /// Detected file category for `"file"` strategy items (e.g. `"image"`, `"pdf"`).
    /// Empty string for all other strategy types.
    pub category: String,
    pub description: String,
    pub notes: String,
    pub thumbnail_path: Option<String>,
    pub sort_order: i64,
    /// True if the user has marked this item as a favourite.
    /// Favourited items are displayed in a virtual "Favorites" group at the top
    /// of the collection view. The item itself stays in its original position.
    pub is_favorite: bool,
    pub created_at: String,
    pub updated_at: String,
}

/// A key-value metadata pair attached to an item, interpreted by its strategy.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StrategyMetadata {
    pub id: String,
    pub item_id: String,
    pub key: String,
    pub value: String,
}

/// A user-created label that can be applied to any item.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tag {
    pub id: String,
    pub name: String,
    pub color: String,
    /// The group this tag belongs to, or None if ungrouped.
    pub group_id: Option<String>,
    /// Tag kind: `category` / `functional` / `element` / `mood` / `steam_collection` / `regular`.
    pub tag_type: String,
}

/// A named group of tags with a user-defined prefix string.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TagGroup {
    pub id: String,
    pub name: String,
    pub prefix: String,
    pub sort_order: i64,
    pub created_at: String,
}

/// Input for creating a new collection. No id or timestamps — those are generated.
#[derive(Debug, Deserialize)]
pub struct NewCollection {
    pub name: String,
    pub icon: String,
    pub color: String,
    pub description: String,
    pub default_strategy: String,
}

/// Input for updating an existing collection. All fields optional (partial update).
#[derive(Debug, Deserialize)]
pub struct UpdateCollection {
    pub name: Option<String>,
    pub icon: Option<String>,
    pub color: Option<String>,
    pub description: Option<String>,
    pub default_strategy: Option<String>,
    pub sort_order: Option<i64>,
}

/// Input for updating an existing item.
#[derive(Debug, Deserialize)]
pub struct UpdateItem {
    pub name: Option<String>,
    pub description: Option<String>,
    pub strategy_type: Option<String>,
    pub notes: Option<String>,
    pub parent_id: Option<String>,
}
