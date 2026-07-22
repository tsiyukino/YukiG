/**
 * TypeScript types for the Steam integration domain.
 */
import { Item } from "@/types/item";

/** A single Steam game as returned by the backend scan. */
export interface SteamGame {
  app_id: number;
  name: string;
  install_path: string | null;
  is_installed: boolean;
  collections: string[];
  size_on_disk: number;
  bytes_downloaded: number;
  /** Steam community icon URL (~184×184 JPG, built from icon hash in appinfo.vdf).
   *  Works for all games including new hash-path games. Empty string if hash unavailable. */
  icon_url: string;
  /** Steam CDN library header URL (920×430) — used for grid cards and wide banners. */
  header_image: string;
  /** Steam CDN library capsule portrait URL (600×900) — primary library/collection view. */
  library_image: string;
  /** Steam CDN library hero URL (3840×1240) — used for detail page background. */
  library_hero: string;
  /** Steam CDN library logo PNG (transparent, up to 1280×720) — overlaid on hero. */
  library_logo: string;
  /** Unix timestamp of last play, 0 if never. */
  last_played: number;
  /** Total playtime in minutes (from localconfig.vdf), 0 if unknown. */
  playtime_minutes: number;
  /** Developer name from appinfo.vdf, null if unknown. */
  developer: string | null;
  /** Publisher name from appinfo.vdf, null if unknown. */
  publisher: string | null;
  /** Original release date (Unix timestamp), 0 if unknown. */
  release_date: number;
  /** OS support bitmask: 1=Windows, 2=Mac, 4=Linux. 0 if unknown. */
  os_list: number;
  /** Steam category IDs from appinfo.vdf (e.g. 1=Multi-player, 36=Online PvP, 9=Co-op). */
  categories: number[];
}

/**
 * A Steam library game as read from the DB (an imported `steam_game` item).
 *
 * This is the Steam page's data source: a unified `Item` (stable id, favourite
 * flag, etc.) extended with the Steam cover art and facts stored in metadata,
 * plus the names of the `steam_collection` tags the game belongs to. Mirrors the
 * Rust `SteamLibItem` (which flattens `Item` into the same shape).
 */
export interface SteamLibItem extends Item {
  app_id: number;
  is_installed: boolean;
  size_on_disk: number;
  playtime_minutes: number;
  icon_url: string;
  header_image: string;
  library_image: string;
  library_hero: string;
  library_logo: string;
  /** Names of the Steam Collections this game is in. */
  collections: string[];
}

/** A local screenshot file for a Steam game. */
export interface SteamScreenshot {
  path: string;
  filename: string;
  size: number;
  /** Unix timestamp of file modification. */
  timestamp: number;
}

/** A cloud save file from the Steam userdata remote directory. */
export interface SteamCloudFile {
  /** Path relative to the remote/ directory. */
  name: string;
  size: number;
  /** Unix timestamp of file modification. */
  timestamp: number;
}

/** A single achievement as returned by steam_get_achievements. */
export interface SteamAchievement {
  api_name: string;
  /** Localized display name. Empty for hidden locked achievements. */
  name: string;
  /** Localized description. Empty for hidden locked achievements. */
  description: string;
  unlocked: boolean;
  /** Unix timestamp of unlock, 0 if not unlocked. */
  unlock_time: number;
  /** Global unlock percentage across all players (0–100). */
  global_pct: number;
  /** CDN URL to the achievement icon. */
  icon: string;
  /** True when this is a secret achievement that has not been unlocked yet. */
  hidden: boolean;
}

/** A single achievement state change to apply via steam_set_achievements. */
export interface AchievementEdit {
  api_name: string;
  unlocked: boolean;
}

/** A Steam user account from loginusers.vdf. */
export interface SteamUser {
  steam_id: string;
  account_name: string;
  persona_name: string;
  remember_password: boolean;
  most_recent: boolean;
  timestamp: number;
  wants_offline_mode: boolean;
  avatar_url: string;
}

/** Full result of a Steam library scan. */
export interface SteamScanResult {
  games: SteamGame[];
  collection_names: string[];
  steam_path: string;
  users: SteamUser[];
}

/** Input for importing a single game. */
export interface ImportGameInput {
  app_id: number;
  name: string;
  install_path: string | null;
  is_installed: boolean;
  collections: string[];
  size_on_disk: number;
  icon_url: string;
  header_image: string;
  library_image: string;
  library_hero: string;
  library_logo: string;
  /** Steam category IDs from appinfo.vdf (e.g. 1=Multi-player, 36=Online PvP, 9=Co-op). */
  categories: number[];
}

/** Result returned after a bulk import. */
export interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

/** Result returned after a library sync. */
export interface SyncResult {
  added: number;
  updated: number;
  removed: number;
  errors: string[];
}
