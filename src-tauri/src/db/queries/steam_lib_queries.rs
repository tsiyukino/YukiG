/// Database queries backing the Steam page's library view.
///
/// The Steam page reads its games from the library (imported `steam_game`
/// items) rather than from the in-memory scan, so every game is a first-class
/// `Item` with a stable id — the same object local games use. This module
/// gathers, in one query, each Steam item plus the Steam-specific display
/// fields that live in `strategy_metadata`, and the names of the
/// `steam_collection` tags it belongs to.
use rusqlite::{Connection, Result};

use crate::db::models::Item;

/// A Steam library game as shown on the Steam page: the unified `Item` plus the
/// Steam cover art, install/size/playtime facts, and the Steam Collections it
/// belongs to (by name).
#[derive(Debug, Clone, serde::Serialize)]
pub struct SteamLibItem {
    #[serde(flatten)]
    pub item: Item,
    /// Steam app id (from the `steam_app_id` metadata key).
    pub app_id: u64,
    pub is_installed: bool,
    pub size_on_disk: u64,
    pub playtime_minutes: u64,
    pub icon_url: String,
    pub header_image: String,
    pub library_image: String,
    pub library_hero: String,
    pub library_logo: String,
    /// Names of the Steam Collections this game is in (both `steam_collection`
    /// and the built-in `steam_favorites`).
    pub collections: Vec<String>,
    /// Name of the `steam_favorites` collection if this game is in it, so the
    /// page can pin that group to the top of the sidebar. None otherwise.
    pub favorites_name: Option<String>,
}

/// Returns every imported Steam game with its display fields and collection names.
///
/// One row per `steam_game` item. Steam cover/fact fields are pulled from
/// `strategy_metadata`; collection names are aggregated from the item's
/// `steam_collection` tags via a grouped join. Absent metadata yields empty
/// strings / zero, matching how the scan-based path degrades.
///
/// # Errors
/// Returns a `rusqlite::Error` if the query fails.
pub fn get_steam_library(conn: &Connection) -> Result<Vec<SteamLibItem>> {
    let mut stmt = conn.prepare(
        "SELECT i.id, i.collection_id, i.parent_id, i.name, i.folder_path, i.strategy_type,
                i.category, i.description, i.notes, i.thumbnail_path, i.sort_order,
                i.is_favorite, i.created_at, i.updated_at,
                COALESCE(m_app.value, '0')      AS app_id,
                COALESCE(m_inst.value, 'false') AS is_installed,
                COALESCE(m_size.value, '0')     AS size_on_disk,
                COALESCE(m_play.value, '0')     AS playtime_minutes,
                COALESCE(m_icon.value, '')      AS icon_url,
                COALESCE(m_head.value, '')      AS header_image,
                COALESCE(m_libi.value, '')      AS library_image,
                COALESCE(m_hero.value, '')      AS library_hero,
                COALESCE(m_logo.value, '')      AS library_logo,
                (SELECT GROUP_CONCAT(t.name, char(10))
                   FROM item_tags it
                   JOIN tags t ON t.id = it.tag_id
                  WHERE it.item_id = i.id
                    AND t.tag_type IN ('steam_collection', 'steam_favorites')) AS collections,
                (SELECT t.name
                   FROM item_tags it
                   JOIN tags t ON t.id = it.tag_id
                  WHERE it.item_id = i.id AND t.tag_type = 'steam_favorites'
                  LIMIT 1) AS favorites_name
         FROM items i
         LEFT JOIN strategy_metadata m_app  ON m_app.item_id  = i.id AND m_app.key  = 'steam_app_id'
         LEFT JOIN strategy_metadata m_inst ON m_inst.item_id = i.id AND m_inst.key = 'is_installed'
         LEFT JOIN strategy_metadata m_size ON m_size.item_id = i.id AND m_size.key = 'size_on_disk'
         LEFT JOIN strategy_metadata m_play ON m_play.item_id = i.id AND m_play.key = 'steam_playtime_minutes'
         LEFT JOIN strategy_metadata m_icon ON m_icon.item_id = i.id AND m_icon.key = 'icon_url'
         LEFT JOIN strategy_metadata m_head ON m_head.item_id = i.id AND m_head.key = 'header_image'
         LEFT JOIN strategy_metadata m_libi ON m_libi.item_id = i.id AND m_libi.key = 'library_image'
         LEFT JOIN strategy_metadata m_hero ON m_hero.item_id = i.id AND m_hero.key = 'library_hero'
         LEFT JOIN strategy_metadata m_logo ON m_logo.item_id = i.id AND m_logo.key = 'library_logo'
         WHERE i.parent_id IS NULL AND i.strategy_type = 'steam_game'
         ORDER BY i.name ASC",
    )?;

    let rows = stmt.query_map([], |row| {
        let is_fav: i64 = row.get(11)?;
        let collections: Option<String> = row.get(23)?;
        Ok(SteamLibItem {
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
            app_id: row.get::<_, String>(14)?.parse().unwrap_or(0),
            is_installed: row.get::<_, String>(15)? == "true",
            size_on_disk: row.get::<_, String>(16)?.parse().unwrap_or(0),
            playtime_minutes: row.get::<_, String>(17)?.parse().unwrap_or(0),
            icon_url: row.get(18)?,
            header_image: row.get(19)?,
            library_image: row.get(20)?,
            library_hero: row.get(21)?,
            library_logo: row.get(22)?,
            collections: collections
                .filter(|s| !s.is_empty())
                .map(|s| s.split('\n').map(str::to_string).collect())
                .unwrap_or_default(),
            favorites_name: row.get(24)?,
        })
    })?;
    rows.collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_db() -> Connection {
        let conn = Connection::open_in_memory().expect("open in-memory db");
        crate::db::migrations::run(&conn).expect("apply migrations");
        conn
    }

    /// Inserts a steam_game item with the given metadata and returns its id.
    fn insert_steam(conn: &Connection, id: &str, name: &str, app_id: &str, installed: bool) {
        conn.execute(
            "INSERT INTO items (id, collection_id, name, folder_path, strategy_type, created_at, updated_at)
             VALUES (?1, 'steam-system', ?2, 'C:/g', 'steam_game', 't', 't')",
            rusqlite::params![id, name],
        ).unwrap();
        for (k, v) in [
            ("steam_app_id", app_id),
            ("is_installed", if installed { "true" } else { "false" }),
            ("steam_playtime_minutes", "120"),
            ("library_image", "http://img/cap.jpg"),
        ] {
            conn.execute(
                "INSERT INTO strategy_metadata (id, item_id, key, value) VALUES (?1, ?2, ?3, ?4)",
                rusqlite::params![format!("{id}-{k}"), id, k, v],
            ).unwrap();
        }
    }

    #[test]
    fn returns_steam_items_with_metadata() {
        let conn = test_db();
        insert_steam(&conn, "s1", "Zomboid", "108600", true);
        let lib = get_steam_library(&conn).unwrap();
        assert_eq!(lib.len(), 1);
        let g = &lib[0];
        assert_eq!(g.item.name, "Zomboid");
        assert_eq!(g.app_id, 108600);
        assert!(g.is_installed);
        assert_eq!(g.playtime_minutes, 120);
        assert_eq!(g.library_image, "http://img/cap.jpg");
    }

    #[test]
    fn excludes_local_games_and_aggregates_collections() {
        let conn = test_db();
        insert_steam(&conn, "s1", "Game", "10", true);
        conn.execute(
            "INSERT INTO items (id, collection_id, name, folder_path, strategy_type, created_at, updated_at)
             VALUES ('l1', NULL, 'LocalOnly', 'C:/l', 'game', 't', 't')",
            [],
        ).unwrap();
        // Two steam_collection tags and one regular tag; only the former two count.
        conn.execute_batch(
            "INSERT INTO tags (id, name, color, group_id, tag_type) VALUES
                ('t-a', 'Action', '#66c0f4', NULL, 'steam_collection'),
                ('t-b', 'Backlog', '#66c0f4', NULL, 'steam_collection'),
                ('t-r', 'Mine', '#999', NULL, 'regular');
             INSERT INTO item_tags (item_id, tag_id) VALUES ('s1','t-a'), ('s1','t-b'), ('s1','t-r');",
        ).unwrap();

        let lib = get_steam_library(&conn).unwrap();
        assert_eq!(lib.len(), 1, "local games are excluded");
        let mut cols = lib[0].collections.clone();
        cols.sort();
        assert_eq!(cols, vec!["Action", "Backlog"], "only steam_collection tags, regular excluded");
    }

    #[test]
    fn empty_collections_when_no_tags() {
        let conn = test_db();
        insert_steam(&conn, "s1", "Solo", "5", false);
        let lib = get_steam_library(&conn).unwrap();
        assert!(lib[0].collections.is_empty());
        assert!(lib[0].favorites_name.is_none());
        assert!(!lib[0].is_installed);
    }

    #[test]
    fn favorites_tag_appears_in_collections_and_favorites_name() {
        let conn = test_db();
        insert_steam(&conn, "s1", "Game", "10", true);
        // A regular collection and the built-in favorites collection.
        conn.execute_batch(
            "INSERT INTO tags (id, name, color, group_id, tag_type) VALUES
                ('t-a',   'Action',  '#66c0f4', NULL, 'steam_collection'),
                ('t-fav', '收藏夹',   '#66c0f4', NULL, 'steam_favorites');
             INSERT INTO item_tags (item_id, tag_id) VALUES ('s1','t-a'), ('s1','t-fav');",
        ).unwrap();

        let lib = get_steam_library(&conn).unwrap();
        let mut cols = lib[0].collections.clone();
        cols.sort();
        assert_eq!(cols, vec!["Action", "收藏夹"], "favorites tag is included as a group");
        assert_eq!(lib[0].favorites_name.as_deref(), Some("收藏夹"),
            "the favorites collection name is surfaced for top-pinning");
    }
}
