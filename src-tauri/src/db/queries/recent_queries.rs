/// Database queries for recently-played game lookups.
///
/// Recency lives in strategy_metadata under two keys: `last_launched`
/// (stamped by the launcher for anything launched through YukiG) and
/// `steam_last_played` (stamped by Steam sync for play outside YukiG).
/// A game's effective recency is the newer of the two.
use rusqlite::{Connection, Result};

/// A game with a known last-played time, as shown in the tray menu.
///
/// Carries what the menu row needs to render an icon: the item thumbnail,
/// the Steam community icon URL (`icon_url` metadata), and the strategy
/// type so the frontend can fall back to exe-icon extraction for local games.
#[derive(Debug, Clone, serde::Serialize)]
pub struct RecentGame {
    pub id: String,
    pub name: String,
    pub strategy_type: String,
    pub thumbnail_path: Option<String>,
    pub icon_url: Option<String>,
}

/// Returns up to `limit` games ordered by most recently played.
///
/// Covers both local games and Steam imports; items that have never been
/// played (no recency key, or a zero timestamp) are excluded.
///
/// # Errors
/// Returns a `rusqlite::Error` if the query fails.
pub fn get_recently_played(conn: &Connection, limit: u32) -> Result<Vec<RecentGame>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, strategy_type, thumbnail_path, icon_url FROM (
             SELECT i.id AS id, i.name AS name, i.strategy_type AS strategy_type,
                    i.thumbnail_path AS thumbnail_path, ic.value AS icon_url,
                    MAX(CAST(COALESCE(ll.value, '0') AS INTEGER),
                        CAST(COALESCE(sl.value, '0') AS INTEGER)) AS last_played
             FROM items i
             LEFT JOIN strategy_metadata ll
                    ON ll.item_id = i.id AND ll.key = 'last_launched'
             LEFT JOIN strategy_metadata sl
                    ON sl.item_id = i.id AND sl.key = 'steam_last_played'
             LEFT JOIN strategy_metadata ic
                    ON ic.item_id = i.id AND ic.key = 'icon_url'
             WHERE i.parent_id IS NULL
               AND i.strategy_type IN ('game', 'steam_game')
         )
         WHERE last_played > 0
         ORDER BY last_played DESC
         LIMIT ?1",
    )?;

    let rows = stmt.query_map([limit], |row| {
        Ok(RecentGame {
            id: row.get(0)?,
            name: row.get(1)?,
            strategy_type: row.get(2)?,
            thumbnail_path: row.get(3)?,
            icon_url: row.get(4)?,
        })
    })?;
    rows.collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    /// In-memory database with the full migration set applied.
    fn test_db() -> Connection {
        let conn = Connection::open_in_memory().expect("open in-memory db");
        crate::db::migrations::run(&conn).expect("apply migrations");
        conn.execute(
            "INSERT INTO collections (id, name, icon, color, description, sort_order, created_at, updated_at)
             VALUES ('c1', 'Test', 'folder', '#000', '', 0, '2026-01-01', '2026-01-01')",
            [],
        )
        .expect("insert collection");
        conn
    }

    fn insert_game(conn: &Connection, id: &str, strategy_type: &str) {
        conn.execute(
            "INSERT INTO items (id, collection_id, name, folder_path, strategy_type, created_at, updated_at)
             VALUES (?1, 'c1', ?1, 'C:\\g', ?2, '2026-01-01', '2026-01-01')",
            rusqlite::params![id, strategy_type],
        )
        .expect("insert item");
    }

    fn insert_meta(conn: &Connection, item_id: &str, key: &str, value: &str) {
        conn.execute(
            "INSERT INTO strategy_metadata (id, item_id, key, value)
             VALUES (?1 || '-' || ?2, ?1, ?2, ?3)",
            rusqlite::params![item_id, key, value],
        )
        .expect("insert metadata");
    }

    fn ids(games: &[RecentGame]) -> Vec<&str> {
        games.iter().map(|g| g.id.as_str()).collect()
    }

    #[test]
    fn orders_mixed_local_and_steam_by_recency() {
        let conn = test_db();
        insert_game(&conn, "local-old", "game");
        insert_meta(&conn, "local-old", "last_launched", "50");
        insert_game(&conn, "steam-new", "steam_game");
        insert_meta(&conn, "steam-new", "steam_last_played", "200");
        insert_game(&conn, "local-mid", "game");
        insert_meta(&conn, "local-mid", "last_launched", "100");

        let recent = get_recently_played(&conn, 10).unwrap();
        assert_eq!(ids(&recent), vec!["steam-new", "local-mid", "local-old"]);
    }

    #[test]
    fn excludes_never_played_and_zero_timestamps() {
        let conn = test_db();
        insert_game(&conn, "never", "game");
        insert_game(&conn, "steam-zero", "steam_game");
        insert_meta(&conn, "steam-zero", "steam_last_played", "0");
        insert_game(&conn, "played", "game");
        insert_meta(&conn, "played", "last_launched", "10");

        let recent = get_recently_played(&conn, 10).unwrap();
        assert_eq!(ids(&recent), vec!["played"]);
    }

    #[test]
    fn uses_newer_of_both_keys_for_steam_games() {
        // A Steam game launched through YukiG has both keys; the newer wins.
        let conn = test_db();
        insert_game(&conn, "both-keys", "steam_game");
        insert_meta(&conn, "both-keys", "steam_last_played", "100");
        insert_meta(&conn, "both-keys", "last_launched", "300");
        insert_game(&conn, "other", "game");
        insert_meta(&conn, "other", "last_launched", "200");

        let recent = get_recently_played(&conn, 10).unwrap();
        assert_eq!(ids(&recent), vec!["both-keys", "other"]);
    }

    #[test]
    fn returns_icon_fields() {
        let conn = test_db();
        insert_game(&conn, "steam-g", "steam_game");
        insert_meta(&conn, "steam-g", "steam_last_played", "100");
        insert_meta(&conn, "steam-g", "icon_url", "https://cdn/icon.jpg");
        insert_game(&conn, "local-g", "game");
        insert_meta(&conn, "local-g", "last_launched", "50");

        let recent = get_recently_played(&conn, 10).unwrap();
        assert_eq!(recent[0].strategy_type, "steam_game");
        assert_eq!(recent[0].icon_url.as_deref(), Some("https://cdn/icon.jpg"));
        assert_eq!(recent[1].strategy_type, "game");
        assert_eq!(recent[1].icon_url, None);
        // insert_game leaves thumbnail_path NULL.
        assert_eq!(recent[1].thumbnail_path, None);
    }

    #[test]
    fn respects_limit() {
        let conn = test_db();
        for i in 0..4 {
            let id = format!("g{}", i);
            insert_game(&conn, &id, "game");
            insert_meta(&conn, &id, "last_launched", &format!("{}", 10 + i));
        }

        let recent = get_recently_played(&conn, 2).unwrap();
        assert_eq!(ids(&recent), vec!["g3", "g2"]);
    }
}
