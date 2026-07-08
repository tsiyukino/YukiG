/// Database migration runner.
///
/// Migrations are embedded SQL strings applied in order on every startup.
/// The `schema_migrations` table tracks which migrations have been applied.
/// This approach is simple, reliable, and requires no external tooling.
use rusqlite::{Connection, Result};

/// Applies all pending migrations to the given connection.
///
/// Each migration is identified by a unique name. Already-applied migrations
/// are skipped. Migrations run inside a single transaction so a failure
/// leaves the database unchanged.
///
/// # Errors
/// Returns a `rusqlite::Error` if any migration fails to execute.
pub fn run(conn: &Connection) -> Result<()> {
    ensure_migrations_table(conn)?;

    // Disable FK enforcement for the duration of the migration run. Some
    // migrations rebuild a table (create-copy-drop-rename), and DROP TABLE on a
    // parent fires ON DELETE CASCADE on child rows while enforcement is on,
    // wiping data. PRAGMA foreign_keys is a no-op inside a transaction, so it
    // must be toggled here, outside the per-migration transactions. Each
    // migration still checks its own references before committing (see apply),
    // so a bad migration rolls back rather than leaving a broken schema.
    conn.execute_batch("PRAGMA foreign_keys = OFF;")?;

    let result: Result<()> = (|| {
        for (name, sql) in all_migrations() {
            if !is_applied(conn, name)? {
                apply(conn, name, sql)?;
            }
        }
        Ok(())
    })();

    // Restore enforcement even if a migration failed; the app also re-enables
    // it via configure_connection on the next start.
    conn.execute_batch("PRAGMA foreign_keys = ON;")?;
    result
}

/// Returns the ordered list of all migrations as (name, sql) pairs.
fn all_migrations() -> Vec<(&'static str, &'static str)> {
    vec![
        ("001_initial", include_str!("../../migrations/001_initial.sql")),
        ("002_collection_default_strategy", include_str!("../../migrations/002_collection_default_strategy.sql")),
        ("003_item_notes", include_str!("../../migrations/003_item_notes.sql")),
        ("004_rebuild_fts", include_str!("../../migrations/004_rebuild_fts.sql")),
        ("005_fix_fts", include_str!("../../migrations/005_fix_fts.sql")),
        ("006_tag_groups", include_str!("../../migrations/006_tag_groups.sql")),
        ("007_item_parent", include_str!("../../migrations/007_item_parent.sql")),
        ("008_item_category", include_str!("../../migrations/008_item_category.sql")),
        ("009_item_favorite", include_str!("../../migrations/009_item_favorite.sql")),
        ("010_steam_games", include_str!("../../migrations/010_steam_games.sql")),
        ("011_play_sessions", include_str!("../../migrations/011_play_sessions.sql")),
        ("012_game_status", include_str!("../../migrations/012_game_status.sql")),
        ("013_nullable_collection", include_str!("../../migrations/013_nullable_collection.sql")),
        ("014_steam_system_collection", include_str!("../../migrations/014_steam_system_collection.sql")),
        ("015_collections_to_grouping_tags", include_str!("../../migrations/015_collections_to_grouping_tags.sql")),
    ]
}

/// Creates the `schema_migrations` tracking table if it does not exist.
fn ensure_migrations_table(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS schema_migrations (
            name TEXT PRIMARY KEY NOT NULL,
            applied_at TEXT NOT NULL
        );",
    )
}

/// Returns true if the migration with the given name has already been applied.
fn is_applied(conn: &Connection, name: &str) -> Result<bool> {
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM schema_migrations WHERE name = ?1",
        [name],
        |row| row.get(0),
    )?;
    Ok(count > 0)
}

/// Applies a single migration inside a transaction and records it in the tracking table.
///
/// FK enforcement is off during the run (see `run`), so before committing this
/// checks that the migration left no dangling references. `foreign_key_check`
/// runs inside the transaction, so a violation rolls the whole migration back
/// and it is not recorded as applied — the migration stays atomic.
fn apply(conn: &Connection, name: &str, sql: &str) -> Result<()> {
    conn.execute_batch("BEGIN;")?;

    let staged: Result<()> = (|| {
        conn.execute_batch(sql)?;
        let violations: i64 =
            conn.query_row("SELECT COUNT(*) FROM pragma_foreign_key_check", [], |r| r.get(0))?;
        if violations > 0 {
            return Err(rusqlite::Error::SqliteFailure(
                rusqlite::ffi::Error::new(rusqlite::ffi::SQLITE_CONSTRAINT_FOREIGNKEY),
                Some(format!("migration {name} left {violations} dangling foreign key(s)")),
            ));
        }
        conn.execute(
            "INSERT INTO schema_migrations (name, applied_at) VALUES (?1, datetime('now'))",
            [name],
        )?;
        Ok(())
    })();

    if staged.is_err() {
        conn.execute_batch("ROLLBACK;")?;
        return staged;
    }
    conn.execute_batch("COMMIT;")?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Runs migrations 001..=012, seeds a collection + item + child rows, then
    /// applies 013 and verifies the items rebuild preserved data and FKs and
    /// made collection_id nullable.
    #[test]
    fn migration_013_rebuilds_items_preserving_data_and_fks() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
        ensure_migrations_table(&conn).unwrap();

        // Apply everything up to and including 012.
        for (name, sql) in all_migrations() {
            if name == "013_nullable_collection" {
                break;
            }
            apply(&conn, name, sql).unwrap();
        }

        // Seed a collection, an item in it, and child rows that FK to the item.
        conn.execute(
            "INSERT INTO collections (id, name, icon, color, description, sort_order, created_at, updated_at)
             VALUES ('c1', 'Games', 'folder', '#000', '', 0, 't', 't')",
            [],
        ).unwrap();
        conn.execute(
            "INSERT INTO items (id, collection_id, name, folder_path, strategy_type, created_at, updated_at)
             VALUES ('i1', 'c1', 'Game', 'C:\\g', 'game', 't', 't')",
            [],
        ).unwrap();
        conn.execute(
            "INSERT INTO strategy_metadata (id, item_id, key, value) VALUES ('m1', 'i1', 'exe_path', 'C:\\g\\a.exe')",
            [],
        ).unwrap();

        // Apply 013.
        let sql = all_migrations()
            .into_iter()
            .find(|(n, _)| *n == "013_nullable_collection")
            .unwrap()
            .1;
        // Apply 013 with FK enforcement off, as run() does for the rebuild.
        // apply() runs foreign_key_check inside the transaction and commits
        // only if clean, so a successful apply already proves no dangling refs.
        conn.execute_batch("PRAGMA foreign_keys = OFF;").unwrap();
        apply(&conn, "013_nullable_collection", sql).unwrap();
        conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();

        // Data survived the rebuild.
        let name: String = conn
            .query_row("SELECT name FROM items WHERE id = 'i1'", [], |r| r.get(0))
            .unwrap();
        assert_eq!(name, "Game");
        let meta: String = conn
            .query_row("SELECT value FROM strategy_metadata WHERE id = 'm1'", [], |r| r.get(0))
            .unwrap();
        assert_eq!(meta, "C:\\g\\a.exe");

        // collection_id is now nullable: an item can be inserted without one.
        conn.execute(
            "INSERT INTO items (id, collection_id, name, folder_path, strategy_type, created_at, updated_at)
             VALUES ('i2', NULL, 'Unfiled', 'C:\\u', 'steam_game', 't', 't')",
            [],
        ).unwrap();
        let cid: Option<String> = conn
            .query_row("SELECT collection_id FROM items WHERE id = 'i2'", [], |r| r.get(0))
            .unwrap();
        assert_eq!(cid, None);

        // FK now SET NULL: deleting the collection unfiles i1 instead of deleting it.
        conn.execute("DELETE FROM collections WHERE id = 'c1'", []).unwrap();
        let cid1: Option<String> = conn
            .query_row("SELECT collection_id FROM items WHERE id = 'i1'", [], |r| r.get(0))
            .unwrap();
        assert_eq!(cid1, None, "deleting collection should unfile the item, not delete it");

        // FTS trigger still works after the rebuild.
        conn.execute(
            "INSERT INTO items (id, collection_id, name, folder_path, strategy_type, created_at, updated_at)
             VALUES ('i3', NULL, 'Searchable', 'C:\\s', 'game', 't', 't')",
            [],
        ).unwrap();
        let hits: i64 = conn
            .query_row("SELECT COUNT(*) FROM fts_items WHERE name MATCH 'Searchable'", [], |r| r.get(0))
            .unwrap();
        assert_eq!(hits, 1, "FTS trigger should index the new item");
    }

    /// The full migration run creates the fixed system "Steam" collection that
    /// Steam sync files games under.
    #[test]
    fn run_creates_steam_system_collection() {
        let conn = Connection::open_in_memory().unwrap();
        run(&conn).unwrap();
        let (id, name): (String, String) = conn
            .query_row(
                "SELECT id, name FROM collections WHERE id = 'steam-system'",
                [],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .unwrap();
        assert_eq!(id, "steam-system");
        assert_eq!(name, "Steam");
    }

    /// Migration 015 turns each collection into a grouping tag and migrates
    /// membership into item_tags, reusing a same-named tag instead of
    /// duplicating it.
    #[test]
    fn migration_015_migrates_collections_to_grouping_tags() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("PRAGMA foreign_keys = OFF;").unwrap();
        ensure_migrations_table(&conn).unwrap();
        for (name, sql) in all_migrations() {
            if name == "015_collections_to_grouping_tags" {
                break;
            }
            apply(&conn, name, sql).unwrap();
        }

        // Two collections; "RPGs" also already exists as a plain tag (collision).
        conn.execute_batch(
            "INSERT INTO collections (id, name, icon, color, description, sort_order, created_at, updated_at)
             VALUES ('c1', 'RPGs', 'sword', '#f00', 'role playing', 2, 't', 't'),
                    ('c2', 'Indie', 'star', '#0f0', '', 5, 't', 't');
             INSERT INTO tags (id, name, color, group_id, tag_type) VALUES ('t-rpg', 'RPGs', '#999', NULL, 'regular');
             INSERT INTO items (id, collection_id, name, folder_path, strategy_type, created_at, updated_at)
             VALUES ('i1', 'c1', 'Skyrim', 'C:\\s', 'game', 't', 't'),
                    ('i2', 'c2', 'Celeste', 'C:\\c', 'game', 't', 't');",
        ).unwrap();

        let sql = all_migrations().into_iter()
            .find(|(n, _)| *n == "015_collections_to_grouping_tags").unwrap().1;
        apply(&conn, "015_collections_to_grouping_tags", sql).unwrap();

        // Collision: the pre-existing "RPGs" tag is reused and promoted, not duplicated.
        let rpg_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM tags WHERE name = 'RPGs'", [], |r| r.get(0)).unwrap();
        assert_eq!(rpg_count, 1, "same-named tag must be reused, not duplicated");
        let (rpg_type, rpg_icon): (String, String) = conn
            .query_row("SELECT tag_type, icon FROM tags WHERE name = 'RPGs'", [], |r| Ok((r.get(0)?, r.get(1)?))).unwrap();
        assert_eq!(rpg_type, "grouping");
        assert_eq!(rpg_icon, "sword", "reused tag adopts the collection's icon");

        // "Indie" got a fresh grouping tag reusing the collection id.
        let indie_type: String = conn
            .query_row("SELECT tag_type FROM tags WHERE id = 'c2'", [], |r| r.get(0)).unwrap();
        assert_eq!(indie_type, "grouping");

        // Membership migrated into item_tags.
        let skyrim_tag: String = conn
            .query_row("SELECT t.name FROM item_tags it JOIN tags t ON t.id = it.tag_id WHERE it.item_id = 'i1'", [], |r| r.get(0)).unwrap();
        assert_eq!(skyrim_tag, "RPGs");
        let celeste_tag: String = conn
            .query_row("SELECT t.name FROM item_tags it JOIN tags t ON t.id = it.tag_id WHERE it.item_id = 'i2'", [], |r| r.get(0)).unwrap();
        assert_eq!(celeste_tag, "Indie");
    }

    /// A migration that leaves a dangling foreign key must roll back and not be
    /// recorded, so the schema stays consistent and the migration can be retried.
    #[test]
    fn apply_rolls_back_migration_that_breaks_foreign_keys() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("PRAGMA foreign_keys = OFF;").unwrap();
        ensure_migrations_table(&conn).unwrap();
        conn.execute_batch(
            "CREATE TABLE parent (id TEXT PRIMARY KEY);
             CREATE TABLE child (id TEXT PRIMARY KEY, parent_id TEXT REFERENCES parent(id));
             INSERT INTO parent VALUES ('p1');
             INSERT INTO child VALUES ('c1', 'p1');",
        ).unwrap();

        // This migration orphans child.c1 by deleting its parent.
        let bad = "DELETE FROM parent WHERE id = 'p1';";
        let err = apply(&conn, "bad_migration", bad);
        assert!(err.is_err(), "migration leaving a dangling FK must fail");

        // Rolled back: parent row restored, migration not recorded.
        let parents: i64 = conn.query_row("SELECT COUNT(*) FROM parent", [], |r| r.get(0)).unwrap();
        assert_eq!(parents, 1, "the failed migration must roll back its delete");
        let recorded: i64 = conn
            .query_row("SELECT COUNT(*) FROM schema_migrations WHERE name = 'bad_migration'", [], |r| r.get(0))
            .unwrap();
        assert_eq!(recorded, 0, "a rolled-back migration must not be recorded as applied");
    }
}
