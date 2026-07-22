/**
 * Tauri command wrappers — Steam domain.
 */
import { invoke } from "@tauri-apps/api/core";
import {
  ImportGameInput,
  ImportResult,
  SyncResult,
  SteamScanResult,
  SteamLibItem,
  SteamUser,
  SteamAchievement,
  SteamScreenshot,
  SteamCloudFile,
  AchievementEdit,
} from "@/types/steam";

/** Per-game DB info (item_id + is_favorite) for all imported Steam games. */
export interface SteamGameDbInfo {
  item_id: string;
  is_favorite: boolean;
}

/**
 * Scans the local Steam installation and returns all games with collection data.
 * Read-only — does not modify the YukiG database.
 * @returns Full scan result with games and collection names
 * @throws {string} If Steam is not installed or the scan fails
 */
export async function steamScan(): Promise<SteamScanResult> {
  return invoke("steam_scan");
}

/**
 * Syncs the full Steam library into YukiG — adds new games, updates existing
 * ones, removes games no longer in the library. Safe to call on startup or demand.
 * @returns Summary of added, updated, removed counts and any per-game errors
 * @throws {string} If Steam is not found or the DB cannot be accessed
 */
export async function steamSync(): Promise<SyncResult> {
  return invoke("steam_sync");
}

/**
 * Reads the imported Steam library from the DB — the Steam page's data source.
 * Each game is a unified item (stable id) with its Steam cover art, install /
 * playtime facts, and the Steam Collections it belongs to.
 * @returns All imported Steam games, ordered by name
 * @throws {string} If the database cannot be accessed
 */
export async function steamGetLibrary(): Promise<SteamLibItem[]> {
  return invoke("steam_get_library");
}

/**
 * Imports a list of Steam games into YukiG.
 * Skips any games whose app ID is already tracked in the steam_imports table.
 * @param games - Array of games to import
 * @returns Summary of imported, skipped, and any per-game errors
 * @throws {string} On fatal database failure
 */
export async function steamImport(games: ImportGameInput[]): Promise<ImportResult> {
  return invoke("steam_import", { games });
}

/**
 * Returns the list of Steam app IDs already imported into YukiG.
 * @returns Array of app ID numbers
 * @throws {string} If the database query fails
 */
export async function steamGetImportedIds(): Promise<number[]> {
  return invoke("steam_get_imported_ids");
}

/**
 * Returns the Steam app id currently running (0 if none).
 * Seeds "now playing" state on the Steam page; live updates arrive via the
 * `steam-running-changed` event.
 * @throws {string} If the query fails
 */
export async function steamGetRunningAppId(): Promise<number> {
  return invoke("steam_get_running_appid");
}

/**
 * Returns all Steam accounts parsed from loginusers.vdf.
 * Most-recently-used account is listed first.
 * @throws {string} If Steam is not found or loginusers.vdf cannot be read
 */
export async function steamGetUsers(): Promise<SteamUser[]> {
  return invoke("steam_get_users");
}

/**
 * Switches the active Steam account and restarts Steam.
 * @param accountName - The AccountName (login username) to switch to
 * @throws {string} If the switch fails
 */
export async function steamSwitchAccount(accountName: string): Promise<void> {
  return invoke("steam_switch_account", { accountName });
}

/**
 * Launches a Steam game via the steam://rungameid protocol.
 * @param appId - The Steam application ID
 * @throws {string} If the shell open fails
 */
export async function steamLaunchGame(appId: number): Promise<void> {
  return invoke("steam_launch_game", { appId });
}

/**
 * Triggers the Steam client to begin installing a game via steam://install/<appid>.
 * @throws {string} If the shell open fails
 */
export async function steamInstallGame(appId: number): Promise<void> {
  return invoke("steam_install_game", { appId });
}

/**
 * Opens the game's hub page inside the Steam desktop application.
 * @throws {string} If the shell open fails
 */
export async function steamOpenInApp(appId: number): Promise<void> {
  return invoke("steam_open_in_app", { appId });
}

/**
 * Opens the game's page on the Steam web store in the system browser.
 * @throws {string} If the shell open fails
 */
export async function steamOpenInStore(appId: number): Promise<void> {
  return invoke("steam_open_in_store", { appId });
}

/**
 * Returns a map of app_id → {item_id, is_favorite} for all Steam games in the DB.
 * @throws {string} If the database query fails
 */
export async function steamGetGameDbInfo(): Promise<Record<number, SteamGameDbInfo>> {
  return invoke("steam_get_game_db_info");
}

/**
 * Returns achievement unlock status for a game from local Steam userdata files.
 * Returns an empty array if no achievement data is found.
 * @throws {string} If Steam path cannot be detected
 */
export async function steamGetAchievements(appId: number): Promise<SteamAchievement[]> {
  return invoke("steam_get_achievements", { appId });
}

/**
 * Returns local screenshots for a game from the Steam userdata directory.
 * Returns an empty array if no screenshots are found.
 * @throws {string} If Steam path cannot be detected
 */
export async function steamGetScreenshots(appId: number): Promise<SteamScreenshot[]> {
  return invoke("steam_get_screenshots", { appId });
}

/**
 * Returns cloud save files for a game from the Steam userdata remote directory.
 * Returns an empty array if no cloud saves are found.
 * @throws {string} If Steam path cannot be detected
 */
export async function steamGetCloudSaves(appId: number): Promise<SteamCloudFile[]> {
  return invoke("steam_get_cloud_saves", { appId });
}

/**
 * Applies achievement unlock/lock changes via the local Steamworks client API.
 * Steam must be running and the game must be owned by the current account.
 * @param appId - Steam app ID of the game
 * @param edits - Array of {api_name, unlocked} pairs describing the changes
 * @throws {string} If Steam is not running, DLL load fails, or a stat call fails
 */
export async function steamSetAchievements(
  appId: number,
  edits: AchievementEdit[],
): Promise<void> {
  return invoke("steam_set_achievements", { appId, edits });
}

/** Debug: returns appinfo.vdf parse diagnostics. Remove after verifying parser. */
export async function steamDebugAppinfo(): Promise<string> {
  return invoke("steam_debug_appinfo");
}
