/// SQLite connection management.
///
/// Provides a thread-safe connection pool using a Mutex-wrapped single connection.
/// YukiFileManager uses SQLite in WAL mode for better read concurrency.
///
/// The database path is resolved from the user config (which may override the
/// default app data directory). See `services::config` for the config format.
use rusqlite::Connection;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::Manager;

use crate::services::config;

/// Thread-safe SQLite connection state managed by Tauri.
pub struct DbConnection(pub Mutex<Connection>);

/// Opens and configures the SQLite database, then runs all pending migrations.
///
/// The database file is stored in the resolved data directory (default app data
/// dir, or the user-configured override from `config.json`). On first launch
/// this directory and file are created automatically.
///
/// # Errors
/// Returns an error string if the connection cannot be opened or migrations fail.
pub fn initialize(app: &tauri::App) -> Result<DbConnection, String> {
    let db_path = resolve_db_path(app)?;
    let conn = Connection::open(&db_path)
        .map_err(|e| format!("Failed to open database at {}: {}", db_path.display(), e))?;

    configure_connection(&conn).map_err(|e| format!("Failed to configure database: {}", e))?;

    let db = DbConnection(Mutex::new(conn));

    // Run migrations after wrapping so we can access the mutex
    {
        let guard = db.0.lock().map_err(|e| format!("DB lock poisoned: {}", e))?;
        crate::db::migrations::run(&guard)
            .map_err(|e| format!("Migration failed: {}", e))?;
    }

    Ok(db)
}

/// Resolves the path to the SQLite database file.
///
/// Reads the app config to check for a custom data directory. Falls back to
/// the default app data dir if no override is set.
fn resolve_db_path(app: &tauri::App) -> Result<PathBuf, String> {
    let default_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Cannot resolve app data dir: {}", e))?;

    let config_dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("Cannot resolve app config dir: {}", e))?;

    let cfg = config::read(&config_dir)
        .unwrap_or_default();

    let data_dir = config::resolve_data_dir(&cfg, &default_data_dir);
    std::fs::create_dir_all(&data_dir)
        .map_err(|e| format!("Cannot create data dir '{}': {}", data_dir.display(), e))?;

    Ok(data_dir.join("filevault.db"))
}

/// Applies SQLite connection pragmas for performance and correctness.
fn configure_connection(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute_batch(
        "PRAGMA journal_mode=WAL;
         PRAGMA foreign_keys=ON;
         PRAGMA synchronous=NORMAL;
         PRAGMA temp_store=MEMORY;",
    )
}
