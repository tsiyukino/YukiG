/// Steam integration service.
///
/// Provides:
/// - Steam install path detection (Windows registry)
/// - Full game library scanning via `appinfo.vdf` (binary) for ALL owned games
/// - `.acf` manifest reading for installation status and paths
/// - `localconfig.vdf` VDF-tree traversal for Steam Collections
/// - `loginusers.vdf` parsing for account switcher
/// - CDN artwork URL construction
///
/// ## Why appinfo.vdf?
/// `.acf` manifest files only exist for **installed** games. `appinfo.vdf` is a
/// binary cache maintained by the Steam client that contains metadata (including
/// the display name) for every app the client has ever encountered. Parsing it
/// gives us all game names without any API key or network request.
///
/// ## appinfo.vdf binary format
/// Known magic values (from BD.SteamClient8 source):
///   0x07564427 (123094055) — original; header = 40 bytes (no second sha1); keys = cstrings
///   0x07564428 (123094056) — V2;       header = 60 bytes (adds second sha1); keys = cstrings
///   0x07564429 (123094057) — V3;       header = 60 bytes + string pool at EOF; keys = u32 pool indices
///
/// File layout:
///   u32  magic
///   u32  universe
///   [V3 only] i64  string_table_offset  (seek there to read the pool)
///   repeated app entries until app_id == 0:
///     u32  app_id
///     i32  data_size       (total bytes that follow for this entry)
///     [data_size bytes]    per-entry blob:
///       bytes[16]  stuff_before_hash  (info_state + last_updated + access_token)
///       bytes[20]  sha1_hash
///       u32        change_number
///       [V2/V3]    bytes[20]  sha1_hash2
///       KV blob    (keys are cstrings for V1/V2, u32 pool indices for V3)
///   u32  0  (end sentinel)
///
/// KV blob path to name: root["appinfo"]["common"]["name"]
use std::collections::{HashMap, HashSet};
use std::fs;
use std::io::{Cursor, Read};
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

// ─── Public types ─────────────────────────────────────────────────────────────

/// A single game as returned by the Steam scanner.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SteamGame {
    pub app_id: u64,
    pub name: String,
    /// Absolute install path, or None if not installed.
    pub install_path: Option<String>,
    pub is_installed: bool,
    /// Steam Collection names this game belongs to.
    pub collections: Vec<String>,
    /// Total size on disk in bytes (0 if uninstalled).
    pub size_on_disk: u64,
    /// Bytes downloaded (useful for partially-downloaded games).
    pub bytes_downloaded: u64,
    /// Steam community icon URL (~184×184 JPG, built from icon_hash in appinfo.vdf).
    /// Fast-loading square icon; reliable across all games including new hash-path games.
    /// Empty string if icon_hash was not found in appinfo.vdf.
    pub icon_url: String,
    /// Header image (920×430). Local `librarycache/` path when cached by Steam; CDN URL otherwise.
    pub header_image: String,
    /// Library capsule portrait (600×900). Local `librarycache/` path when cached; CDN URL otherwise.
    pub library_image: String,
    /// Library hero (3840×1240). Local `librarycache/` path when cached; CDN URL otherwise.
    pub library_hero: String,
    /// Library logo PNG (transparent, up to 1280×720). Local `librarycache/` path when cached; CDN URL otherwise.
    pub library_logo: String,
    /// Last played timestamp (Unix epoch), 0 if never.
    pub last_played: u64,
    /// Total playtime in minutes (from localconfig.vdf), 0 if unknown.
    pub playtime_minutes: u64,
    /// Developer name from appinfo.vdf common section.
    pub developer: Option<String>,
    /// Publisher name from appinfo.vdf common section.
    pub publisher: Option<String>,
    /// Original release date (Unix timestamp) from appinfo.vdf. 0 if unknown.
    pub release_date: u64,
    /// Supported OS flags: bitmask where 1=Windows, 2=Mac, 4=Linux.
    pub os_list: u32,
    /// Steam category IDs from appinfo.vdf (e.g. 1=Multi-player, 9=Co-op, 36=Online PvP).
    /// Empty if not found.
    pub categories: Vec<u32>,
    /// App type from appinfo.vdf `common → type` (e.g. "game", "Application", "Tool", "DLC").
    /// Empty string when not found.
    pub app_type: String,
}

/// Metadata extracted from the appinfo.vdf common section per app.
///
/// Asset hash fields come from two sources:
/// - Flat string keys (`icon`, `clienticon`) for community/client icons
/// - Nested tables (`header_image.english`, `library_assets_full.*.image.english`) for
///   new content-addressed library assets. Values are `{sha1}/{filename}` strings used
///   with the `shared.akamai.steamstatic.com/store_item_assets/steam/apps/{id}/` base URL.
#[derive(Debug, Clone, Default)]
pub struct AppInfoMeta {
    pub name: Option<String>,
    pub developer: Option<String>,
    pub publisher: Option<String>,
    /// Original release date (Unix epoch).
    pub release_date: u64,
    /// OS bitmask: 1=Windows, 2=Mac, 4=Linux.
    pub os_list: u32,
    /// 40-char hex hash from `common → "icon"`. Used for the community icon URL.
    pub icon_hash: Option<String>,
    /// `{hash}/{filename}` from `common → header_image → english`.
    /// Build URL: shared.akamai.steamstatic.com/store_item_assets/steam/apps/{id}/{value}
    pub header_hash_path: Option<String>,
    /// `{hash}/{filename}` from `common → small_capsule → english`.
    pub capsule_hash_path: Option<String>,
    /// `{hash}/{filename}` from `common → library_assets_full → library_capsule → image → english`.
    pub library_capsule_hash_path: Option<String>,
    /// `{hash}/{filename}` from `common → library_assets_full → library_hero → image → english`.
    pub library_hero_hash_path: Option<String>,
    /// `{hash}/{filename}` from `common → library_assets_full → library_logo → image → english`.
    pub library_logo_hash_path: Option<String>,
    /// `{hash}/{filename}` from `common → library_assets_full → library_header → image → english`.
    pub library_header_hash_path: Option<String>,
    /// Steam category IDs from appinfo.vdf (stored under `categories` table in the app root).
    pub categories: Vec<u32>,
    /// App type from appinfo.vdf `common → type` (e.g. "game", "Game", "Application", "Tool", "DLC").
    /// Empty string when not found.
    pub app_type: String,
}

/// A Steam user account from loginusers.vdf.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SteamUser {
    /// SteamID64 as a string (the VDF key).
    pub steam_id: String,
    pub account_name: String,
    pub persona_name: String,
    pub remember_password: bool,
    pub most_recent: bool,
    pub timestamp: u64,
    pub wants_offline_mode: bool,
    /// Avatar URL (Steam CDN).
    pub avatar_url: String,
}

/// Full result of a Steam library scan.
#[derive(Debug, Serialize, Deserialize)]
pub struct SteamScanResult {
    pub games: Vec<SteamGame>,
    pub collection_names: Vec<String>,
    pub steam_path: String,
    pub users: Vec<SteamUser>,
}

// ─── Path detection ───────────────────────────────────────────────────────────

/// Detects the Steam install path from the Windows registry.
pub fn detect_steam_path() -> Result<PathBuf, String> {
    use winreg::enums::HKEY_LOCAL_MACHINE;
    use winreg::RegKey;

    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);

    if let Ok(key) = hklm.open_subkey("SOFTWARE\\WOW6432Node\\Valve\\Steam") {
        if let Ok(path) = key.get_value::<String, _>("InstallPath") {
            let p = PathBuf::from(path);
            if p.exists() { return Ok(p); }
        }
    }
    if let Ok(key) = hklm.open_subkey("SOFTWARE\\Valve\\Steam") {
        if let Ok(path) = key.get_value::<String, _>("InstallPath") {
            let p = PathBuf::from(path);
            if p.exists() { return Ok(p); }
        }
    }

    let default = PathBuf::from("C:\\Program Files (x86)\\Steam");
    if default.exists() { return Ok(default); }

    Err("Steam installation not found. Please ensure Steam is installed.".to_string())
}

// ─── Main scan ────────────────────────────────────────────────────────────────

/// Scans the full Steam library and returns games, collections, and accounts.
pub fn scan(steam_path: &Path) -> Result<SteamScanResult, String> {
    // 1. Parse appinfo.vdf for game names and metadata (installed + uninstalled).
    //    This file has names for every app Steam has cached, but is NOT used for
    //    ownership — user configs (localconfig/sharedconfig) determine that.
    let appinfo_path = steam_path.join("appcache").join("appinfo.vdf");
    let app_meta: HashMap<u64, AppInfoMeta> = if appinfo_path.exists() {
        parse_appinfo(&appinfo_path).unwrap_or_default()
    } else {
        HashMap::new()
    };
    // Derive the name-only map for ACF parsing (prefers appinfo name over ACF name).
    let app_names: HashMap<u64, String> = app_meta.iter()
        .filter_map(|(id, m)| m.name.clone().map(|n| (*id, n)))
        .collect();

    // 2. Find all Steam library folders.
    let library_paths = find_library_paths(steam_path);

    // 3. Read installed games from .acf manifests.
    let mut installed: HashMap<u64, SteamGame> = HashMap::new();
    for lib_path in &library_paths {
        read_acf_manifests(&lib_path.join("steamapps"), lib_path, &mut installed, &app_names);
    }

    // 4. Find user directories — prefer the single active user to avoid merging
    //    data from multiple accounts (e.g., owned games, playtime, collections).
    let userdata_dir = steam_path.join("userdata");
    let user_dirs: Vec<std::path::PathBuf> = {
        // Parse loginusers.vdf to find the most-recently-active account.
        // SteamID64 → AccountID (32-bit) conversion: id64 - 76561197960265728.
        // The AccountID is the directory name inside userdata/.
        let loginusers_path = steam_path.join("config").join("loginusers.vdf");
        let active_dir = if loginusers_path.exists() {
            fs::read_to_string(&loginusers_path)
                .ok()
                .and_then(|content| {
                    parse_loginusers(&content)
                        .into_iter()
                        .find(|u| u.most_recent)
                })
                .and_then(|u| u.steam_id.parse::<u64>().ok())
                .map(|id64| id64.saturating_sub(76_561_197_960_265_728_u64))
                .map(|account_id| userdata_dir.join(account_id.to_string()))
                .filter(|dir| dir.is_dir())
        } else {
            None
        };

        match active_dir {
            Some(dir) => vec![dir],
            None => find_user_dirs(&userdata_dir),
        }
    };

    // 5. Parse collections, last-played times, and playtime from localconfig.vdf.
    let mut collection_map: HashMap<u64, Vec<String>> = HashMap::new();
    let mut collection_names: Vec<String> = Vec::new();
    let mut last_played_map: HashMap<u64, u64> = HashMap::new();
    let mut playtime_map: HashMap<u64, u64> = HashMap::new();
    let mut hidden_ids: HashSet<u64> = HashSet::new();

    // 6. Collect all owned app IDs from sharedconfig.vdf (older format, still used).
    let mut all_app_ids: HashSet<u64> = HashSet::new();

    for user_dir in &user_dirs {
        // sharedconfig.vdf — apps the user owns (older Steam format, still maintained).
        let shared = user_dir.join("7").join("remote").join("sharedconfig.vdf");
        if shared.exists() {
            if let Ok(content) = fs::read_to_string(&shared) {
                parse_sharedconfig(&content, &mut all_app_ids, &mut last_played_map);
            }
        }

        // localconfig.vdf — last-played times, playtime minutes, and collections.
        let local = user_dir.join("config").join("localconfig.vdf");
        if local.exists() {
            if let Ok(content) = fs::read_to_string(&local) {
                parse_localconfig(&content, &mut all_app_ids, &mut collection_map,
                                  &mut collection_names, &mut last_played_map,
                                  &mut playtime_map, &mut hidden_ids);
            }
        }

        // cloud-storage-namespace-1.json — Steam collections (current format since 2022).
        // Steam migrated collection data out of localconfig.vdf; this file is now authoritative.
        // Also try the .modified variant which holds locally-pending changes.
        let cloudstorage = user_dir.join("config").join("cloudstorage");
        for filename in &["cloud-storage-namespace-1.json", "cloud-storage-namespace-1.modified.json"] {
            let cloud_file = cloudstorage.join(filename);
            if cloud_file.exists() {
                if let Ok(content) = fs::read_to_string(&cloud_file) {
                    parse_cloud_collections(&content, &mut all_app_ids, &mut collection_map,
                                            &mut collection_names, &mut hidden_ids);
                }
            }
        }
    }

    // 7. Build the full set of app IDs to show.
    //    Priority: installed games + IDs from user configs (owned games).
    //    appinfo.vdf contains ALL apps Steam has seen (tools, DLCs, other users' games)
    //    so we must NOT use it as the source of truth for ownership.
    let mut all_ids: HashSet<u64> = installed.keys().cloned().collect();
    all_ids.extend(all_app_ids.iter());

    // 8. Build final game list.
    let mut games: Vec<SteamGame> = Vec::new();
    let mut installed = installed; // make mutable for remove()

    for app_id in &all_ids {
        let last_played = last_played_map.get(app_id).cloned().unwrap_or(0);
        let playtime_minutes = playtime_map.get(app_id).cloned().unwrap_or(0);
        let collections = collection_map.get(app_id).cloned().unwrap_or_default();
        let meta = app_meta.get(app_id);

        if let Some(mut game) = installed.remove(app_id) {
            game.collections = collections;
            game.last_played = last_played;
            game.playtime_minutes = playtime_minutes;
            if let Some(m) = meta {
                game.developer = m.developer.clone();
                game.publisher = m.publisher.clone();
                game.release_date = m.release_date;
                game.os_list = m.os_list;
                game.categories = m.categories.clone();
                game.app_type = m.app_type.clone();
                if let Some(ref h) = m.icon_hash {
                    game.icon_url = cdn_community_icon(*app_id, h);
                }
                // Prefer local librarycache files; fall back to CDN URLs.
                let app_cache = steam_path.join("appcache").join("librarycache").join(app_id.to_string());
                game.header_image  = local_or_cdn(&app_cache, &["header.jpg"],                               cdn_header_hashed(*app_id,  m.header_hash_path.as_deref()));
                game.library_image = local_or_cdn(&app_cache, &["library_600x900.jpg", "library_capsule.jpg"], cdn_library_hashed(*app_id, m.library_capsule_hash_path.as_deref()));
                game.library_hero  = local_or_cdn(&app_cache, &["library_hero.jpg"],                         cdn_hero_hashed(*app_id,    m.library_hero_hash_path.as_deref()));
                game.library_logo  = local_or_cdn(&app_cache, &["logo.png"],                                 cdn_logo_hashed(*app_id,    m.library_logo_hash_path.as_deref()));
            }
            games.push(game);
        } else {
            let name = app_names
                .get(app_id)
                .cloned()
                .unwrap_or_else(|| format!("App {}", app_id));
            let icon_url = meta
                .and_then(|m| m.icon_hash.as_ref())
                .map(|h| cdn_community_icon(*app_id, h))
                .unwrap_or_default();
            let app_cache = steam_path.join("appcache").join("librarycache").join(app_id.to_string());
            games.push(SteamGame {
                app_id: *app_id,
                name,
                install_path: None,
                is_installed: false,
                collections,
                size_on_disk: 0,
                bytes_downloaded: 0,
                icon_url,
                header_image:  local_or_cdn(&app_cache, &["header.jpg"],                                cdn_header_hashed(*app_id,  meta.and_then(|m| m.header_hash_path.as_deref()))),
                library_image: local_or_cdn(&app_cache, &["library_600x900.jpg", "library_capsule.jpg"], cdn_library_hashed(*app_id, meta.and_then(|m| m.library_capsule_hash_path.as_deref()))),
                library_hero:  local_or_cdn(&app_cache, &["library_hero.jpg"],                           cdn_hero_hashed(*app_id,    meta.and_then(|m| m.library_hero_hash_path.as_deref()))),
                library_logo:  local_or_cdn(&app_cache, &["logo.png"],                                  cdn_logo_hashed(*app_id,    meta.and_then(|m| m.library_logo_hash_path.as_deref()))),
                last_played,
                playtime_minutes,
                developer: meta.and_then(|m| m.developer.clone()),
                publisher: meta.and_then(|m| m.publisher.clone()),
                release_date: meta.map(|m| m.release_date).unwrap_or(0),
                os_list: meta.map(|m| m.os_list).unwrap_or(0),
                categories: meta.map(|m| m.categories.clone()).unwrap_or_default(),
                app_type: meta.map(|m| m.app_type.clone()).unwrap_or_default(),
            });
        }
    }

    // Remove hidden games before sorting.
    games.retain(|g| !hidden_ids.contains(&g.app_id));

    // Sort: installed first (by last_played desc), then uninstalled (by name).
    games.sort_by(|a, b| {
        match (a.is_installed, b.is_installed) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            (true, true) => b.last_played.cmp(&a.last_played),
            (false, false) => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        }
    });

    // Deduplicate collection names (Favorites always first).
    collection_names.dedup();
    if let Some(pos) = collection_names.iter().position(|n| n == "Favorites") {
        let fav = collection_names.remove(pos);
        collection_names.insert(0, fav);
    }

    // 9. Parse accounts from loginusers.vdf.
    let loginusers_path = steam_path.join("config").join("loginusers.vdf");
    let users = if loginusers_path.exists() {
        if let Ok(content) = fs::read_to_string(&loginusers_path) {
            parse_loginusers(&content)
        } else {
            Vec::new()
        }
    } else {
        Vec::new()
    };

    Ok(SteamScanResult {
        games,
        collection_names,
        steam_path: steam_path.display().to_string(),
        users,
    })
}

// ─── appinfo.vdf binary parser ────────────────────────────────────────────────

/// Public wrapper for debug command — returns name map.
pub fn parse_appinfo_pub(path: &Path) -> Result<HashMap<u64, String>, String> {
    let meta = parse_appinfo(path)?;
    Ok(meta.into_iter()
        .filter_map(|(id, m)| m.name.map(|n| (id, n)))
        .collect())
}

/// Public wrapper for debug — returns full meta including categories.
pub fn parse_appinfo_full_pub(path: &Path) -> Result<HashMap<u64, AppInfoMeta>, String> {
    parse_appinfo(path)
}

/// Parses `appinfo.vdf` and returns a map of app_id → AppInfoMeta.
///
/// Extracts name, developer, publisher, release_date, and os_list from the
/// "common" section of each app entry. Skips entries without a name.
fn parse_appinfo(path: &Path) -> Result<HashMap<u64, AppInfoMeta>, String> {
    let data = fs::read(path).map_err(|e| format!("Cannot read appinfo.vdf: {}", e))?;
    let mut cur = Cursor::new(data.as_slice());
    let mut names: HashMap<u64, AppInfoMeta> = HashMap::new();

    let magic = read_u32(&mut cur)?;
    let is_v2 = magic == 0x07564428;
    let is_v3 = magic == 0x07564429;
    match magic {
        0x07564427 | 0x07564428 | 0x07564429 => {}
        _ => return Err(format!("Unknown appinfo.vdf magic: {:#010x}", magic)),
    };

    let _universe = read_u32(&mut cur)?;

    // V3: read the string pool (keys are u32 pool indices instead of cstrings).
    let string_pool: Vec<String> = if is_v3 {
        let table_offset = read_i64(&mut cur)?;
        let saved_pos = cur.position();
        cur.set_position(table_offset as u64);
        let count = read_u32(&mut cur)? as usize;
        let mut pool = Vec::with_capacity(count);
        for _ in 0..count {
            pool.push(read_cstring(&mut cur)?);
        }
        cur.set_position(saved_pos);
        pool
    } else {
        Vec::new()
    };
    let string_pool = if is_v3 { Some(string_pool) } else { None };

    let header_size: usize = if is_v2 || is_v3 { 60 } else { 40 };

    loop {
        // Any read error here means we hit EOF or corruption — stop cleanly.
        let app_id = match read_u32(&mut cur) {
            Ok(0) | Err(_) => break,
            Ok(id) => id,
        };

        // data_size covers the full per-entry blob (header + KV).
        let data_size = match read_i32(&mut cur) {
            Ok(n) if n > 0 => n as usize,
            _ => break,
        };

        // Read the whole blob; any error = stop.
        let mut blob = vec![0u8; data_size];
        if cur.read_exact(&mut blob).is_err() { break; }

        if data_size < header_size { continue; }

        let mut entry = Cursor::new(blob.as_slice());
        // Skip the fixed header — it cannot fail because we know blob.len() >= header_size.
        entry.set_position(header_size as u64);

        if let Some(meta) = extract_meta_from_kv_entry(&mut entry, string_pool.as_deref()) {
            names.insert(app_id as u64, meta);
        }
    }

    Ok(names)
}

/// Extracts AppInfoMeta from a per-entry KV blob.
///
/// Supports both V1/V2 (keys = null-terminated cstrings) and V3 (keys = u32 pool indices).
///
/// KV type codes (SteamAppPropertyType):
///   0x00 = Table   (nested object, terminated by 0x08)
///   0x01 = String  (null-terminated UTF-8)
///   0x02 = Int32   (4 bytes LE)
///   0x03 = Float   (4 bytes)
///   0x04 = Pointer/Int64 (8 bytes)
///   0x05 = WString (null-terminated UTF-16LE pairs)
///   0x06 = Color   (3 bytes RGB)
///   0x07 = Uint64  (8 bytes LE)
///   0x08 = EndOfTable
fn extract_meta_from_kv_entry(cur: &mut Cursor<&[u8]>, pool: Option<&[String]>) -> Option<AppInfoMeta> {
    find_meta_recursive(cur, pool)
}

fn read_key(cur: &mut Cursor<&[u8]>, pool: Option<&[String]>) -> Result<String, String> {
    match pool {
        Some(p) => {
            let idx = read_i32(cur)? as usize;
            p.get(idx).cloned().ok_or_else(|| format!("string pool index {} out of range", idx))
        }
        None => read_cstring(cur),
    }
}

fn find_meta_recursive(cur: &mut Cursor<&[u8]>, pool: Option<&[String]>) -> Option<AppInfoMeta> {
    loop {
        let type_byte = read_u8(cur).ok()?;
        if type_byte == 0x08 { return None; }

        let key = read_key(cur, pool).ok()?;

        match type_byte {
            0x00 => {
                if key.eq_ignore_ascii_case("common") {
                    if let Some(meta) = find_meta_in_common(cur, pool) {
                        return Some(meta);
                    }
                } else if let Some(meta) = find_meta_recursive(cur, pool) {
                    return Some(meta);
                }
            }
            0x01 => { let _ = read_cstring(cur); }
            0x02 | 0x03 | 0x0A => { skip(cur, 4).ok()?; }
            0x04 | 0x07 => { skip(cur, 8).ok()?; }
            0x05 => { skip_wstring(cur); }
            0x06 => { skip(cur, 3).ok()?; }
            _ => return None,
        }
    }
}

/// Parses the "common" section of an appinfo entry, extracting all metadata fields.
///
/// Handles both flat string keys (name, icon, etc.) and nested tables:
/// - `header_image.english` → `header_hash_path`
/// - `small_capsule.english` → `capsule_hash_path`
/// - `library_assets_full.{asset}.image.english` → per-asset hash paths
fn find_meta_in_common(cur: &mut Cursor<&[u8]>, pool: Option<&[String]>) -> Option<AppInfoMeta> {
    let mut meta = AppInfoMeta::default();
    loop {
        let type_byte = read_u8(cur).ok()?;
        if type_byte == 0x08 { break; }
        let key = read_key(cur, pool).ok()?;
        match type_byte {
            0x01 => {
                let val = read_cstring(cur).ok()?;
                match key.to_ascii_lowercase().as_str() {
                    "name"      => meta.name = Some(val),
                    "developer" => meta.developer = Some(val),
                    "publisher" => meta.publisher = Some(val),
                    "oslist"    => meta.os_list = parse_oslist(&val),
                    "icon" if !val.is_empty() => meta.icon_hash = Some(val),
                    "type" if !val.is_empty() => meta.app_type = val,
                    _ => {}
                }
            }
            0x02 | 0x0A => {
                let val = read_i32(cur).ok()? as u64;
                let key_lower = key.to_ascii_lowercase();
                match key_lower.as_str() {
                    "original_release_date" => {
                        if meta.release_date == 0 { meta.release_date = val; }
                    }
                    "steam_release_date" => {
                        if meta.release_date == 0 { meta.release_date = val; }
                    }
                    // V3 flat format: individual category_N = 1 keys directly in common.
                    k if k.starts_with("category_") => {
                        if let Ok(id) = k["category_".len()..].parse::<u32>() {
                            if val != 0 { meta.categories.push(id); }
                        }
                    }
                    _ => {}
                }
            }
            0x03 => { skip(cur, 4).ok()?; }
            0x00 => {
                match key.to_ascii_lowercase().as_str() {
                    // header_image table: { english: "{hash}/header.jpg", ... }
                    "header_image" => {
                        meta.header_hash_path = read_locale_string(cur, pool, "english");
                    }
                    // small_capsule table: { english: "{hash}/capsule_231x87.jpg", ... }
                    "small_capsule" => {
                        meta.capsule_hash_path = read_locale_string(cur, pool, "english");
                    }
                    // library_assets_full: nested { library_capsule: { image: { english: ..} }, .. }
                    "library_assets_full" => {
                        parse_library_assets_full(cur, pool, &mut meta);
                    }
                    // V3 format: category table contains { category_1: 1, category_36: 1, ... }
                    "category" => {
                        parse_category_flat_table(cur, pool, &mut meta);
                    }
                    // V1/V2 format: categories table contains { "0": { "category": N }, ... }
                    "categories" => {
                        parse_categories_table(cur, pool, &mut meta);
                    }
                    _ => { skip_kv_object(cur, pool); }
                }
            }
            0x04 | 0x07 => { skip(cur, 8).ok()?; }
            0x05 => { skip_wstring(cur); }
            0x06 => { skip(cur, 3).ok()?; }
            _ => break,
        }
    }
    // Return meta if we found anything useful (name, categories, or images).
    // Previously we required name — but that dropped apps that have categories but a missing name key.
    if meta.name.is_some() || !meta.categories.is_empty() || meta.icon_hash.is_some() {
        Some(meta)
    } else {
        None
    }
}

/// Parses the `categories` table inside the `common` section of appinfo.vdf.
///
/// Structure:
/// ```text
/// categories {
///   "0" { "category" 2 }
///   "1" { "category" 1 }
///   ...
/// }
/// ```
/// Extracts the integer category IDs and stores them in `meta.categories`.
fn parse_categories_table(cur: &mut Cursor<&[u8]>, pool: Option<&[String]>, meta: &mut AppInfoMeta) {
    loop {
        let Ok(type_byte) = read_u8(cur) else { break };
        if type_byte == 0x08 { break; }
        let Ok(_entry_key) = read_key(cur, pool) else { break };
        if type_byte != 0x00 {
            // Not a sub-table — skip the value.
            match type_byte {
                0x01 => { let _ = read_cstring(cur); }
                0x02 | 0x03 | 0x0A => { let _ = skip(cur, 4); }
                0x04 | 0x07 => { let _ = skip(cur, 8); }
                0x05 => skip_wstring(cur),
                0x06 => { let _ = skip(cur, 3); }
                _ => break,
            }
            continue;
        }
        // Sub-table: look for { "category": <int32> }
        let mut found_id: Option<u32> = None;
        loop {
            let Ok(inner_type) = read_u8(cur) else { break };
            if inner_type == 0x08 { break; }
            let Ok(inner_key) = read_key(cur, pool) else { break };
            match inner_type {
                0x02 | 0x0A => {
                    if let Ok(val) = read_i32(cur) {
                        if inner_key.eq_ignore_ascii_case("category") {
                            found_id = Some(val as u32);
                        }
                    }
                }
                0x01 => { let _ = read_cstring(cur); }
                0x03 => { let _ = skip(cur, 4); }
                0x04 | 0x07 => { let _ = skip(cur, 8); }
                0x05 => skip_wstring(cur),
                0x06 => { let _ = skip(cur, 3); }
                0x00 => skip_kv_object(cur, pool),
                _ => break,
            }
        }
        if let Some(id) = found_id {
            meta.categories.push(id);
        }
    }
}

/// Parses the V3 `category` table inside the `common` section of appinfo.vdf.
///
/// Structure (V3 flat format):
/// ```text
/// category {
///   category_1  1
///   category_36 1
///   category_9  1
///   ...
/// }
/// ```
/// Each key is `category_<id>` and the value is always 1 (presence flag).
/// Extracts the numeric IDs from the key names and stores them in `meta.categories`.
fn parse_category_flat_table(cur: &mut Cursor<&[u8]>, pool: Option<&[String]>, meta: &mut AppInfoMeta) {
    loop {
        let Ok(type_byte) = read_u8(cur) else { break };
        if type_byte == 0x08 { break; }
        let Ok(key) = read_key(cur, pool) else { break };
        match type_byte {
            0x02 | 0x0A => {
                // Value is always 1 — presence flag. Extract ID from key name.
                let _ = read_i32(cur);
                let key_lower = key.to_ascii_lowercase();
                if key_lower.starts_with("category_") {
                    if let Ok(id) = key_lower["category_".len()..].parse::<u32>() {
                        meta.categories.push(id);
                    }
                }
            }
            0x01 => { let _ = read_cstring(cur); }
            0x03 => { let _ = skip(cur, 4); }
            0x04 | 0x07 => { let _ = skip(cur, 8); }
            0x05 => skip_wstring(cur),
            0x06 => { let _ = skip(cur, 3); }
            0x00 => skip_kv_object(cur, pool),
            _ => break,
        }
    }
}

/// Reads a single-level locale table `{ english: "value", ... }` and returns
/// the value for `target_locale` (or None). Consumes the full table.
fn read_locale_string(cur: &mut Cursor<&[u8]>, pool: Option<&[String]>, target: &str) -> Option<String> {
    let mut result = None;
    loop {
        let Ok(type_byte) = read_u8(cur) else { break };
        if type_byte == 0x08 { break; }
        let Ok(key) = read_key(cur, pool) else { break };
        match type_byte {
            0x01 => {
                let Ok(val) = read_cstring(cur) else { break };
                if key.eq_ignore_ascii_case(target) && !val.is_empty() {
                    result = Some(val);
                }
            }
            0x02 | 0x03 | 0x0A => { let _ = skip(cur, 4); }
            0x04 | 0x07 => { let _ = skip(cur, 8); }
            0x00 => skip_kv_object(cur, pool),
            0x05 => skip_wstring(cur),
            0x06 => { let _ = skip(cur, 3); }
            _ => break,
        }
    }
    result
}

/// Parses `library_assets_full` table, extracting `image.english` hash paths
/// for library_capsule, library_hero, library_logo, and library_header.
///
/// Structure: `library_assets_full → {asset_name} → image → { english: "{hash}/{file}", ... }`
fn parse_library_assets_full(cur: &mut Cursor<&[u8]>, pool: Option<&[String]>, meta: &mut AppInfoMeta) {
    loop {
        let Ok(type_byte) = read_u8(cur) else { break };
        if type_byte == 0x08 { break; }
        let Ok(asset_key) = read_key(cur, pool) else { break };
        if type_byte != 0x00 {
            // Not a table — skip the value.
            match type_byte {
                0x01 => { let _ = read_cstring(cur); }
                0x02 | 0x03 | 0x0A => { let _ = skip(cur, 4); }
                0x04 | 0x07 => { let _ = skip(cur, 8); }
                0x05 => skip_wstring(cur),
                0x06 => { let _ = skip(cur, 3); }
                _ => break,
            }
            continue;
        }
        // It's a table. Look for "image" sub-table.
        let hash = read_asset_image_locale(cur, pool, "english");
        match asset_key.to_ascii_lowercase().as_str() {
            "library_capsule" => { if meta.library_capsule_hash_path.is_none() { meta.library_capsule_hash_path = hash; } }
            "library_hero"    => { if meta.library_hero_hash_path.is_none()    { meta.library_hero_hash_path = hash;    } }
            "library_logo"    => { if meta.library_logo_hash_path.is_none()    { meta.library_logo_hash_path = hash;    } }
            "library_header"  => { if meta.library_header_hash_path.is_none()  { meta.library_header_hash_path = hash;  } }
            _ => {}
        }
    }
}

/// Reads an asset sub-table `{ image: { english: "...", .. }, image2x: { .. }, .. }`
/// and returns the value at `image.{locale}`.
fn read_asset_image_locale(cur: &mut Cursor<&[u8]>, pool: Option<&[String]>, locale: &str) -> Option<String> {
    let mut result = None;
    loop {
        let Ok(type_byte) = read_u8(cur) else { break };
        if type_byte == 0x08 { break; }
        let Ok(key) = read_key(cur, pool) else { break };
        if type_byte == 0x00 && key.eq_ignore_ascii_case("image") {
            result = read_locale_string(cur, pool, locale);
        } else if type_byte == 0x00 {
            skip_kv_object(cur, pool);
        } else {
            match type_byte {
                0x01 => { let _ = read_cstring(cur); }
                0x02 | 0x03 | 0x0A => { let _ = skip(cur, 4); }
                0x04 | 0x07 => { let _ = skip(cur, 8); }
                0x05 => skip_wstring(cur),
                0x06 => { let _ = skip(cur, 3); }
                _ => break,
            }
        }
    }
    result
}

/// Converts an oslist string ("windows,mac,linux") into a bitmask.
/// 1 = Windows, 2 = Mac, 4 = Linux.
fn parse_oslist(oslist: &str) -> u32 {
    let mut bits = 0u32;
    for part in oslist.split(',') {
        match part.trim() {
            "windows" => bits |= 1,
            "macos" | "osx" => bits |= 2,
            "linux" => bits |= 4,
            _ => {}
        }
    }
    bits
}

fn skip_kv_object(cur: &mut Cursor<&[u8]>, pool: Option<&[String]>) {
    loop {
        let Ok(type_byte) = read_u8(cur) else { return };
        if type_byte == 0x08 { return; }
        let Ok(_) = read_key(cur, pool) else { return };
        match type_byte {
            0x00 => skip_kv_object(cur, pool),
            0x01 => { let _ = read_cstring(cur); }
            0x02 | 0x03 | 0x0A => { let _ = skip(cur, 4); }
            0x04 | 0x07 => { let _ = skip(cur, 8); }
            0x05 => { skip_wstring(cur); }
            0x06 => { let _ = skip(cur, 3); }
            _ => return,
        }
    }
}

// ─── Library folder discovery ─────────────────────────────────────────────────

fn find_library_paths(steam_path: &Path) -> Vec<PathBuf> {
    let mut paths = vec![steam_path.to_path_buf()];

    // Steam moved libraryfolders.vdf to config/ in newer versions; check both.
    let candidates = [
        steam_path.join("steamapps").join("libraryfolders.vdf"),
        steam_path.join("config").join("libraryfolders.vdf"),
    ];

    for vdf_path in &candidates {
        if !vdf_path.exists() { continue; }
        let Ok(content) = fs::read_to_string(vdf_path) else { continue };
        for line in content.lines() {
            let t = line.trim();
            if t.starts_with("\"path\"") {
                if let Some(val) = vdf_value(t) {
                    let p = PathBuf::from(val.replace("\\\\", "\\"));
                    if p.exists() && !paths.contains(&p) {
                        paths.push(p);
                    }
                }
            }
        }
    }
    paths
}

// ─── ACF manifest parsing ─────────────────────────────────────────────────────

fn read_acf_manifests(
    manifests_dir: &Path,
    library_root: &Path,
    installed: &mut HashMap<u64, SteamGame>,
    app_names: &HashMap<u64, String>,
) {
    let Ok(entries) = fs::read_dir(manifests_dir) else { return };
    for entry in entries.flatten() {
        let path = entry.path();
        let fname = entry.file_name();
        let fname = fname.to_string_lossy();
        if !fname.starts_with("appmanifest_") || !fname.ends_with(".acf") { continue; }
        let Ok(content) = fs::read_to_string(&path) else { continue };
        if let Some(game) = parse_acf(&content, library_root, app_names) {
            installed.insert(game.app_id, game);
        }
    }
}

fn parse_acf(content: &str, library_root: &Path, app_names: &HashMap<u64, String>) -> Option<SteamGame> {
    let mut app_id: Option<u64> = None;
    let mut name: Option<String> = None;
    let mut install_dir: Option<String> = None;
    let mut size_on_disk: u64 = 0;
    let mut bytes_downloaded: u64 = 0;

    for line in content.lines() {
        let t = line.trim();
        match vdf_key(t) {
            Some("appid")           => { app_id = vdf_value(t).and_then(|v| v.parse().ok()); }
            Some("name")            => { name = vdf_value(t).map(|s| s.to_string()); }
            Some("installdir")      => { install_dir = vdf_value(t).map(|s| s.to_string()); }
            Some("SizeOnDisk")      => { size_on_disk = vdf_value(t).and_then(|v| v.parse().ok()).unwrap_or(0); }
            Some("BytesDownloaded") => { bytes_downloaded = vdf_value(t).and_then(|v| v.parse().ok()).unwrap_or(0); }
            _ => {}
        }
    }

    let app_id = app_id?;
    // Prefer appinfo name (more accurate) over ACF name.
    let name = app_names.get(&app_id).cloned()
        .or(name)
        .unwrap_or_else(|| format!("App {}", app_id));

    let install_path = install_dir.map(|d| {
        library_root.join("steamapps").join("common").join(&d).display().to_string()
    });

    Some(SteamGame {
        app_id,
        name,
        install_path,
        is_installed: true,
        collections: Vec::new(),
        size_on_disk,
        bytes_downloaded,
        // icon_url is filled in after the fact from app_meta in the scan() loop.
        icon_url: String::new(),
        header_image: cdn_header(app_id),
        library_image: cdn_library(app_id),
        library_hero: cdn_hero(app_id),
        library_logo: cdn_logo(app_id),
        last_played: 0,
        playtime_minutes: 0,
        developer: None,
        publisher: None,
        release_date: 0,
        os_list: 0,
        // categories and app_type filled in after the fact from app_meta in the scan() loop.
        categories: Vec::new(),
        app_type: String::new(),
    })
}

// ─── sharedconfig.vdf ─────────────────────────────────────────────────────────

/// Parses a VDF config file (sharedconfig or localconfig) to collect owned app IDs,
/// per-app last-played times, and total playtime minutes from any `"apps"` section.
///
/// Works for both:
///   sharedconfig: `UserRoamingConfigStore > Software > Valve > Steam > Apps > <id>`
///   localconfig:  `UserLocalConfigStore > Software > Valve > Steam > apps > <id>`
fn parse_sharedconfig(content: &str, ids: &mut HashSet<u64>, last_played: &mut HashMap<u64, u64>) {
    parse_sharedconfig_full(content, ids, last_played, &mut HashMap::new());
}

/// Extended version of `parse_sharedconfig` that also collects playtime minutes.
fn parse_sharedconfig_full(
    content: &str,
    ids: &mut HashSet<u64>,
    last_played: &mut HashMap<u64, u64>,
    playtime: &mut HashMap<u64, u64>,
) {
    let mut depth: i32 = 0;
    // apps_depth = the depth of the `{` block directly inside "apps".
    // i.e. app IDs appear as keys at this depth.
    let mut apps_depth: i32 = -1;
    // app_depth = the depth of the `{` block inside a specific app ID.
    let mut app_depth: i32 = -1;
    let mut current_app_id: Option<u64> = None;

    for line in content.lines() {
        let t = line.trim();
        if t == "{" {
            depth += 1;
            // If we just saw an app ID key, its block opens here.
            if apps_depth >= 0 && depth == apps_depth + 1 && current_app_id.is_some() {
                app_depth = depth;
            }
            continue;
        }
        if t == "}" {
            if app_depth >= 0 && depth == app_depth {
                app_depth = -1;
                current_app_id = None;
            }
            if apps_depth >= 0 && depth == apps_depth {
                apps_depth = -1;
            }
            depth -= 1;
            continue;
        }

        // Detect the "apps" section opening.
        if apps_depth < 0 {
            if let Some(k) = vdf_key_only(t) {
                if k.eq_ignore_ascii_case("apps") {
                    // apps_depth will be depth+1 once the { opens on the next line.
                    apps_depth = depth + 1;
                }
            }
            continue;
        }

        // Inside the apps section: keys at apps_depth are app IDs.
        if app_depth < 0 && depth == apps_depth {
            if let Some(k) = vdf_key_only(t) {
                if let Ok(id) = k.parse::<u64>() {
                    current_app_id = Some(id);
                    ids.insert(id);
                }
            }
            continue;
        }

        // Inside a specific app's block: look for LastPlayed and Playtime.
        if let Some(id) = current_app_id {
            if let Some((k, v)) = vdf_pair(t) {
                if k.eq_ignore_ascii_case("lastplayed") {
                    if let Ok(ts) = v.parse::<u64>() {
                        last_played.entry(id).and_modify(|e| { if ts > *e { *e = ts; } }).or_insert(ts);
                    }
                } else if k.eq_ignore_ascii_case("playtime") {
                    // Playtime is stored in minutes.
                    if let Ok(mins) = v.parse::<u64>() {
                        playtime.entry(id).and_modify(|e| { if mins > *e { *e = mins; } }).or_insert(mins);
                    }
                }
            }
        }
    }
}

// ─── localconfig.vdf ─────────────────────────────────────────────────────────

/// Parses `localconfig.vdf` for:
/// - Steam Collections (under `UserLocalConfigStore` > `WebStorage`)
/// - Per-app last-played times (under `...` > `Apps` > `<id>` > `LastPlayed`)
/// - Additional owned app IDs.
///
/// Modern Steam (2019+) stores collections as JSON-encoded values with keys like
/// `"user-collections-<hex>"`. Each JSON object has `{ "id", "name", "added": [...] }`.
fn parse_localconfig(
    content: &str,
    ids: &mut HashSet<u64>,
    collection_map: &mut HashMap<u64, Vec<String>>,
    collection_names: &mut Vec<String>,
    last_played: &mut HashMap<u64, u64>,
    playtime: &mut HashMap<u64, u64>,
    hidden_ids: &mut HashSet<u64>,
) {
    // Phase 1: collect collections from WebStorage key-value pairs.
    // These appear as single-line pairs anywhere in the file:
    //   "user-collections-xxxxxxxx"  "{\"id\":\"uc-...\",\"name\":\"...\",\"added\":[...]}"
    for line in content.lines() {
        let t = line.trim();
        let Some((k, v)) = vdf_pair(t) else { continue };
        if !k.contains("user-collections") { continue; }
        if let Some(col) = parse_collection_json(v) {
            if is_hidden_collection(&col.id, &col.name) {
                // Track hidden app IDs so they can be excluded from the final list.
                for app_id in &col.added { hidden_ids.insert(*app_id); }
                continue;
            }
            let display = normalize_collection_name(&col.id, &col.name);
            for app_id in &col.added {
                collection_map.entry(*app_id).or_default().push(display.clone());
                ids.insert(*app_id);
            }
            if !collection_names.contains(&display) {
                collection_names.push(display);
            }
        }
    }

    // Phase 2: collect last-played times and playtime from the Apps section.
    // Path: UserLocalConfigStore > Software > Valve > Steam > Apps > <id> > LastPlayed / Playtime
    parse_sharedconfig_full(content, ids, last_played, playtime);
}

/// Parses `cloud-storage-namespace-1.json` for Steam Collections.
///
/// Since ~2022, Steam stores all user-created collections in this file instead of
/// `localconfig.vdf`. The file is a JSON array of `[key, entry]` pairs where each
/// entry's `value` field is a double-encoded JSON string containing collection data.
///
/// # Format
/// ```json
/// [
///   ["user-collections.uc-Abc123", {
///     "key": "user-collections.uc-Abc123",
///     "timestamp": 1700000000,
///     "value": "{\"id\":\"uc-Abc123\",\"name\":\"My Games\",\"added\":[123,456],\"removed\":[]}"
///   }],
///   ["user-collections.uc-Dead", {"key":"...","is_deleted":true}]
/// ]
/// ```
fn parse_cloud_collections(
    content: &str,
    ids: &mut HashSet<u64>,
    collection_map: &mut HashMap<u64, Vec<String>>,
    collection_names: &mut Vec<String>,
    hidden_ids: &mut HashSet<u64>,
) {
    // Deserialize as array of [key, object] pairs.
    let Ok(entries) = serde_json::from_str::<Vec<(String, serde_json::Value)>>(content) else {
        return;
    };

    for (key, entry) in entries {
        // Only process collection entries.
        if !key.starts_with("user-collections.") { continue; }

        // Skip deleted entries.
        if entry.get("is_deleted").and_then(|v| v.as_bool()).unwrap_or(false) { continue; }

        // The collection data is double-encoded: entry["value"] is a JSON string.
        let Some(value_str) = entry.get("value").and_then(|v| v.as_str()) else { continue };
        let Some(col) = parse_collection_json(value_str) else { continue };

        if is_hidden_collection(&col.id, &col.name) {
            // Track hidden app IDs so they can be excluded from the final list.
            let removed: HashSet<u64> = col.removed.iter().cloned().collect();
            for app_id in col.added.iter().filter(|id| !removed.contains(id)) {
                hidden_ids.insert(*app_id);
            }
            continue;
        }

        let display = normalize_collection_name(&col.id, &col.name);

        // Build the set difference: added - removed.
        let removed: HashSet<u64> = col.removed.iter().cloned().collect();
        for app_id in col.added.iter().filter(|id| !removed.contains(id)) {
            let entry = collection_map.entry(*app_id).or_default();
            if !entry.contains(&display) {
                entry.push(display.clone());
            }
            ids.insert(*app_id);
        }

        if !collection_names.contains(&display) {
            collection_names.push(display);
        }
    }
}

#[derive(Deserialize)]
struct CollectionJson {
    id: String,
    name: String,
    #[serde(default)]
    added: Vec<serde_json::Value>,
    #[serde(default)]
    removed: Vec<serde_json::Value>,
}

struct ParsedCollection {
    id: String,
    name: String,
    added: Vec<u64>,
    removed: Vec<u64>,
}

fn parse_collection_json(value: &str) -> Option<ParsedCollection> {
    // Value may be raw JSON or have escaped quotes because it's inside a VDF string.
    // Try raw first, then unescape backslash-quotes.
    let try_parse = |s: &str| -> Option<ParsedCollection> {
        let col: CollectionJson = serde_json::from_str(s).ok()?;
        let parse_ids = |list: &[serde_json::Value]| -> Vec<u64> {
            list.iter()
                .filter_map(|v| v.as_u64().or_else(|| v.as_str()?.parse().ok()))
                .collect()
        };
        let added = parse_ids(&col.added);
        let removed = parse_ids(&col.removed);
        Some(ParsedCollection { id: col.id, name: col.name, added, removed })
    };

    if let Some(r) = try_parse(value) { return Some(r); }

    // Unescape \" → "
    let unescaped = value.replace("\\\"", "\"");
    if let Some(r) = try_parse(&unescaped) { return Some(r); }

    // Try base64 decode.
    use base64::Engine as _;
    if let Ok(bytes) = base64::engine::general_purpose::STANDARD.decode(value) {
        if let Ok(s) = std::str::from_utf8(&bytes) {
            if let Some(r) = try_parse(s) { return Some(r); }
        }
    }

    None
}

fn normalize_collection_name(id: &str, name: &str) -> String {
    if id.to_uppercase().contains("FAVORITES") || name.eq_ignore_ascii_case("Favorites") {
        "Favorites".to_string()
    } else {
        name.to_string()
    }
}

/// Returns true if a collection ID or name represents Steam's built-in "Hidden" collection.
///
/// Steam uses `uc-hidden-games` as the system collection ID for hidden games.
/// The display name varies by locale (e.g. "Hidden", "已隐藏").
pub fn is_hidden_collection(id: &str, name: &str) -> bool {
    id.to_lowercase().contains("hidden") || name == "已隐藏"
}

// ─── loginusers.vdf ──────────────────────────────────────────────────────────

/// Parses `loginusers.vdf` and returns all Steam accounts.
///
/// VDF structure:
/// ```text
/// "users" {
///     "76561198000000000" {
///         "AccountName"  "username"
///         "PersonaName"  "Display Name"
///         "MostRecent"   "1"
///         ...
///     }
/// }
/// ```
pub fn parse_loginusers(content: &str) -> Vec<SteamUser> {
    let mut users: Vec<SteamUser> = Vec::new();
    let mut current_id: Option<String> = None;
    let mut current: HashMap<String, String> = HashMap::new();
    let mut depth: i32 = 0;
    let mut user_depth: i32 = -1;

    for line in content.lines() {
        let t = line.trim();
        if t == "{" {
            depth += 1;
            continue;
        }
        if t == "}" {
            // Closing a user block.
            if depth == user_depth {
                if let Some(ref id) = current_id {
                    users.push(build_steam_user(id, &current));
                }
                current_id = None;
                current.clear();
                user_depth = -1;
            }
            depth -= 1;
            continue;
        }

        if depth == 1 {
            // Top-level key = SteamID64.
            if let Some(k) = vdf_key_only(t) {
                if k.chars().all(|c| c.is_ascii_digit()) {
                    current_id = Some(k.to_string());
                    user_depth = depth + 1;
                }
            }
        } else if depth == user_depth {
            // Key-value pairs inside a user block.
            if let Some((k, v)) = vdf_pair(t) {
                current.insert(k.to_string(), v.to_string());
            }
        }
    }

    // Sort: most-recent first, then by persona name.
    users.sort_by(|a, b| {
        b.most_recent.cmp(&a.most_recent)
            .then(a.persona_name.to_lowercase().cmp(&b.persona_name.to_lowercase()))
    });

    users
}

fn build_steam_user(steam_id: &str, fields: &HashMap<String, String>) -> SteamUser {
    let account_name = fields.get("AccountName").cloned().unwrap_or_default();
    let persona_name = fields.get("PersonaName").cloned().unwrap_or_else(|| account_name.clone());
    let remember_password = fields.get("RememberPassword").map(|v| v == "1").unwrap_or(false);
    let most_recent = fields.get("MostRecent").map(|v| v == "1").unwrap_or(false);
    let timestamp = fields.get("Timestamp").and_then(|v| v.parse().ok()).unwrap_or(0);
    let wants_offline_mode = fields.get("WantsOfflineMode").map(|v| v == "1").unwrap_or(false);

    // Steam avatar URL uses the last 3 hex digits of the SteamID as path prefix
    // (this is a simplification; full avatar requires a Web API call, but we can
    // use the profile page URL which Steam resolves correctly).
    let avatar_url = format!("https://avatars.steamstatic.com/steam_avatars/default_avatar.jpg");

    SteamUser {
        steam_id: steam_id.to_string(),
        account_name,
        persona_name,
        remember_password,
        most_recent,
        timestamp,
        wants_offline_mode,
        avatar_url,
    }
}

// ─── CDN helpers ──────────────────────────────────────────────────────────────

// ─── CDN URL construction ──────────────────────────────────────────────────────
//
// Steam uses two CDN schemes:
//
// 1. Legacy flat path (older games):
//    https://cdn.cloudflare.steamstatic.com/steam/apps/{id}/{filename}
//
// 2. Content-addressed path (newer games, ~2023+):
//    https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/{id}/{sha1}/{filename}
//    The `{sha1}/{filename}` value is stored in appinfo.vdf under
//    common → library_assets_full → {asset} → image → english.
//
// For each asset we try the content-addressed URL first (if we have the hash path from
// appinfo.vdf), and fall back to the legacy flat URL. The legacy URLs 404 for new games
// except for library_hero.jpg which Steam still publishes at the flat path.

/// Akamai base for content-addressed store assets.
const AKAMAI_STORE: &str = "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps";
/// Cloudflare base for legacy flat-path assets.
const CF_STEAM: &str = "https://cdn.cloudflare.steamstatic.com/steam/apps";

/// Returns the best available header image URL (920×430) for an app.
/// Uses hash path from appinfo.vdf if available; falls back to legacy CDN.
pub fn cdn_header(app_id: u64) -> String {
    format!("{}/{}/header.jpg", CF_STEAM, app_id)
}
pub fn cdn_header_hashed(app_id: u64, hash_path: Option<&str>) -> String {
    match hash_path {
        Some(p) => format!("{}/{}/{}", AKAMAI_STORE, app_id, p),
        None    => cdn_header(app_id),
    }
}

/// Returns the best available library capsule URL (600×900) for an app.
pub fn cdn_library(app_id: u64) -> String {
    format!("{}/{}/library_600x900.jpg", CF_STEAM, app_id)
}
pub fn cdn_library_hashed(app_id: u64, hash_path: Option<&str>) -> String {
    match hash_path {
        Some(p) => format!("{}/{}/{}", AKAMAI_STORE, app_id, p),
        None    => cdn_library(app_id),
    }
}

/// Returns the library hero URL (3840×1240) for an app.
/// library_hero.jpg exists at the flat CDN path for both old and new games.
pub fn cdn_hero(app_id: u64) -> String {
    format!("{}/{}/library_hero.jpg", CF_STEAM, app_id)
}
pub fn cdn_hero_hashed(app_id: u64, hash_path: Option<&str>) -> String {
    match hash_path {
        Some(p) => format!("{}/{}/{}", AKAMAI_STORE, app_id, p),
        None    => cdn_hero(app_id),
    }
}

/// Returns the library logo URL (transparent PNG, up to 1280×720) for an app.
pub fn cdn_logo(app_id: u64) -> String {
    format!("{}/{}/logo.png", CF_STEAM, app_id)
}
pub fn cdn_logo_hashed(app_id: u64, hash_path: Option<&str>) -> String {
    match hash_path {
        Some(p) => format!("{}/{}/{}", AKAMAI_STORE, app_id, p),
        None    => cdn_logo(app_id),
    }
}

/// Returns the library header (wide banner, 920×430) URL for an app.
pub fn cdn_library_header_hashed(app_id: u64, hash_path: Option<&str>) -> String {
    match hash_path {
        Some(p) => format!("{}/{}/{}", AKAMAI_STORE, app_id, p),
        None    => cdn_header(app_id),
    }
}

/// Resolves an image to a local `librarycache/` path if cached by Steam, otherwise
/// returns the CDN URL as a fallback.
///
/// Steam stores all library artwork under `<steam>/appcache/librarycache/<app_id>/`.
/// The layout varies: files may be directly in the app folder or nested inside one or
/// more SHA1 hash subfolders. We do a full recursive walk and match by filename only,
/// trying each candidate name in order and returning the first match found.
///
/// # Arguments
/// * `app_cache` - Path to `<steam>/appcache/librarycache/<app_id>/`
/// * `filenames` - One or more filenames to search for, tried in order
/// * `cdn_url`   - CDN URL to return when no local file is found
fn local_or_cdn(app_cache: &Path, filenames: &[&str], cdn_url: String) -> String {
    // Collect all files under app_cache recursively, ignoring errors.
    let all_files = collect_files_recursive(app_cache);
    for &filename in filenames {
        if let Some(path) = all_files.iter().find(|p| {
            p.file_name().and_then(|n| n.to_str()) == Some(filename)
        }) {
            return path.display().to_string();
        }
    }
    cdn_url
}

/// Recursively collects all file paths under `dir`, one level at a time.
/// Ignores unreadable directories silently.
fn collect_files_recursive(dir: &Path) -> Vec<std::path::PathBuf> {
    let mut files = Vec::new();
    let Ok(entries) = std::fs::read_dir(dir) else { return files };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_file() {
            files.push(path);
        } else if path.is_dir() {
            files.extend(collect_files_recursive(&path));
        }
    }
    files
}

/// Returns the Steam community icon URL (~184×184 JPG) for an app.
///
/// The icon_hash is the 40-char hex from `common → "icon"` in appinfo.vdf.
/// Community icons are NOT content-addressed — they work for all games.
pub fn cdn_community_icon(app_id: u64, icon_hash: &str) -> String {
    format!(
        "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/{}/{}.jpg",
        app_id, icon_hash
    )
}

// ─── User directory helpers ───────────────────────────────────────────────────

fn find_user_dirs(userdata_dir: &Path) -> Vec<PathBuf> {
    if !userdata_dir.exists() { return Vec::new(); }
    let Ok(entries) = fs::read_dir(userdata_dir) else { return Vec::new() };
    entries.flatten().filter_map(|e| {
        let p = e.path();
        if !p.is_dir() { return None; }
        let name = e.file_name();
        let name = name.to_string_lossy();
        if name.chars().all(|c| c.is_ascii_digit()) && name != "0" { Some(p) } else { None }
    }).collect()
}

// ─── Binary IO helpers ────────────────────────────────────────────────────────

fn read_u8(cur: &mut Cursor<&[u8]>) -> Result<u8, String> {
    let mut buf = [0u8; 1];
    cur.read_exact(&mut buf).map_err(|e| e.to_string())?;
    Ok(buf[0])
}

fn read_u32(cur: &mut Cursor<&[u8]>) -> Result<u32, String> {
    let mut buf = [0u8; 4];
    cur.read_exact(&mut buf).map_err(|e| e.to_string())?;
    Ok(u32::from_le_bytes(buf))
}

fn read_i32(cur: &mut Cursor<&[u8]>) -> Result<i32, String> {
    let mut buf = [0u8; 4];
    cur.read_exact(&mut buf).map_err(|e| e.to_string())?;
    Ok(i32::from_le_bytes(buf))
}

fn read_i64(cur: &mut Cursor<&[u8]>) -> Result<i64, String> {
    let mut buf = [0u8; 8];
    cur.read_exact(&mut buf).map_err(|e| e.to_string())?;
    Ok(i64::from_le_bytes(buf))
}

fn skip(cur: &mut Cursor<&[u8]>, n: usize) -> Result<(), String> {
    let pos = cur.position();
    cur.set_position(pos + n as u64);
    Ok(())
}

/// Skips a null-terminated UTF-16LE wide string (reads pairs of bytes until 0x0000).
fn skip_wstring(cur: &mut Cursor<&[u8]>) {
    loop {
        let mut buf = [0u8; 2];
        if cur.read_exact(&mut buf).is_err() { break; }
        if buf == [0, 0] { break; }
    }
}

/// Reads a null-terminated UTF-8 string from the cursor.
fn read_cstring(cur: &mut Cursor<&[u8]>) -> Result<String, String> {
    let mut bytes = Vec::new();
    loop {
        let b = read_u8(cur)?;
        if b == 0 { break; }
        bytes.push(b);
    }
    String::from_utf8(bytes).map_err(|_| "Invalid UTF-8 in cstring".to_string())
}

// ─── VDF text helpers ─────────────────────────────────────────────────────────

/// Extracts the value from a VDF line `"key"\t"value"` or `"key"  "value"`.
fn vdf_value(line: &str) -> Option<&str> {
    // Format: "key"<whitespace>"value"
    // Split on '"' gives: ["", key, whitespace, value, ""]
    let mut parts = line.splitn(5, '"');
    parts.nth(3)
}

/// Extracts the key from a VDF line `"key"` or `"key"\t"value"`.
fn vdf_key_only(line: &str) -> Option<&str> {
    let mut parts = line.splitn(3, '"');
    parts.nth(1)
}

/// Extracts the key from a line that starts with `"key"` (ignores value).
/// Returns None if the line has no quoted key.
fn vdf_key(line: &str) -> Option<&str> {
    vdf_key_only(line)
}

/// Extracts (key, value) from a VDF line `"key"\t"value"`.
/// Returns None if either part is missing.
fn vdf_pair(line: &str) -> Option<(&str, &str)> {
    let mut parts = line.splitn(5, '"');
    let key = parts.nth(1)?;
    let value = parts.nth(1)?;
    if value.is_empty() && !line.contains('"'.to_string().repeat(2).as_str()) {
        return None;
    }
    Some((key, value))
}
