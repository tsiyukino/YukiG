/**
 * Tauri command wrappers — System domain.
 *
 * Covers: thumbnails, previews, file watcher, settings, search, game suggestions, icons.
 */
import { invoke } from "@tauri-apps/api/core";
import { Collection } from "@/types/collection";
import { Item } from "@/types/item";
import { Tag } from "@/types/tag";

// ─── Thumbnail ────────────────────────────────────────────────────────────────

/**
 * Returns the absolute path of a cached thumbnail for an item, generating it
 * on first call. Returns null if no image is found in the item's folder.
 * @param itemId - The item UUID
 * @param folderPath - Absolute path to the item's folder
 * @returns Absolute path to the thumbnail, or null
 * @throws {string} On unexpected IO failure
 */
export async function thumbnailGet(itemId: string, folderPath: string): Promise<string | null> {
  return invoke("thumbnail_get", { itemId, folderPath });
}

/**
 * Copies a user-selected image into the thumbnail cache for an item.
 * @param itemId - The item UUID
 * @param sourcePath - Absolute path to the image file chosen by the user
 * @returns Absolute path to the new cached thumbnail
 * @throws {string} If the file cannot be copied
 */
export async function thumbnailSet(itemId: string, sourcePath: string): Promise<string> {
  return invoke("thumbnail_set", { itemId, sourcePath });
}

// ─── Preview ─────────────────────────────────────────────────────────────────

/** Preview kind discriminant matching the Rust PreviewKind enum. */
export type PreviewKind = "image" | "text" | "pdf" | "unsupported";

/** Payload returned by preview_get. */
export interface FilePreview {
  kind: PreviewKind;
  /** Base64-encoded bytes (images/PDF) or raw UTF-8 text. Empty for unsupported. */
  content: string;
  /** MIME type string, e.g. "image/png". Empty for unsupported. */
  mime_type: string;
  /** True if text content was truncated to the server-side limit (32 KiB). */
  truncated: boolean;
}

/**
 * Generates an inline preview for a single file.
 * @param filePath - Absolute path to the file
 * @returns Preview data with kind, content, and mime type
 * @throws {string} If the file cannot be read
 */
export async function previewGet(filePath: string): Promise<FilePreview> {
  return invoke("preview_get", { filePath });
}

// ─── Watcher ─────────────────────────────────────────────────────────────────

/**
 * Registers a folder path for file watching.
 * The backend emits a `file-changed` Tauri event when files inside are modified.
 * @param itemId - The item UUID associated with this path (used in the event payload)
 * @param folderPath - Absolute path to watch
 * @throws {string} If the watcher cannot be initialised for the path
 */
export async function watcherAdd(itemId: string, folderPath: string): Promise<void> {
  return invoke("watcher_add", { itemId, folderPath });
}

/**
 * Removes a folder path from the file watcher.
 * @param itemId - The item UUID whose watch should be removed
 * @throws {string} If the remove fails
 */
export async function watcherRemove(itemId: string): Promise<void> {
  return invoke("watcher_remove", { itemId });
}

// ─── Settings ────────────────────────────────────────────────────────────────

/**
 * Returns the absolute path to the currently active data directory.
 * @returns Absolute path string
 * @throws {string} If the path cannot be resolved
 */
export async function settingsGetDataDir(): Promise<string> {
  return invoke("settings_get_data_dir");
}

/**
 * Migrates all data to a new directory and saves the path to config.
 * The app must be restarted for the change to take effect.
 * @param newDir - Absolute path to the new data directory
 * @throws {string} If migration or config write fails
 */
export async function settingsSetDataDir(newDir: string): Promise<void> {
  return invoke("settings_set_data_dir", { newDir });
}

/** Shape of the behaviour settings object exchanged with the backend. */
export interface BehaviourSettings {
  start_on_startup: boolean;
  minimize_on_start: boolean;
  minimize_to_tray: boolean;
}

/**
 * Returns the current behaviour settings.
 * @throws {string} If the config cannot be read
 */
export async function settingsGetBehaviour(): Promise<BehaviourSettings> {
  return invoke("settings_get_behaviour");
}

/**
 * Saves behaviour settings and immediately applies any registry changes.
 * @param settings - The full behaviour settings object
 * @throws {string} If the config write or registry operation fails
 */
export async function settingsSetBehaviour(settings: BehaviourSettings): Promise<void> {
  return invoke("settings_set_behaviour", { settings });
}

// ─── Search ──────────────────────────────────────────────────────────────────

/** Categorised results from a global search across collections, items, and tags. */
export interface SearchAllResult {
  collections: Collection[];
  items: Item[];
  tags: Tag[];
}

/**
 * Searches all items using full-text search.
 * @param query - The search query string
 * @returns Items matching the query, ordered by relevance
 * @throws {string} If the search fails
 */
export async function searchItems(query: string): Promise<Item[]> {
  return invoke("search_items", { query });
}

/**
 * Searches collections, items, and tags in one call.
 * @param query - The raw search query string
 * @returns Categorised results: collections, items, tags
 * @throws {string} If the search fails
 */
export async function searchAll(query: string): Promise<SearchAllResult> {
  return invoke("search_all", { query });
}

/**
 * Searches items within a specific collection using FTS.
 * @param collectionId - Restrict results to this collection
 * @param query - The search query string
 * @returns Matching items within the collection
 * @throws {string} If the search fails
 */
export async function searchItemsInCollection(
  collectionId: string,
  query: string,
): Promise<Item[]> {
  return invoke("search_items_in_collection", { collectionId, query });
}

// ─── Game Suggestions ─────────────────────────────────────────────────────────

/** A single ranked suggestion returned by game_suggest_paths. */
export interface PathSuggestion {
  path: string;
  name: string;
  /** Depth relative to the game root (0 = root-level child). */
  depth: number;
  /** File size in bytes for exe candidates; 0 for folders. */
  size_bytes: number;
}

/** All suggestion lists for a game folder. */
export interface GameSuggestions {
  executables: PathSuggestion[];
  mod_folders: PathSuggestion[];
  screenshot_folders: PathSuggestion[];
}

/**
 * Scans a single depth layer of a game folder and returns path candidates.
 * @param folderPath - Absolute path to the game's root folder
 * @param scanDepth - Which layer to scan (0 = root children)
 * @returns Candidates found at exactly that depth layer
 * @throws {string} If the folder does not exist or cannot be read
 */
export async function gameSuggestPaths(
  folderPath: string,
  scanDepth: number,
): Promise<GameSuggestions> {
  return invoke("game_suggest_paths", { folderPath, scanDepth });
}

// ─── Icon ─────────────────────────────────────────────────────────────────────

/**
 * Extracts the shell icon for a file path (e.g. a game .exe) and returns it
 * as a PNG data URL. Returns null if the path has no icon or extraction fails.
 * @param path - Absolute path to the file
 * @returns A `data:image/png;base64,...` string, or null
 */
export async function getFileIcon(path: string): Promise<string | null> {
  return invoke("get_file_icon", { path });
}
