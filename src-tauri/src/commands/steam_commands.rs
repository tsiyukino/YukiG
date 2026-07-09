/// Tauri command handlers for Steam integration.
///
/// Commands:
/// - `steam_scan`              — Scan Steam install; returns games, collections, accounts.
/// - `steam_import`            — Bulk-import selected games into YukiG DB.
/// - `steam_get_imported_ids`  — Return already-imported Steam app IDs.
/// - `steam_get_users`         — Return all Steam accounts from loginusers.vdf.
/// - `steam_switch_account`    — Switch active Steam account and restart Steam.
/// - `steam_launch_game`       — Launch a game via steam://rungameid/<appid>.
/// - `steam_get_achievements`  — Return achievement unlock status for a game (from local userdata).
/// - `steam_get_screenshots`   — Return local screenshots for a game (from userdata).
/// - `steam_get_cloud_saves`   — Return cloud save files for a game (from userdata/remote/).
/// - `steam_open_in_app`       — Open game page in Steam desktop app.
/// - `steam_open_in_store`     — Open game page in Steam web store.
use std::collections::HashMap;

use tauri::State;

use crate::db::connection::DbConnection;
use crate::db::models::NewCollection;
use crate::db::queries::{collection_queries, item_queries, strategy_metadata_queries, tag_queries};
use crate::db::queries::item_queries::NewItem;
use crate::services::steam::{self, SteamScanResult, SteamUser};

/// Fixed id of the system "Steam" collection (created by migration 014). All
/// synced Steam games are filed here so they have a home collection card
/// without polluting the user's own collections.
const STEAM_SYSTEM_COLLECTION_ID: &str = "steam-system";

// ─── Steam category → tag mapping ────────────────────────────────────────────

/// Steam category IDs that indicate online multiplayer / PvP activity.
/// When a game has any of these, its `online_status` is initialised to `active`.
const ONLINE_CATEGORY_IDS: &[u32] = &[
    1,  // Multi-player
    36, // Online PvP
    49, // PvP
];

/// Maps a Steam category ID to (tag name, hex colour, is_mood).
///
/// `is_mood = true` means the tag also appears as a Play-page mood filter chip.
/// All mapped IDs produce a regular tag visible on the game detail page.
/// Unmapped IDs are silently ignored.
fn category_to_tag(id: u32) -> Option<(&'static str, &'static str, bool)> {
    match id {
        // ── Single-player / story ──────────────────────────────────────────
        2  => Some(("Single-player",       "#6366f1", true )),
        // ── Multiplayer / online ───────────────────────────────────────────
        1  => Some(("Multiplayer",         "#3b82f6", true )),
        36 => Some(("Online PvP",          "#ef4444", true )),
        49 => Some(("PvP",                 "#f97316", true )),
        // ── Co-op ─────────────────────────────────────────────────────────
        9  => Some(("Co-op",              "#22c55e", true )),
        37 => Some(("Online Co-op",       "#16a34a", true )),
        38 => Some(("Local Co-op",        "#14b8a6", true )),
        // ── Local multiplayer ─────────────────────────────────────────────
        7  => Some(("Local Multiplayer",  "#0ea5e9", true )),
        // ── Partial controller / VR / feature tags (regular only) ─────────
        28 => Some(("Full Controller Support", "#8b5cf6", false)),
        18 => Some(("Partial Controller Support", "#a78bfa", false)),
        29 => Some(("Trading Cards",       "#eab308", false)),
        22 => Some(("Achievements",        "#f59e0b", false)),
        23 => Some(("Steam Cloud",         "#64748b", false)),
        30 => Some(("Steam Workshop",      "#94a3b8", false)),
        35 => Some(("In-App Purchases",    "#f43f5e", false)),
        // ── Other play modes ──────────────────────────────────────────────
        24 => Some(("Shared/Split Screen", "#ec4899", true )),
        // ─────────────────────────────────────────────────────────────────
        _  => None,
    }
}

/// Returns true if any category in the list indicates online-active gameplay.
fn is_online_active(categories: &[u32]) -> bool {
    categories.iter().any(|id| ONLINE_CATEGORY_IDS.contains(id))
}

/// Ensures tags derived from Steam categories exist and are assigned to the item.
///
/// - Regular tags (tag_type = 'regular') are visible on the game detail page.
/// - Mood tags (tag_type = 'mood', is_mood = true) also appear on the Play page filter bar.
/// - Uses upsert so the same tag object is shared across all games with that category.
/// - Does NOT remove previously assigned tags.
///
/// Silently ignores errors per-tag so a single failure doesn't abort the whole import.
fn apply_steam_category_tags(
    conn: &rusqlite::Connection,
    item_id: &str,
    categories: &[u32],
) {
    for &cat_id in categories {
        if let Some((name, color, is_mood)) = category_to_tag(cat_id) {
            let result = if is_mood {
                tag_queries::upsert_mood(conn, name, color)
            } else {
                tag_queries::upsert_regular(conn, name, color)
            };
            if let Ok(tag) = result {
                let _ = tag_queries::assign(conn, item_id, &tag.id);
            }
        }
    }
}

/// Color for tags derived from Steam Collections (Steam's blue-grey).
const STEAM_COLLECTION_TAG_COLOR: &str = "#66c0f4";

/// Maps a game's Steam Collections to regular tags and assigns them.
///
/// A Steam Collection is a many-to-many grouping (a game can be in several),
/// so it maps to tags rather than to a single YukiG collection. The "Favorites"
/// collection is skipped — it is surfaced through the item's `is_favorite`
/// flag, not as a tag.
fn apply_steam_collection_tags(
    conn: &rusqlite::Connection,
    item_id: &str,
    collections: &[String],
) {
    for name in collections {
        let name = name.trim();
        if name.is_empty() || name.eq_ignore_ascii_case("favorites") {
            continue;
        }
        if let Ok(tag) = tag_queries::upsert_regular(conn, name, STEAM_COLLECTION_TAG_COLOR) {
            let _ = tag_queries::assign(conn, item_id, &tag.id);
        }
    }
}

// ─── Debug ────────────────────────────────────────────────────────────────────

/// Returns diagnostic info: raw appinfo.vdf parse + scan categories.
#[tauri::command]
pub fn steam_debug_appinfo() -> Result<String, String> {
    let steam_path = steam::detect_steam_path()?;
    let appinfo_path = steam_path.join("appcache").join("appinfo.vdf");
    if !appinfo_path.exists() {
        return Err(format!("appinfo.vdf not found at {:?}", appinfo_path));
    }

    // Check raw parse — how many entries have categories
    let full_meta = steam::parse_appinfo_full_pub(&appinfo_path)?;
    let raw_total = full_meta.len();
    let raw_with_cats = full_meta.values().filter(|m| !m.categories.is_empty()).count();
    let raw_sample: Vec<String> = full_meta.iter()
        .filter(|(_, m)| !m.categories.is_empty())
        .take(5)
        .map(|(id, m)| format!("  {} {}: cats={:?}", id, m.name.as_deref().unwrap_or("?"), m.categories))
        .collect();

    // Also check scan result (should include categories on SteamGame)
    let scan = steam::scan(&steam_path)?;
    let scan_total = scan.games.len();
    let scan_with_cats = scan.games.iter().filter(|g| !g.categories.is_empty()).count();
    let scan_sample: Vec<String> = scan.games.iter()
        .filter(|g| !g.categories.is_empty())
        .take(5)
        .map(|g| format!("  {} ({}): cats={:?}", g.name, g.app_id, g.categories))
        .collect();

    Ok(format!(
        "=== Raw appinfo.vdf ===\nTotal entries: {}\nWith categories: {}\nSamples:\n{}\n\n=== Scan result ===\nTotal games: {}\nWith categories: {}\nSamples:\n{}",
        raw_total, raw_with_cats,
        if raw_sample.is_empty() { "  (none)".to_string() } else { raw_sample.join("\n") },
        scan_total, scan_with_cats,
        if scan_sample.is_empty() { "  (none)".to_string() } else { scan_sample.join("\n") },
    ))
}

/// Returns diagnostic info about tags and game status in the DB.
#[tauri::command]
pub fn steam_debug_db(db: State<DbConnection>) -> Result<String, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    let tag_count: i64 = conn.query_row("SELECT COUNT(*) FROM tags", [], |r| r.get(0))
        .map_err(|e| e.to_string())?;
    let item_tag_count: i64 = conn.query_row("SELECT COUNT(*) FROM item_tags", [], |r| r.get(0))
        .map_err(|e| e.to_string())?;
    let status_count: i64 = conn.query_row("SELECT COUNT(*) FROM game_status", [], |r| r.get(0))
        .map_err(|e| e.to_string())?;
    let online_active: i64 = conn.query_row(
        "SELECT COUNT(*) FROM game_status WHERE online_status = 'active'", [], |r| r.get(0))
        .map_err(|e| e.to_string())?;
    let playing_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM game_status WHERE story_status = 'playing'", [], |r| r.get(0))
        .map_err(|e| e.to_string())?;

    let mut stmt = conn.prepare(
        "SELECT name, tag_type FROM tags ORDER BY tag_type, name LIMIT 30")
        .map_err(|e| e.to_string())?;
    let tags: Vec<String> = stmt.query_map([], |r| {
        Ok(format!("[{}] {}", r.get::<_, String>(1)?, r.get::<_, String>(0)?))
    }).map_err(|e| e.to_string())?
    .filter_map(|r| r.ok())
    .collect();

    // Check steam_categories metadata
    let cat_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM strategy_metadata WHERE key = 'steam_categories'", [], |r| r.get(0))
        .map_err(|e| e.to_string())?;

    // Show per-game metadata and tags for the first 5 imported Steam games.
    let mut game_stmt = conn.prepare(
        "SELECT i.name, si.app_id, sm.key, sm.value
         FROM items i
         JOIN steam_imports si ON si.item_id = i.id
         LEFT JOIN strategy_metadata sm ON sm.item_id = i.id
           AND sm.key IN ('steam_playtime_minutes', 'steam_last_played', 'steam_categories')
         ORDER BY si.app_id
         LIMIT 60")
        .map_err(|e| e.to_string())?;
    let game_rows: Vec<String> = game_stmt.query_map([], |r| {
        Ok(format!("  {}({}): {}={}", r.get::<_,String>(0)?, r.get::<_,i64>(1)?, r.get::<_,String>(2).unwrap_or_default(), r.get::<_,String>(3).unwrap_or_default()))
    }).map_err(|e| e.to_string())?
    .filter_map(|r| r.ok())
    .collect();

    // Show how many items have each status.
    let mut status_stmt = conn.prepare(
        "SELECT story_status, online_status, COUNT(*) FROM game_status GROUP BY story_status, online_status")
        .map_err(|e| e.to_string())?;
    let status_rows: Vec<String> = status_stmt.query_map([], |r| {
        Ok(format!("  story={} online={} count={}", r.get::<_,String>(0)?, r.get::<_,String>(1)?, r.get::<_,i64>(2)?))
    }).map_err(|e| e.to_string())?
    .filter_map(|r| r.ok())
    .collect();

    Ok(format!(
        "Tags: {}\nItem-tags: {}\nGame status rows: {}\nOnline active: {}\nPlaying: {}\nWith steam_categories metadata: {}\n\nStatus breakdown:\n{}\n\nAll tags:\n{}\n\nPer-game metadata (first 5 games):\n{}",
        tag_count, item_tag_count, status_count, online_active, playing_count, cat_count,
        status_rows.join("\n"),
        tags.join("\n"),
        game_rows.join("\n"),
    ))
}

// ─── Scan ─────────────────────────────────────────────────────────────────────

/// Scans the local Steam installation.
///
/// Returns all games (installed + uninstalled with names from appinfo.vdf),
/// Steam Collections, and all user accounts. Read-only — no DB writes.
///
/// # Errors
/// Returns an error string if Steam is not found or the scan fails.
#[tauri::command]
pub fn steam_scan() -> Result<SteamScanResult, String> {
    let steam_path = steam::detect_steam_path()?;
    steam::scan(&steam_path)
}

// ─── Import ───────────────────────────────────────────────────────────────────

/// Input for a single game to import.
#[derive(Debug, serde::Deserialize)]
pub struct ImportGameInput {
    pub app_id: u64,
    pub name: String,
    pub install_path: Option<String>,
    pub is_installed: bool,
    pub collections: Vec<String>,
    pub size_on_disk: u64,
    pub icon_url: String,
    pub header_image: String,
    pub library_image: String,
    pub library_hero: String,
    pub library_logo: String,
    /// Steam category IDs from appinfo.vdf (e.g. 1=Multi-player, 36=Online PvP, 9=Co-op).
    #[serde(default)]
    pub categories: Vec<u32>,
    /// App type from appinfo.vdf (e.g. "game", "Application", "Tool", "DLC").
    #[serde(default)]
    pub app_type: String,
}

/// Result of a bulk import operation.
#[derive(Debug, serde::Serialize)]
pub struct ImportResult {
    pub imported: usize,
    pub skipped: usize,
    pub errors: Vec<String>,
}

/// Imports selected Steam games into YukiG.
///
/// Per-game logic:
/// - Skip if the app ID is already in `steam_imports`.
/// - Create a YukiG collection for the first Steam Collection (or "Steam — Uncategorized").
/// - Create an item with `strategy_type = "steam_game"`.
/// - Store `steam_app_id`, `steam_launch_url`, `install_path`, `is_installed`,
///   `header_image`, `library_image`, `library_hero`, `library_logo` as strategy metadata.
/// - Installed games get `sort_order = 0`; uninstalled get `sort_order = 10000`.
///
/// # Errors
/// Fatal DB errors are returned. Per-game errors are non-fatal and collected in the result.
#[tauri::command]
pub fn steam_import(
    db: State<DbConnection>,
    games: Vec<ImportGameInput>,
) -> Result<ImportResult, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut result = ImportResult { imported: 0, skipped: 0, errors: Vec::new() };

    let existing_cols = collection_queries::get_all(&conn).map_err(|e| e.to_string())?;
    let mut col_cache: HashMap<String, String> = existing_cols.iter()
        .map(|c| (c.name.clone(), c.id.clone()))
        .collect();

    let imported_ids = get_imported_ids_set(&conn).map_err(|e| e.to_string())?;

    for game in games {
        if imported_ids.contains(&game.app_id) {
            result.skipped += 1;
            continue;
        }

        let col_name = if game.collections.is_empty() {
            "Steam — Uncategorized".to_string()
        } else {
            game.collections[0].clone()
        };

        let collection_id = match col_cache.get(&col_name) {
            Some(id) => id.clone(),
            None => {
                let new_col = NewCollection {
                    name: col_name.clone(),
                    icon: "steam".to_string(),
                    color: "#1b2838".to_string(),
                    description: format!("Steam collection: {}", col_name),
                    default_strategy: "steam_game".to_string(),
                };
                match collection_queries::create(&conn, &new_col) {
                    Ok(col) => {
                        col_cache.insert(col_name.clone(), col.id.clone());
                        col.id
                    }
                    Err(e) => {
                        result.errors.push(format!("Collection '{}': {}", col_name, e));
                        continue;
                    }
                }
            }
        };

        let folder_path = game.install_path.clone().unwrap_or_default();
        let new_item = NewItem {
            collection_id: Some(collection_id),
            parent_id: None,
            name: game.name.clone(),
            folder_path,
            strategy_type: "steam_game".to_string(),
            category: String::new(),
            description: String::new(),
        };

        let item = match item_queries::create(&conn, &new_item) {
            Ok(i) => i,
            Err(e) => {
                result.errors.push(format!("Item '{}': {}", game.name, e));
                continue;
            }
        };

        // Uninstalled games sort below installed ones.
        if !game.is_installed {
            let _ = conn.execute(
                "UPDATE items SET sort_order = 10000 WHERE id = ?1",
                rusqlite::params![&item.id],
            );
        }

        let mut metadata = HashMap::new();
        metadata.insert("steam_app_id".to_string(), game.app_id.to_string());
        metadata.insert("steam_launch_url".to_string(), format!("steam://rungameid/{}", game.app_id));
        metadata.insert("is_installed".to_string(), game.is_installed.to_string());
        metadata.insert("icon_url".to_string(), game.icon_url.clone());
        metadata.insert("header_image".to_string(), game.header_image.clone());
        metadata.insert("library_image".to_string(), game.library_image.clone());
        metadata.insert("library_hero".to_string(), game.library_hero.clone());
        metadata.insert("library_logo".to_string(), game.library_logo.clone());
        metadata.insert("size_on_disk".to_string(), game.size_on_disk.to_string());
        if let Some(ref path) = game.install_path {
            metadata.insert("install_path".to_string(), path.clone());
        }
        if !game.categories.is_empty() {
            let cat_str = game.categories.iter().map(|c| c.to_string()).collect::<Vec<_>>().join(",");
            metadata.insert("steam_categories".to_string(), cat_str);
        }
        metadata.insert("steam_app_type".to_string(), game.app_type.to_lowercase());

        if let Err(e) = strategy_metadata_queries::upsert_all(&conn, &item.id, &metadata) {
            result.errors.push(format!("Metadata for '{}': {}", game.name, e));
        }

        // Auto-assign mood tags derived from Steam categories.
        apply_steam_category_tags(&conn, &item.id, &game.categories);

        // Set online_status = 'active' for multiplayer/PvP games.
        if is_online_active(&game.categories) {
            let _ = conn.execute(
                "INSERT INTO game_status (item_id, story_status, online_status, snooze_until) \
                 VALUES (?1, 'unplayed', 'active', NULL) \
                 ON CONFLICT(item_id) DO UPDATE SET online_status = 'active' \
                 WHERE online_status = 'inactive'",
                rusqlite::params![&item.id],
            );
        }

        if let Err(e) = conn.execute(
            "INSERT OR IGNORE INTO steam_imports (app_id, item_id) VALUES (?1, ?2)",
            rusqlite::params![game.app_id as i64, &item.id],
        ) {
            result.errors.push(format!("Import record for {}: {}", game.app_id, e));
        }

        result.imported += 1;
    }

    Ok(result)
}

/// Returns the Steam app IDs already imported into YukiG.
#[tauri::command]
pub fn steam_get_imported_ids(db: State<DbConnection>) -> Result<Vec<u64>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    get_imported_ids_set(&conn)
        .map(|s| s.into_iter().collect())
        .map_err(|e| e.to_string())
}

/// Returns the Steam app id currently running (0 if none).
///
/// Read from the `steam_running` watcher's state, which mirrors Steam's
/// `RunningAppID`. The Steam page seeds "now playing" state from this, then
/// stays live via the `steam-running-changed` event. Keyed by app id so it
/// works whether or not the game is imported as a library item.
#[tauri::command]
pub fn steam_get_running_appid(
    state: State<crate::services::steam_running::SteamRunningState>,
) -> u32 {
    state.current()
}

/// Per-game DB info returned by `steam_get_game_db_info`.
#[derive(Debug, serde::Serialize)]
pub struct SteamGameDbInfo {
    pub item_id: String,
    pub is_favorite: bool,
}

/// Returns a map of app_id → {item_id, is_favorite} for all imported Steam games.
///
/// Used by the Steam page to resolve favorite state without a full item fetch.
#[tauri::command]
pub fn steam_get_game_db_info(
    db: State<DbConnection>,
) -> Result<HashMap<u64, SteamGameDbInfo>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT si.app_id, si.item_id, i.is_favorite \
             FROM steam_imports si \
             JOIN items i ON i.id = si.item_id",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, i64>(0)? as u64,
                row.get::<_, String>(1)?,
                row.get::<_, i32>(2)? != 0,
            ))
        })
        .map_err(|e| e.to_string())?;
    let mut map = HashMap::new();
    for row in rows {
        let (app_id, item_id, is_favorite) = row.map_err(|e| e.to_string())?;
        map.insert(app_id, SteamGameDbInfo { item_id, is_favorite });
    }
    Ok(map)
}

fn get_imported_ids_set(conn: &rusqlite::Connection) -> rusqlite::Result<std::collections::HashSet<u64>> {
    let mut stmt = conn.prepare("SELECT app_id FROM steam_imports")?;
    let rows = stmt.query_map([], |row| row.get::<_, i64>(0))?;
    let mut ids = std::collections::HashSet::new();
    for row in rows { ids.insert(row? as u64); }
    Ok(ids)
}

// ─── Sync ─────────────────────────────────────────────────────────────────────

/// Result of a sync operation.
#[derive(Debug, serde::Serialize)]
pub struct SyncResult {
    pub added: usize,
    pub updated: usize,
    pub removed: usize,
    pub errors: Vec<String>,
}

/// Syncs the full Steam library (current active account) into YukiG.
///
/// - Scans Steam (hidden games already excluded by the scanner).
/// - Files every game under the system "Steam" collection as a `steam_game`
///   item; Steam Collections become tags.
/// - Updates name / path / metadata / tags for games already imported.
/// - Removes items whose Steam app ID is no longer in the scanned library
///   (e.g. uninstalled from this account, or after an account switch).
/// - Safe to call on startup or on demand.
///
/// # Errors
/// Returns an error string if Steam cannot be found or the DB cannot be accessed.
#[tauri::command]
pub fn steam_sync(db: State<DbConnection>) -> Result<SyncResult, String> {
    let steam_path = steam::detect_steam_path()?;
    let scan = steam::scan(&steam_path)?;
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut result = SyncResult { added: 0, updated: 0, removed: 0, errors: Vec::new() };

    // Build set of all app IDs in this scan (hidden already excluded).
    let scan_ids: std::collections::HashSet<u64> = scan.games.iter().map(|g| g.app_id).collect();

    // Build map of existing steam_imports: app_id → item_id.
    let existing_imports: HashMap<u64, String> = {
        let mut stmt = conn.prepare("SELECT app_id, item_id FROM steam_imports")
            .map_err(|e| e.to_string())?;
        let imports = stmt
            .query_map([], |row| Ok((row.get::<_, i64>(0)? as u64, row.get::<_, String>(1)?)))
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();
        imports
    };

    // Upsert each game from the scan. Steam games are filed under the system
    // "Steam" collection so they have a home card without cluttering the user's
    // own collections. Steam Collections (the user's in-Steam groupings) map to
    // tags instead (see apply_steam_collection_tags), which correctly models a
    // game belonging to several groupings at once.
    for game in &scan.games {
        let mut metadata = HashMap::new();
        metadata.insert("steam_app_id".to_string(), game.app_id.to_string());
        metadata.insert("steam_launch_url".to_string(), format!("steam://rungameid/{}", game.app_id));
        metadata.insert("is_installed".to_string(), game.is_installed.to_string());
        metadata.insert("icon_url".to_string(), game.icon_url.clone());
        metadata.insert("header_image".to_string(), game.header_image.clone());
        metadata.insert("library_image".to_string(), game.library_image.clone());
        metadata.insert("library_hero".to_string(), game.library_hero.clone());
        metadata.insert("library_logo".to_string(), game.library_logo.clone());
        metadata.insert("size_on_disk".to_string(), game.size_on_disk.to_string());
        // Store playtime and last-played so game_status_bulk_init can use them.
        metadata.insert("steam_playtime_minutes".to_string(), game.playtime_minutes.to_string());
        metadata.insert("steam_last_played".to_string(), game.last_played.to_string());
        if let Some(ref path) = game.install_path {
            metadata.insert("install_path".to_string(), path.clone());
        }
        if !game.categories.is_empty() {
            let cat_str = game.categories.iter().map(|c| c.to_string()).collect::<Vec<_>>().join(",");
            metadata.insert("steam_categories".to_string(), cat_str);
        }
        metadata.insert("steam_app_type".to_string(), game.app_type.to_lowercase());

        // Only installed games can be favorited — uninstalled games are excluded.
        let is_fav = game.is_installed
            && game.collections.iter().any(|c| c.eq_ignore_ascii_case("favorites"));
        let sort_order = if game.is_installed { 0i64 } else { 10000i64 };

        if let Some(item_id) = existing_imports.get(&game.app_id) {
            // Update name, path, and install status. is_favorite is NOT
            // overwritten — the user may have set it manually.
            let folder_path = game.install_path.clone().unwrap_or_default();
            let _ = conn.execute(
                "UPDATE items SET name = ?1, folder_path = ?2, \
                 sort_order = ?3, updated_at = datetime('now') WHERE id = ?4",
                rusqlite::params![&game.name, &folder_path, sort_order, item_id],
            );
            // File under the Steam collection if the game is currently un-filed
            // (never filed, or its old auto-created collection was removed). A
            // collection the user deliberately chose is left untouched.
            let _ = conn.execute(
                "UPDATE items SET collection_id = ?1 WHERE id = ?2 AND collection_id IS NULL",
                rusqlite::params![STEAM_SYSTEM_COLLECTION_ID, item_id],
            );
            if let Err(e) = strategy_metadata_queries::upsert_all(&conn, item_id, &metadata) {
                result.errors.push(format!("Metadata update for '{}': {}", game.name, e));
            }
            // Update tags and online status on every sync (categories/collections may have changed).
            apply_steam_category_tags(&conn, item_id, &game.categories);
            apply_steam_collection_tags(&conn, item_id, &game.collections);
            // Membership in the Steam grouping tag (the home/Games views read
            // grouping tags, not collection_id).
            let _ = tag_queries::assign(&conn, item_id, STEAM_SYSTEM_COLLECTION_ID);
            if is_online_active(&game.categories) {
                let _ = conn.execute(
                    "INSERT INTO game_status (item_id, story_status, online_status, snooze_until) \
                     VALUES (?1, 'unplayed', 'active', NULL) \
                     ON CONFLICT(item_id) DO UPDATE SET online_status = 'active' \
                     WHERE online_status = 'inactive'",
                    rusqlite::params![item_id],
                );
            }
            result.updated += 1;
        } else {
            // Insert new item, filed under the system Steam collection.
            let folder_path = game.install_path.clone().unwrap_or_default();
            let new_item = item_queries::NewItem {
                collection_id: Some(STEAM_SYSTEM_COLLECTION_ID.to_string()),
                parent_id: None,
                name: game.name.clone(),
                folder_path,
                strategy_type: "steam_game".to_string(),
                category: String::new(),
                description: String::new(),
            };
            let item = match item_queries::create(&conn, &new_item) {
                Ok(i) => i,
                Err(e) => {
                    result.errors.push(format!("Item '{}': {}", game.name, e));
                    continue;
                }
            };
            let _ = conn.execute(
                "UPDATE items SET sort_order = ?1, is_favorite = ?2 WHERE id = ?3",
                rusqlite::params![sort_order, is_fav as i32, &item.id],
            );
            if let Err(e) = strategy_metadata_queries::upsert_all(&conn, &item.id, &metadata) {
                result.errors.push(format!("Metadata for '{}': {}", game.name, e));
            }
            apply_steam_category_tags(&conn, &item.id, &game.categories);
            apply_steam_collection_tags(&conn, &item.id, &game.collections);
            let _ = tag_queries::assign(&conn, &item.id, STEAM_SYSTEM_COLLECTION_ID);
            if is_online_active(&game.categories) {
                let _ = conn.execute(
                    "INSERT INTO game_status (item_id, story_status, online_status, snooze_until) \
                     VALUES (?1, 'unplayed', 'active', NULL) \
                     ON CONFLICT(item_id) DO UPDATE SET online_status = 'active' \
                     WHERE online_status = 'inactive'",
                    rusqlite::params![&item.id],
                );
            }
            if let Err(e) = conn.execute(
                "INSERT OR IGNORE INTO steam_imports (app_id, item_id) VALUES (?1, ?2)",
                rusqlite::params![game.app_id as i64, &item.id],
            ) {
                result.errors.push(format!("Import record for {}: {}", game.app_id, e));
            }
            result.added += 1;
        }
    }

    // Remove items whose app ID is no longer in the library.
    for (app_id, item_id) in &existing_imports {
        if !scan_ids.contains(app_id) {
            let _ = conn.execute("DELETE FROM items WHERE id = ?1", rusqlite::params![item_id]);
            let _ = conn.execute("DELETE FROM steam_imports WHERE app_id = ?1", rusqlite::params![*app_id as i64]);
            result.removed += 1;
        }
    }

    // Retroactive backfill: for any imported Steam game that has steam_categories metadata
    // but zero assigned tags, parse the categories string and assign tags now.
    // This handles games that were synced before the category-tag code existed.
    backfill_category_tags_from_metadata(&conn);

    Ok(result)
}

/// Reads `steam_categories` from `strategy_metadata` for all Steam items that
/// currently have no tags assigned, then calls `apply_steam_category_tags` for them.
///
/// This is a one-time catch-up step run at the end of every sync.
fn backfill_category_tags_from_metadata(conn: &rusqlite::Connection) {
    // Find items with steam_categories metadata but no item_tags rows.
    let Ok(mut stmt) = conn.prepare(
        "SELECT sm.item_id, sm.value
         FROM strategy_metadata sm
         WHERE sm.key = 'steam_categories'
           AND sm.item_id IN (SELECT item_id FROM steam_imports)
           AND sm.item_id NOT IN (SELECT DISTINCT item_id FROM item_tags)"
    ) else { return };

    let rows: Vec<(String, String)> = stmt
        .query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))
        .map(|mapped| mapped.filter_map(|r| r.ok()).collect::<Vec<_>>())
        .unwrap_or_default();

    for (item_id, cat_str) in rows {
        let categories: Vec<u32> = cat_str
            .split(',')
            .filter_map(|s| s.trim().parse::<u32>().ok())
            .collect();
        apply_steam_category_tags(conn, &item_id, &categories);
        // Also set online_status for multiplayer games.
        if is_online_active(&categories) {
            let _ = conn.execute(
                "INSERT INTO game_status (item_id, story_status, online_status, snooze_until) \
                 VALUES (?1, 'unplayed', 'active', NULL) \
                 ON CONFLICT(item_id) DO UPDATE SET online_status = 'active' \
                 WHERE online_status = 'inactive'",
                rusqlite::params![&item_id],
            );
        }
    }
}

// ─── Account management ───────────────────────────────────────────────────────

/// Returns all Steam accounts parsed from loginusers.vdf.
///
/// The most-recently-used account is listed first.
///
/// # Errors
/// Returns an error string if Steam is not found or the file cannot be read.
#[tauri::command]
pub fn steam_get_users() -> Result<Vec<SteamUser>, String> {
    let steam_path = steam::detect_steam_path()?;
    let loginusers = steam_path.join("config").join("loginusers.vdf");
    let content = std::fs::read_to_string(&loginusers)
        .map_err(|e| format!("Cannot read loginusers.vdf: {}", e))?;
    Ok(steam::parse_loginusers(&content))
}

/// Switches the active Steam account and restarts Steam.
///
/// Steps performed (matching TcNo Account Switcher / SteamTools approach):
/// 1. Read `loginusers.vdf`.
/// 2. Set `MostRecent = 1` for the selected account; `0` for all others.
/// 3. Write `loginusers.vdf` back.
/// 4. Update registry `AutoLoginUser` and `RememberPassword`.
/// 5. Kill all Steam processes.
/// 6. Restart `Steam.exe`.
///
/// # Errors
/// Returns an error string if Steam is not found, the file cannot be written,
/// the registry write fails, or Steam cannot be restarted.
#[tauri::command]
pub fn steam_switch_account(account_name: String) -> Result<(), String> {
    use winreg::enums::{HKEY_CURRENT_USER, KEY_SET_VALUE};
    use winreg::RegKey;

    let steam_path = steam::detect_steam_path()?;

    // 1. Read and rewrite loginusers.vdf.
    let loginusers = steam_path.join("config").join("loginusers.vdf");
    let content = std::fs::read_to_string(&loginusers)
        .map_err(|e| format!("Cannot read loginusers.vdf: {}", e))?;

    let rewritten = rewrite_loginusers(&content, &account_name);
    std::fs::write(&loginusers, &rewritten)
        .map_err(|e| format!("Cannot write loginusers.vdf: {}", e))?;

    // 2. Update registry.
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let steam_key = hkcu
        .open_subkey_with_flags("Software\\Valve\\Steam", KEY_SET_VALUE)
        .map_err(|e| format!("Cannot open Steam registry key: {}", e))?;
    steam_key
        .set_value("AutoLoginUser", &account_name)
        .map_err(|e| format!("Cannot set AutoLoginUser: {}", e))?;
    steam_key
        .set_value("RememberPassword", &1u32)
        .map_err(|e| format!("Cannot set RememberPassword: {}", e))?;

    // 3. Kill Steam processes.
    kill_steam();

    // 4. Restart Steam.
    let steam_exe = steam_path.join("Steam.exe");
    std::process::Command::new(&steam_exe)
        .spawn()
        .map_err(|e| format!("Cannot restart Steam: {}", e))?;

    Ok(())
}

/// Rewrites the content of `loginusers.vdf`, setting `MostRecent` to `1` only
/// for the account with the given `account_name` and `0` for all others.
fn rewrite_loginusers(content: &str, target_account: &str) -> String {
    let mut out = String::with_capacity(content.len());
    let mut current_account: Option<String> = None;
    let mut depth = 0i32;

    for line in content.lines() {
        let t = line.trim();

        if t == "{" {
            depth += 1;
            out.push_str(line);
            out.push('\n');
            continue;
        }
        if t == "}" {
            depth -= 1;
            if depth == 1 { current_account = None; }
            out.push_str(line);
            out.push('\n');
            continue;
        }

        // Capture AccountName at depth 2 (inside a user block).
        if depth == 2 {
            if let Some(("AccountName", v)) = split_vdf_pair(t) {
                current_account = Some(v.to_string());
            }
            // Rewrite MostRecent based on whether this is the target account.
            if let Some(("MostRecent", _)) = split_vdf_pair(t) {
                let is_target = current_account
                    .as_deref()
                    .map(|a| a.eq_ignore_ascii_case(target_account))
                    .unwrap_or(false);
                let indent: String = line.chars().take_while(|c| c.is_whitespace()).collect();
                out.push_str(&format!("{}\"MostRecent\"\t\t\"{}\"\n",
                    indent, if is_target { 1 } else { 0 }));
                continue;
            }
        }

        out.push_str(line);
        out.push('\n');
    }

    out
}

fn split_vdf_pair(line: &str) -> Option<(&str, &str)> {
    let mut parts = line.splitn(5, '"');
    let key = parts.nth(1)?;
    let value = parts.nth(1)?;
    Some((key, value))
}

/// Kills all running Steam processes by name.
fn kill_steam() {
    // taskkill is available on all modern Windows systems.
    let _ = std::process::Command::new("taskkill")
        .args(["/F", "/IM", "steam.exe", "/T"])
        .output();
}

// ─── Launch ───────────────────────────────────────────────────────────────────

/// Launches a Steam game via the `steam://rungameid/<appid>` protocol URL.
///
/// Steam must be running. The call returns immediately after handing off to
/// the OS shell — it does not wait for the game to start or exit.
///
/// # Errors
/// Returns an error string if the shell open fails.
#[tauri::command]
pub fn steam_launch_game(app: tauri::AppHandle, app_id: u64) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    let url = format!("steam://rungameid/{}", app_id);
    app.opener()
        .open_path(&url, None::<&str>)
        .map_err(|e| e.to_string())
}

/// Opens the game's entry in the Steam library panel.
///
/// Uses the `steam://nav/games/details/<appid>` protocol URL which navigates
/// directly to the game's library detail page inside the Steam client.
/// Steam must be installed and running.
///
/// # Errors
/// Returns an error string if the shell open fails.
#[tauri::command]
pub fn steam_open_in_app(app: tauri::AppHandle, app_id: u64) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    let url = format!("steam://nav/games/details/{}", app_id);
    app.opener()
        .open_path(&url, None::<&str>)
        .map_err(|e| e.to_string())
}

/// Opens the game's page in the Steam web store (browser).
///
/// Opens `https://store.steampowered.com/app/<appid>` in the system default browser.
///
/// # Errors
/// Returns an error string if the shell open fails.
#[tauri::command]
pub fn steam_open_in_store(app: tauri::AppHandle, app_id: u64) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    let url = format!("https://store.steampowered.com/app/{}", app_id);
    app.opener()
        .open_url(&url, None::<&str>)
        .map_err(|e| e.to_string())
}

/// Triggers the Steam client to install a game via the `steam://install/<appid>` protocol URL.
///
/// Steam must be installed. The call returns immediately after handing off to
/// the OS shell — it does not wait for the download to complete.
///
/// # Errors
/// Returns an error string if the shell open fails.
#[tauri::command]
pub fn steam_install_game(app: tauri::AppHandle, app_id: u64) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    let url = format!("steam://install/{}", app_id);
    app.opener()
        .open_path(&url, None::<&str>)
        .map_err(|e| e.to_string())
}

// ─── Achievements ─────────────────────────────────────────────────────────────

/// A single achievement as read from the Steam librarycache.
#[derive(Debug, serde::Serialize)]
pub struct SteamAchievement {
    /// Achievement API name (e.g. "ACH_WIN_10_MATCHES").
    pub api_name: String,
    /// Localized display name. Empty string for hidden locked achievements.
    pub name: String,
    /// Localized description. Empty string for hidden locked achievements.
    pub description: String,
    /// Whether the achievement has been unlocked.
    pub unlocked: bool,
    /// Unix timestamp of unlock, 0 if not unlocked.
    pub unlock_time: u64,
    /// Global unlock percentage across all players (0.0–100.0).
    pub global_pct: f64,
    /// CDN URL to the achievement icon image.
    pub icon: String,
    /// True when this is a secret/hidden achievement that has not been unlocked.
    /// Hidden achievements have no name or description until earned.
    pub hidden: bool,
}

// ─── Screenshots ──────────────────────────────────────────────────────────────

/// A single screenshot entry from the local Steam userdata directory.
#[derive(Debug, serde::Serialize)]
pub struct SteamScreenshot {
    /// Absolute path to the screenshot file.
    pub path: String,
    /// File size in bytes.
    pub size: u64,
    /// File modification timestamp (Unix epoch).
    pub timestamp: u64,
    /// File name without directory.
    pub filename: String,
}

/// Returns local screenshots for a game from the Steam userdata directory.
///
/// Steam stores all screenshots under the special "760" app directory:
///   `userdata/<user_id>/760/remote/<app_id>/screenshots/*.jpg`
/// Thumbnails live in a `thumbnails/` subdirectory and are excluded.
///
/// Returns an empty list if no screenshots are found.
///
/// # Errors
/// Returns an error string if Steam path cannot be detected.
#[tauri::command]
pub fn steam_get_screenshots(app_id: u64) -> Result<Vec<SteamScreenshot>, String> {
    let steam_path = steam::detect_steam_path()?;
    let userdata_dir = steam_path.join("userdata");

    let Ok(entries) = std::fs::read_dir(&userdata_dir) else {
        return Ok(Vec::new());
    };

    let mut screenshots: Vec<SteamScreenshot> = Vec::new();

    for entry in entries.flatten() {
        // Screenshots are stored under the "760" (Steam Screenshots) app dir.
        let screenshots_dir = entry.path()
            .join("760")
            .join("remote")
            .join(app_id.to_string())
            .join("screenshots");
        if !screenshots_dir.exists() { continue; }

        let Ok(files) = std::fs::read_dir(&screenshots_dir) else { continue };
        for file in files.flatten() {
            let path = file.path();
            // Skip the thumbnails/ subdirectory.
            if path.is_dir() { continue; }
            let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
            if !matches!(ext.as_str(), "jpg" | "jpeg" | "png") { continue; }
            let Ok(meta) = std::fs::metadata(&path) else { continue };
            let timestamp = meta.modified()
                .ok()
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| d.as_secs())
                .unwrap_or(0);
            screenshots.push(SteamScreenshot {
                path: path.display().to_string(),
                size: meta.len(),
                filename: file.file_name().to_string_lossy().to_string(),
                timestamp,
            });
        }
    }

    // Sort newest first.
    screenshots.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
    Ok(screenshots)
}

// ─── Cloud saves ──────────────────────────────────────────────────────────────

/// A single cloud save file from the Steam userdata remote directory.
#[derive(Debug, serde::Serialize)]
pub struct SteamCloudFile {
    /// File name (relative to the remote/ directory).
    pub name: String,
    /// File size in bytes.
    pub size: u64,
    /// File modification timestamp (Unix epoch).
    pub timestamp: u64,
}

/// Returns cloud save files for a game from the Steam userdata remote directory.
///
/// Reads from `userdata/<user_id>/<app_id>/remote/` recursively.
/// Returns an empty list if no cloud saves are found.
///
/// # Errors
/// Returns an error string if Steam path cannot be detected.
#[tauri::command]
pub fn steam_get_cloud_saves(app_id: u64) -> Result<Vec<SteamCloudFile>, String> {
    let steam_path = steam::detect_steam_path()?;
    let userdata_dir = steam_path.join("userdata");

    let Ok(entries) = std::fs::read_dir(&userdata_dir) else {
        return Ok(Vec::new());
    };

    let mut files: Vec<SteamCloudFile> = Vec::new();

    for entry in entries.flatten() {
        let remote_dir = entry.path().join(app_id.to_string()).join("remote");
        if !remote_dir.exists() { continue; }
        collect_cloud_files(&remote_dir, &remote_dir, &mut files);
    }

    // Sort alphabetically by name.
    files.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(files)
}

/// Recursively collects files from a directory into the result list.
fn collect_cloud_files(base: &std::path::Path, dir: &std::path::Path, out: &mut Vec<SteamCloudFile>) {
    let Ok(entries) = std::fs::read_dir(dir) else { return };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            collect_cloud_files(base, &path, out);
        } else {
            let Ok(meta) = std::fs::metadata(&path) else { continue };
            let timestamp = meta.modified()
                .ok()
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| d.as_secs())
                .unwrap_or(0);
            // Store relative path from the remote/ dir root.
            let name = path.strip_prefix(base)
                .map(|p| p.display().to_string())
                .unwrap_or_else(|_| entry.file_name().to_string_lossy().to_string());
            out.push(SteamCloudFile { name, size: meta.len(), timestamp });
        }
    }
}

/// Returns all achievements for a game by combining two local data sources:
///
/// 1. `appcache/stats/UserGameStatsSchema_<appId>.bin` — defines every achievement
///    (name, description, icon, hidden flag). Parsed as KeyValue binary VDF.
/// 2. `userdata/<userId>/config/librarycache/<appId>.json` — provides per-user
///    unlock state. The JSON contains:
///    - `vecHighlight`      — recently unlocked achievements (unlocked=true)
///    - `vecUnachieved`     — locked achievements (unlocked=false)
///    - `vecAchievedHidden` — unlocked hidden achievements (unlocked=true)
///    - `nAchieved` / `nTotal` — totals used for cross-checking
///
/// Achievements present in the schema but absent from ALL three vec lists are
/// unlocked achievements that Steam has not included in the highlight window.
/// We mark these unlocked=true with unlock_time=0.
///
/// Returns an empty list if neither data source is available.
///
/// # Errors
/// Loads achievements for one game from local Steam files.
///
/// Prefers the `preferred_uid` (32-bit AccountID string) when multiple user
/// dirs contain data for this app; falls back to the user with the most unlocked
/// achievements.  Returns an empty list when no data is available at all.
fn load_achievements(
    steam_path: &std::path::Path,
    app_id: u64,
    preferred_uid: Option<&str>,
) -> Vec<SteamAchievement> {
    // ── Step 1: Load achievement definitions from schema binary ────────────────
    let schema_path = steam_path
        .join("appcache")
        .join("stats")
        .join(format!("UserGameStatsSchema_{}.bin", app_id));

    let schema_defs = if schema_path.exists() {
        parse_stats_schema(&schema_path, app_id)
    } else {
        std::collections::HashMap::new()
    };

    // ── Step 2: Scan userdata directory for per-user unlock data ──────────────

    let userdata_dir = steam_path.join("userdata");
    let stats_dir = steam_path.join("appcache").join("stats");

    let Ok(user_entries) = std::fs::read_dir(&userdata_dir) else {
        return schema_defs_to_achievements(schema_defs, None, &[], &[], &[]);
    };

    // Collect all candidate users that have data for this app, tracking n_achieved
    // so we can fall back to the user with the most unlocks if preferred is absent.
    struct UserCandidate {
        uid: String,
        user_groups: Option<std::collections::HashMap<String, UserStatGroup>>,
        lib_data: Option<serde_json::Value>,
        n_achieved: u64,
    }

    let mut candidates: Vec<UserCandidate> = Vec::new();
    for user_entry in user_entries.flatten() {
        let uid = user_entry.file_name();
        let uid_str = uid.to_string_lossy();
        if !uid_str.chars().all(|c| c.is_ascii_digit()) { continue; }

        // ── Primary source: UserGameStats binary (authoritative bitmask) ─────
        let ugs_path = stats_dir.join(format!("UserGameStats_{}_{}.bin", uid_str, app_id));
        let user_groups = if ugs_path.exists() {
            Some(parse_user_game_stats(&ugs_path))
        } else {
            None
        };

        // ── Secondary source: librarycache JSON (pct, icon, names) ──────────
        let cache_path = user_entry.path()
            .join("config")
            .join("librarycache")
            .join(format!("{}.json", app_id));

        let lib_data = if cache_path.exists() {
            std::fs::read_to_string(&cache_path)
                .ok()
                .and_then(|s| serde_json::from_str::<serde_json::Value>(&s).ok())
                .and_then(|json| {
                    json.as_array()
                        .and_then(|arr| arr.iter().find(|e| {
                            e.get(0).and_then(|k| k.as_str()) == Some("achievements")
                        }))
                        .and_then(|e| e.get(1))
                        .and_then(|v| v.get("data"))
                        .cloned()
                })
        } else {
            None
        };

        // Skip this user if neither source exists for this app.
        if user_groups.is_none() && lib_data.is_none() { continue; }

        // Use nAchieved from librarycache as a quick rank signal.
        let n_achieved = lib_data.as_ref()
            .and_then(|d| d.get("nAchieved"))
            .and_then(|v| v.as_u64())
            .unwrap_or(0);

        candidates.push(UserCandidate {
            uid: uid_str.to_string(),
            user_groups,
            lib_data,
            n_achieved,
        });
    }

    // Pick preferred user first; otherwise the one with the most unlocked achievements.
    let chosen = if let Some(ref puid) = preferred_uid {
        candidates.iter().find(|c| &c.uid == puid)
            .or_else(|| candidates.iter().max_by_key(|c| c.n_achieved))
    } else {
        candidates.iter().max_by_key(|c| c.n_achieved)
    };

    if let Some(c) = chosen {
        let empty_vec: Vec<serde_json::Value> = Vec::new();
        let highlight = c.lib_data.as_ref()
            .and_then(|d| d.get("vecHighlight")).and_then(|v| v.as_array())
            .map(|v| v.as_slice()).unwrap_or(&[]);
        let unachieved = c.lib_data.as_ref()
            .and_then(|d| d.get("vecUnachieved")).and_then(|v| v.as_array())
            .map(|v| v.as_slice()).unwrap_or(&[]);
        let achieved_hidden = c.lib_data.as_ref()
            .and_then(|d| d.get("vecAchievedHidden")).and_then(|v| v.as_array())
            .map(|v| v.as_slice()).unwrap_or(&empty_vec[..]);

        if schema_defs.is_empty() {
            // No schema — fall back to librarycache only (partial data)
            return librarycache_only_achievements(highlight, unachieved, achieved_hidden);
        }

        return schema_defs_to_achievements(schema_defs, c.user_groups.as_ref(), highlight, unachieved, achieved_hidden);
    }

    // No user data found — return schema definitions with all locked
    if !schema_defs.is_empty() {
        return schema_defs_to_achievements(schema_defs, None, &[], &[], &[]);
    }

    Vec::new()
}

/// Returns achievements for a game, resolving the correct user automatically.
///
/// # Errors
/// Returns an error string if the Steam path cannot be detected.
#[tauri::command]
pub fn steam_get_achievements(app_id: u64) -> Result<Vec<SteamAchievement>, String> {
    let steam_path = steam::detect_steam_path()?;

    // Resolve the most-recently-used Steam account to its 32-bit AccountID.
    const STEAM_ID_BASE: u64 = 76561197960265728;
    let preferred_uid: Option<String> = {
        let loginusers_path = steam_path.join("config").join("loginusers.vdf");
        std::fs::read_to_string(&loginusers_path).ok()
            .as_deref()
            .map(steam::parse_loginusers)
            .and_then(|users| users.into_iter().find(|u| u.most_recent))
            .and_then(|u| u.steam_id.parse::<u64>().ok())
            .and_then(|id64| id64.checked_sub(STEAM_ID_BASE))
            .map(|acct| acct.to_string())
    };

    Ok(load_achievements(&steam_path, app_id, preferred_uid.as_deref()))
}

/// Minimal definition extracted from UserGameStatsSchema for one achievement.
struct AchDef {
    name: String,
    description: String,
    icon: String,
    icon_gray: String,
    hidden: bool,
    /// Stat group key from the schema (e.g. "0", "169").
    group_key: String,
    /// Bit index within the group's bitmask.
    bit_index: u32,
}

/// Per-group unlock state extracted from UserGameStats_<userId>_<appId>.bin.
struct UserStatGroup {
    /// Bitmask of achieved bits (bit N set = bit index N is unlocked).
    bitmask: u32,
    /// Map of bit_index → Unix unlock timestamp.
    times: std::collections::HashMap<u32, u64>,
}

/// Parses `UserGameStatsSchema_<appId>.bin` (KeyValue binary VDF).
///
/// Returns a map of api_name → AchDef for every achievement defined in the schema.
/// The KV binary format uses type-byte + null-terminated key + value:
///   0x00 = nested block (recurse until 0x08)
///   0x01 = string value (null-terminated)
///   0x02 = int32 value (4 bytes LE)
///   0x08 = end of block
/// Parses `UserGameStatsSchema_<appId>.bin` into a map of api_name → AchDef.
///
/// The file is a KeyValue binary VDF (same format as used by SteamTools/SAM):
///   type byte 0x00 = nested block (children follow, terminated by 0x08)
///   type byte 0x01 = string (null-terminated key + null-terminated value)
///   type byte 0x02 = int32 (key + 4 bytes LE)
///   type byte 0x03 = float32 (key + 4 bytes LE)
///   type byte 0x07 = uint64 (key + 8 bytes LE)
///   type byte 0x08 = end of block
///
/// Navigation path: [children] → key=<appId> → key="stats" → key=<N> → key="bits" → key=<M>
/// Each bit block has key="name" (api_name) and key="display" (nested: name, desc, icon, hidden).
fn parse_stats_schema(path: &std::path::Path, app_id: u64) -> std::collections::HashMap<String, AchDef> {
    let Ok(data) = std::fs::read(path) else { return std::collections::HashMap::new() };
    let mut cur = std::io::Cursor::new(data.as_slice());
    let mut defs = std::collections::HashMap::new();

    // The file is a flat list of top-level KV children (no wrapping block).
    // Read the root child: should be type=0x00, key=<appId>.
    let root = match kv_read_node(&mut cur) {
        Some(n) if n.key == app_id.to_string() => n,
        Some(n) => {
            // Root key might be "550" regardless of app_id format, try anyway.
            if n.type_byte != 0x00 { return defs; }
            n
        }
        None => return defs,
    };

    // Navigate root → "stats"
    let stats = match kv_child_by_key(&root.children, "stats") {
        Some(n) => n,
        None => return defs,
    };

    // Iterate each stat group (numbered "0", "1", …)
    for stat_group in &stats.children {
        if stat_group.type_byte != 0x00 { continue; }

        // Check stat type: 4 = Achievements, 5 = GroupAchievements (same structure)
        // type is stored as string "4"/"5" in newer schemas, or int 4/5 in older ones.
        // We look for the "bits" child — if present this is an achievement stat.
        let bits = match kv_child_by_key(&stat_group.children, "bits") {
            Some(b) => b,
            None => continue,
        };

        // Each child of bits is one achievement bit.
        for bit in &bits.children {
            if bit.type_byte != 0x00 { continue; }
            let api_name = kv_string_value(&bit.children, "name");
            if api_name.is_empty() { continue; }

            let display = kv_child_by_key(&bit.children, "display");
            let (name, desc, icon, icon_gray, hidden) = if let Some(d) = display {
                let name = kv_localized_string(&d.children, "name");
                let desc = kv_localized_string(&d.children, "desc");
                // Schema stores icon as a hash filename (e.g. "abc123.jpg").
                // Expand to the Steam CDN URL so the frontend can load them directly.
                let cdn = format!("https://cdn.steamstatic.com/steamcommunity/public/images/apps/{}", app_id);
                let raw_icon = kv_string_value(&d.children, "icon");
                let raw_gray = kv_string_value(&d.children, "icon_gray");
                let icon = if raw_icon.is_empty() { String::new() } else { format!("{}/{}", cdn, raw_icon) };
                let icon_gray = if raw_gray.is_empty() { String::new() } else { format!("{}/{}", cdn, raw_gray) };
                let hidden = kv_int_value(&d.children, "hidden") != 0;
                (name, desc, icon, icon_gray, hidden)
            } else {
                (String::new(), String::new(), String::new(), String::new(), false)
            };

            let group_key = stat_group.key.clone();
            let bit_index = bit.key.parse::<u32>().unwrap_or(0);
            defs.insert(api_name, AchDef { name, description: desc, icon, icon_gray, hidden, group_key, bit_index });
        }
    }

    defs
}

/// Parses `UserGameStats_<userId>_<appId>.bin` to extract per-group unlock bitmasks
/// and per-bit unlock timestamps.
///
/// Structure: root key="cache" → children keyed by stat group ID (e.g. "0", "169") →
///   each group has `data` (u32 bitmask) and optional `AchievementTimes` (nested,
///   bit_index → timestamp as u32).
fn parse_user_game_stats(path: &std::path::Path) -> std::collections::HashMap<String, UserStatGroup> {
    let Ok(data) = std::fs::read(path) else { return std::collections::HashMap::new() };
    let mut cur = std::io::Cursor::new(data.as_slice());
    let mut groups = std::collections::HashMap::new();

    // Root node: type=0x00, key="cache"
    let root = match kv_read_node(&mut cur) {
        Some(n) if n.type_byte == 0x00 => n,
        _ => return groups,
    };

    for child in &root.children {
        if child.type_byte != 0x00 { continue; }
        // Only numeric keys are stat groups.
        if !child.key.chars().all(|c| c.is_ascii_digit()) { continue; }

        let data_val = kv_child_by_key(&child.children, "data")
            .map(|n| n.int_val as u32)
            .unwrap_or(0);

        let mut times = std::collections::HashMap::new();
        if let Some(ach_times) = kv_child_by_key(&child.children, "AchievementTimes") {
            for t in &ach_times.children {
                if let Ok(bit_idx) = t.key.parse::<u32>() {
                    times.insert(bit_idx, t.int_val as u64);
                }
            }
        }

        groups.insert(child.key.clone(), UserStatGroup { bitmask: data_val, times });
    }

    groups
}

// ── Lightweight KV binary node tree ───────────────────────────────���──────────

/// A parsed KV node from the binary VDF format.
struct KvNode {
    type_byte: u8,
    key: String,
    /// String value (for type 0x01).
    str_val: String,
    /// Integer value (for type 0x02 int32 / 0x07 uint64).
    int_val: i64,
    /// Child nodes (for type 0x00 nested block).
    children: Vec<KvNode>,
}

/// Reads one KV node (type byte + key + value/children) from the cursor.
/// Returns None on EOF or end-of-block (0x08).
fn kv_read_node(cur: &mut std::io::Cursor<&[u8]>) -> Option<KvNode> {
    use std::io::Read;
    let mut tb = [0u8; 1];
    cur.read_exact(&mut tb).ok()?;
    let type_byte = tb[0];
    if type_byte == 0x08 { return None; } // end of block

    let key = kv_read_cstring(cur)?;
    let mut node = KvNode { type_byte, key, str_val: String::new(), int_val: 0, children: Vec::new() };

    match type_byte {
        0x00 => {
            // Nested block — read children until 0x08.
            loop {
                match kv_read_node(cur) {
                    Some(child) => node.children.push(child),
                    None => break, // end-of-block or EOF
                }
            }
        }
        0x01 => { node.str_val = kv_read_cstring(cur).unwrap_or_default(); }
        0x02 | 0x04 => {
            let mut buf = [0u8; 4];
            let _ = cur.read_exact(&mut buf);
            node.int_val = i32::from_le_bytes(buf) as i64;
        }
        0x03 => { let mut buf = [0u8; 4]; let _ = cur.read_exact(&mut buf); }
        0x07 => {
            let mut buf = [0u8; 8];
            let _ = cur.read_exact(&mut buf);
            node.int_val = u64::from_le_bytes(buf) as i64;
        }
        _ => {} // unknown type — skip, key already consumed
    }

    Some(node)
}

fn kv_read_cstring(cur: &mut std::io::Cursor<&[u8]>) -> Option<String> {
    use std::io::Read;
    let mut bytes = Vec::new();
    loop {
        let mut b = [0u8; 1];
        cur.read_exact(&mut b).ok()?;
        if b[0] == 0 { break; }
        bytes.push(b[0]);
    }
    Some(String::from_utf8_lossy(&bytes).into_owned())
}

/// Finds a child node by key (case-insensitive).
fn kv_child_by_key<'a>(nodes: &'a [KvNode], key: &str) -> Option<&'a KvNode> {
    nodes.iter().find(|n| n.key.eq_ignore_ascii_case(key))
}

/// Returns the string value of the first child with the given key.
fn kv_string_value(nodes: &[KvNode], key: &str) -> String {
    kv_child_by_key(nodes, key)
        .map(|n| n.str_val.clone())
        .unwrap_or_default()
}

/// Returns the int value of the first child with the given key.
fn kv_int_value(nodes: &[KvNode], key: &str) -> i64 {
    kv_child_by_key(nodes, key).map(|n| n.int_val).unwrap_or(0)
}

/// Returns a localized display string from a display sub-block.
/// Prefers schinese/tchinese (user's likely language), falls back to english, then first.
/// The "name"/"desc" child may itself be a nested block (localized map) or a plain string.
fn kv_localized_string(nodes: &[KvNode], field_key: &str) -> String {
    let node = match kv_child_by_key(nodes, field_key) {
        Some(n) => n,
        None => return String::new(),
    };
    if node.type_byte == 0x01 {
        // Plain string
        return node.str_val.clone();
    }
    if node.type_byte == 0x00 {
        // Localized map: children are language→string
        let langs = ["schinese", "tchinese", "english"];
        for lang in &langs {
            let v = kv_string_value(&node.children, lang);
            if !v.is_empty() { return v; }
        }
        // Return first non-empty string child
        for child in &node.children {
            if child.type_byte == 0x01 && !child.str_val.is_empty() {
                return child.str_val.clone();
            }
        }
    }
    String::new()
}

/// Builds the achievement list from schema definitions + UserGameStats bitmask +
/// librarycache metadata (icons, global percentages, display names).
///
/// Unlock state priority:
/// 1. UserGameStats bitmask (authoritative, covers all achievements)
/// 2. librarycache vecHighlight / vecAchievedHidden (fallback when no UGS binary)
///
/// `user_groups` is `None` when no UserGameStats binary was found for this user/app.
fn schema_defs_to_achievements(
    defs: std::collections::HashMap<String, AchDef>,
    user_groups: Option<&std::collections::HashMap<String, UserStatGroup>>,
    highlight: &[serde_json::Value],
    unachieved: &[serde_json::Value],
    achieved_hidden: &[serde_json::Value],
) -> Vec<SteamAchievement> {
    // Build librarycache lookup maps for metadata (pct, icon, names).
    // These are used regardless of unlock source because the bitmask has no icons/pct.
    let mut lib_info: std::collections::HashMap<&str, (bool, u64, f64, String)> =
        std::collections::HashMap::new();
    for item in highlight.iter().chain(achieved_hidden.iter()) {
        let Some(id) = item.get("strID").and_then(|s| s.as_str()) else { continue };
        let ts = item.get("rtUnlocked").and_then(|v| v.as_u64()).unwrap_or(0);
        let pct = item.get("flAchieved").and_then(|v| v.as_f64()).unwrap_or(0.0);
        let icon = item.get("strImage").and_then(|v| v.as_str()).unwrap_or("").to_string();
        lib_info.insert(id, (true, ts, pct, icon));
    }
    for item in unachieved {
        let Some(id) = item.get("strID").and_then(|s| s.as_str()) else { continue };
        let pct = item.get("flAchieved").and_then(|f| f.as_f64()).unwrap_or(0.0);
        let icon = item.get("strImage").and_then(|s| s.as_str()).unwrap_or("").to_string();
        lib_info.entry(id).or_insert((false, 0, pct, icon));
    }

    let mut achievements: Vec<SteamAchievement> = Vec::with_capacity(defs.len());

    for (api_name, def) in defs {
        let (unlocked, unlock_time) = if let Some(groups) = user_groups {
            // Primary: read bit from UserGameStats bitmask
            let group = groups.get(&def.group_key);
            let bit_set = group.map(|g| (g.bitmask >> def.bit_index) & 1 == 1).unwrap_or(false);
            let ts = group.and_then(|g| g.times.get(&def.bit_index)).copied().unwrap_or(0);
            (bit_set, ts)
        } else {
            // Fallback: use librarycache highlight/achieved_hidden
            lib_info.get(api_name.as_str())
                .map(|(u, ts, _, _)| (*u, *ts))
                .unwrap_or((false, 0))
        };

        // Get metadata from librarycache (pct, icon) regardless of unlock source
        let (_, _, global_pct, lib_icon) = lib_info.get(api_name.as_str())
            .cloned()
            .unwrap_or((false, 0, 0.0, String::new()));

        // Use librarycache icon if available; otherwise use schema icon (locked/unlocked variant)
        let final_icon = if !lib_icon.is_empty() {
            lib_icon
        } else if unlocked {
            def.icon.clone()
        } else {
            def.icon_gray.clone()
        };

        // Hidden = schema flag AND not yet unlocked
        let hidden = def.hidden && !unlocked;

        achievements.push(SteamAchievement {
            api_name,
            name: def.name,
            description: def.description,
            unlocked,
            unlock_time,
            global_pct,
            icon: final_icon,
            hidden,
        });
    }

    // Sort: unlocked first (newest first), then locked (most common first by global %)
    achievements.sort_by(|a, b| {
        b.unlocked.cmp(&a.unlocked)
            .then(b.unlock_time.cmp(&a.unlock_time))
            .then(b.global_pct.partial_cmp(&a.global_pct).unwrap_or(std::cmp::Ordering::Equal))
    });

    achievements
}

/// Fallback: builds achievement list from librarycache only (no schema available).
/// This is the old behavior — only shows the subset Steam includes in the JSON.
fn librarycache_only_achievements(
    highlight: &[serde_json::Value],
    unachieved: &[serde_json::Value],
    achieved_hidden: &[serde_json::Value],
) -> Vec<SteamAchievement> {
    let mut achievements: Vec<SteamAchievement> = Vec::new();

    for item in unachieved {
        let name = item.get("strName").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let hidden = name.is_empty();
        achievements.push(SteamAchievement {
            api_name:    item.get("strID").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            name,
            description: item.get("strDescription").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            unlocked: false,
            unlock_time: 0,
            global_pct:  item.get("flAchieved").and_then(|v| v.as_f64()).unwrap_or(0.0),
            icon:        item.get("strImage").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            hidden,
        });
    }
    for item in highlight.iter().chain(achieved_hidden.iter()) {
        achievements.push(SteamAchievement {
            api_name:    item.get("strID").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            name:        item.get("strName").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            description: item.get("strDescription").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            unlocked: true,
            unlock_time: item.get("rtUnlocked").and_then(|v| v.as_u64()).unwrap_or(0),
            global_pct:  item.get("flAchieved").and_then(|v| v.as_f64()).unwrap_or(0.0),
            icon:        item.get("strImage").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            hidden: false,
        });
    }

    achievements.sort_by(|a, b| {
        b.unlocked.cmp(&a.unlocked)
            .then(b.unlock_time.cmp(&a.unlock_time))
            .then(b.global_pct.partial_cmp(&a.global_pct).unwrap_or(std::cmp::Ordering::Equal))
    });
    achievements
}

// ─── Achievement editing ──────────────────────────────────────────────────────

/// One achievement change entry sent from the frontend.
#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct AchievementEdit {
    /// Achievement API name.
    pub api_name: String,
    /// Desired unlocked state.
    pub unlocked: bool,
}

/// Sets or clears Steam achievements by spawning a short-lived subprocess.
///
/// Steam ties the "game is running" state to the lifetime of the process that opened
/// the client pipe. We cannot do this inline in YukiG (which must keep running), so we
/// serialize the edits to a temp file, spawn a fresh copy of our own executable with the
/// `--steam-ach-edit` flag, wait for it to finish, and read its stdout for errors.
/// When the subprocess exits, Steam automatically clears the "running" state.
///
/// # Errors
/// Returns an error string if Steam is not running, the subprocess fails to launch, or
/// the edit returns a non-zero exit code with an error message on stdout.
#[tauri::command]
pub fn steam_set_achievements(app_id: u64, edits: Vec<AchievementEdit>) -> Result<(), String> {
    if edits.is_empty() { return Ok(()); }

    // Serialize edits to a temp file so we can pass them to the subprocess.
    let tmp = std::env::temp_dir().join(format!("yukig_ach_{}_{}.json", app_id, std::process::id()));
    let payload = serde_json::to_string(&edits).map_err(|e| e.to_string())?;
    std::fs::write(&tmp, &payload).map_err(|e| format!("Failed to write temp file: {e}"))?;

    let exe = std::env::current_exe().map_err(|e| format!("Cannot locate own executable: {e}"))?;

    let output = std::process::Command::new(&exe)
        .arg("--steam-ach-edit")
        .arg(app_id.to_string())
        .arg(&tmp)
        .output()
        .map_err(|e| format!("Failed to spawn achievement edit process: {e}"))?;

    let _ = std::fs::remove_file(&tmp);

    if output.status.success() {
        Ok(())
    } else {
        let msg = String::from_utf8_lossy(&output.stdout).trim().to_string();
        Err(if msg.is_empty() { "Achievement edit subprocess failed".to_string() } else { msg })
    }
}

/// Entry point called when the executable is launched with `--steam-ach-edit <app_id> <tempfile>`.
///
/// Reads the edits JSON from the temp file, performs the Steamworks client API calls,
/// prints any error to stdout, and returns. `main.rs` calls `std::process::exit(0)` after
/// this returns so Steam sees a clean process termination and stops the "game running" state.
pub fn run_ach_edit_subprocess(args: &[String]) {
    let app_id: u64 = args.get(2).and_then(|s| s.parse().ok()).unwrap_or(0);
    let tmp_path = match args.get(3) {
        Some(p) => std::path::PathBuf::from(p),
        None => { println!("Missing temp file argument"); return; }
    };

    let payload = match std::fs::read_to_string(&tmp_path) {
        Ok(s) => s,
        Err(e) => { println!("Failed to read temp file: {e}"); return; }
    };
    let edits: Vec<AchievementEdit> = match serde_json::from_str(&payload) {
        Ok(v) => v,
        Err(e) => { println!("Failed to parse edits: {e}"); return; }
    };

    let steam_path = match steam::detect_steam_path() {
        Ok(p) => p,
        Err(e) => { println!("{e}"); return; }
    };

    let client_dll = steam_path.join("steamclient64.dll");
    if !client_dll.exists() {
        println!("steamclient64.dll not found at {}", steam_path.display());
        return;
    }

    unsafe { std::env::set_var("SteamAppId", app_id.to_string()); }
    if let Err(e) = unsafe { apply_via_client_unsafe(&client_dll, app_id, &edits) } {
        println!("{e}");
    }
    // env var cleared automatically when process exits
}

/// # Safety
/// Calls raw function pointers from a loaded DLL. All signatures are verified against
/// the SteamClient018 / ISteamUserStats011 vtable layout in the SteamClient-dev repo.
unsafe fn apply_via_client_unsafe(
    client_dll: &std::path::Path,
    _app_id: u64,
    edits: &[AchievementEdit],
) -> Result<(), String> {
    // ── Types ────────────────────────────────────────────────────────────────
    // Raw object pointer type: pointer to a pointer to vtable array.
    type ObjPtr = *mut *mut usize;
    type FnCreateInterface = unsafe extern "C" fn(*const i8, *mut i32) -> ObjPtr;
    type FnCreatePipe     = unsafe extern "system" fn(ObjPtr) -> i32;
    type FnConnectUser    = unsafe extern "system" fn(ObjPtr, i32) -> i32;
    type FnReleaseUser    = unsafe extern "system" fn(ObjPtr, i32, i32);
    type FnReleasePipe    = unsafe extern "system" fn(ObjPtr, i32) -> bool;
    type FnGetUserStats   = unsafe extern "system" fn(ObjPtr, i32, i32, *const i8) -> ObjPtr;
    type FnReqStats       = unsafe extern "system" fn(ObjPtr) -> bool;
    type FnSetAch         = unsafe extern "system" fn(ObjPtr, *const i8) -> bool;
    type FnClearAch       = unsafe extern "system" fn(ObjPtr, *const i8) -> bool;
    type FnStoreStats     = unsafe extern "system" fn(ObjPtr) -> bool;
    type FnGetCallback    = unsafe extern "C" fn(i32, *mut CallbackMsg, *mut i32) -> bool;
    type FnFreeCallback   = unsafe extern "C" fn(i32);
    /// ShutdownIfAllPipesClosed — tells Steam to stop showing the game as running.
    type FnShutdown       = unsafe extern "system" fn(ObjPtr) -> bool;

    // ── Load DLL ────────────────────────────────────────────────────────────
    // steamclient64.dll depends on Steam.dll, tier0_s64.dll, and others that
    // live in the same Steam directory. LOAD_WITH_ALTERED_SEARCH_PATH makes
    // Windows resolve those dependencies from the DLL's own directory rather
    // than the process working directory.
    // LOAD_WITH_ALTERED_SEARCH_PATH (0x8) makes Windows resolve steamclient64.dll's
    // own dependencies (Steam.dll, tier0_s64.dll, etc.) from its directory, not ours.
    const LOAD_WITH_ALTERED_SEARCH_PATH: u32 = 0x0000_0008;
    let win_lib = libloading::os::windows::Library::load_with_flags(client_dll, LOAD_WITH_ALTERED_SEARCH_PATH)
        .map_err(|e| format!("Failed to load steamclient64.dll: {e}"))?;
    // Convert to the generic Library so Symbol types match the rest of the function.
    let lib: libloading::Library = win_lib.into();

    let create_iface: libloading::Symbol<FnCreateInterface> = lib
        .get(b"CreateInterface\0")
        .map_err(|e| format!("CreateInterface not found: {e}"))?;
    let steam_get_callback: libloading::Symbol<FnGetCallback> = lib
        .get(b"Steam_BGetCallback\0")
        .map_err(|e| format!("Steam_BGetCallback not found: {e}"))?;
    let steam_free_callback: libloading::Symbol<FnFreeCallback> = lib
        .get(b"Steam_FreeLastCallback\0")
        .map_err(|e| format!("Steam_FreeLastCallback not found: {e}"))?;

    // ── Acquire SteamClient018 ───────────────────────────────────────────────
    let client_name = std::ffi::CString::new("SteamClient018")
        .map_err(|_| "bad string")?;
    let client_obj = create_iface(client_name.as_ptr(), std::ptr::null_mut());
    if client_obj.is_null() {
        return Err("CreateInterface(SteamClient018) returned null — is Steam running?".to_string());
    }
    // Dereference vtable: *client_obj = pointer to vtable array of fn ptrs.
    let client_vtable = *client_obj;

    // ISteamClient018 vtable offsets (0-based, matching ISteamClient018.cs field order):
    //   0 CreateSteamPipe, 1 ReleaseSteamPipe, 2 ConnectToGlobalUser, 3 CreateLocalUser,
    //   4 ReleaseUser, 5 GetISteamUser, 6 GetISteamGameServer, 7 SetLocalIPBinding,
    //   8 GetISteamFriends, 9 GetISteamUtils, 10 GetISteamMatchmaking,
    //   11 GetISteamMatchmakingServers, 12 GetISteamGenericInterface,
    //   13 GetISteamUserStats, ... 23 ShutdownIfAllPipesClosed
    let fn_create_pipe      = std::mem::transmute::<usize, FnCreatePipe  >(client_vtable.add(0).read());
    let fn_connect_user     = std::mem::transmute::<usize, FnConnectUser >(client_vtable.add(2).read());
    let fn_release_user     = std::mem::transmute::<usize, FnReleaseUser >(client_vtable.add(4).read());
    let fn_release_pipe     = std::mem::transmute::<usize, FnReleasePipe >(client_vtable.add(1).read());
    let fn_get_user_stats   = std::mem::transmute::<usize, FnGetUserStats>(client_vtable.add(13).read());
    let fn_shutdown_if_done = std::mem::transmute::<usize, FnShutdown    >(client_vtable.add(23).read());

    // ── Open pipe + user session ─────────────────────────────────────────────
    let pipe = fn_create_pipe(client_obj);
    if pipe == 0 {
        return Err("CreateSteamPipe failed — Steam may not be running".to_string());
    }
    let user = fn_connect_user(client_obj, pipe);
    if user == 0 {
        fn_release_pipe(client_obj, pipe);
        return Err("ConnectToGlobalUser failed".to_string());
    }

    // ── Acquire ISteamUserStats011 ───────────────────────────────────────────
    let stats_ver = std::ffi::CString::new("STEAMUSERSTATS_INTERFACE_VERSION011")
        .map_err(|_| "bad string")?;
    let stats_obj = fn_get_user_stats(client_obj, user, pipe, stats_ver.as_ptr());
    if stats_obj.is_null() {
        fn_release_user(client_obj, pipe, user);
        fn_release_pipe(client_obj, pipe);
        fn_shutdown_if_done(client_obj);
        return Err("GetISteamUserStats(v011) returned null".to_string());
    }
    let stats_vtable = *stats_obj;

    // ISteamUserStats011 vtable offsets (matching ISteamUserStats007.cs field order):
    //   0 RequestCurrentStats, 1 GetStatFloat, 2 GetStatInteger, 3 SetStatFloat,
    //   4 SetStatInteger, 5 UpdateAvgRateStat, 6 GetAchievement, 7 SetAchievement,
    //   8 ClearAchievement, 9 GetAchievementAndUnlockTime, 10 StoreStats, ...
    let fn_req_stats  = std::mem::transmute::<usize, FnReqStats >(stats_vtable.add(0).read());
    let fn_set_ach    = std::mem::transmute::<usize, FnSetAch   >(stats_vtable.add(7).read());
    let fn_clear_ach  = std::mem::transmute::<usize, FnClearAch >(stats_vtable.add(8).read());
    let fn_store_stats= std::mem::transmute::<usize, FnStoreStats>(stats_vtable.add(10).read());

    // ── RequestCurrentStats + wait for UserStatsReceived callback ────────────
    fn_req_stats(stats_obj);

    // UserStatsReceived callback ID = 1101 (k_iSteamUserStatsCallbacks + 1)
    const USER_STATS_RECEIVED_ID: i32 = 1101;
    let deadline = std::time::Instant::now() + std::time::Duration::from_secs(10);
    let mut stats_ready = false;
    while std::time::Instant::now() < deadline {
        let mut msg = CallbackMsg { pipe: 0, id: 0, param: std::ptr::null_mut(), param_size: 0 };
        let mut call: i32 = 0;
        while steam_get_callback(pipe, &mut msg, &mut call) {
            if msg.id == USER_STATS_RECEIVED_ID { stats_ready = true; }
            steam_free_callback(pipe);
        }
        if stats_ready { break; }
        std::thread::sleep(std::time::Duration::from_millis(100));
    }

    if !stats_ready {
        fn_release_user(client_obj, pipe, user);
        fn_release_pipe(client_obj, pipe);
        fn_shutdown_if_done(client_obj);
        return Err("Timed out waiting for UserStatsReceived — is the game owned by this account?".to_string());
    }

    // ── Apply edits ──────────────────────────────────────────────────────────
    for edit in edits {
        let cname = std::ffi::CString::new(edit.api_name.as_str())
            .map_err(|_| format!("Invalid achievement name: {}", edit.api_name))?;
        let ok = if edit.unlocked {
            fn_set_ach(stats_obj, cname.as_ptr())
        } else {
            fn_clear_ach(stats_obj, cname.as_ptr())
        };
        if !ok {
            fn_release_user(client_obj, pipe, user);
            fn_release_pipe(client_obj, pipe);
            fn_shutdown_if_done(client_obj);
            return Err(format!("Failed to change achievement '{}'", edit.api_name));
        }
    }

    // ── Persist changes ──────────────────────────────────────────────────────
    if !fn_store_stats(stats_obj) {
        fn_release_user(client_obj, pipe, user);
        fn_release_pipe(client_obj, pipe);
        fn_shutdown_if_done(client_obj);
        return Err("StoreStats failed — changes may not have been saved".to_string());
    }

    // ── Release session — stops Steam showing the game as running ─────────────
    fn_release_user(client_obj, pipe, user);
    fn_release_pipe(client_obj, pipe);
    fn_shutdown_if_done(client_obj);
    Ok(())
}

/// Minimal layout of a Steam callback message, matching the Steamworks SDK struct.
#[repr(C)]
struct CallbackMsg {
    pipe:       i32,
    id:         i32,
    param:      *mut u8,
    param_size: i32,
}
