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

    let migrations = all_migrations();
    for (name, sql) in migrations {
        if !is_applied(conn, name)? {
            apply(conn, name, sql)?;
        }
    }

    Ok(())
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
fn apply(conn: &Connection, name: &str, sql: &str) -> Result<()> {
    conn.execute_batch("BEGIN;")?;
    conn.execute_batch(sql)?;
    conn.execute(
        "INSERT INTO schema_migrations (name, applied_at) VALUES (?1, datetime('now'))",
        [name],
    )?;
    conn.execute_batch("COMMIT;")?;
    Ok(())
}
