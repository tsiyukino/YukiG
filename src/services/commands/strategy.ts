/**
 * Tauri command wrappers — Strategy and Shell domain.
 */
import { invoke } from "@tauri-apps/api/core";
import { DisplayItem, LaunchAction, MetadataField, ScanResult } from "@/types/strategy";

/** A strategy type entry as returned by strategy_list. */
export interface StrategyEntry {
  strategy_type: string;
  display_name: string;
  /** Group prefix for grouped strategies. Empty string for top-level strategies. */
  group: string;
}

/**
 * Lists all registered strategy types with their display names.
 * @returns Array of strategy entries
 * @throws {string} If the command fails
 */
export async function strategyList(): Promise<StrategyEntry[]> {
  return invoke("strategy_list");
}

/**
 * Runs a strategy scan on a folder path and persists the discovered metadata.
 * @param itemId - The item UUID to store metadata under
 * @param folderPath - Absolute path to the folder to scan
 * @param strategyType - Strategy identifier (e.g., "game")
 * @returns Scan result with discovered metadata and summary
 * @throws {string} If the strategy is unknown, path is invalid, or DB write fails
 */
export async function strategyScan(
  itemId: string,
  folderPath: string,
  strategyType: string
): Promise<ScanResult> {
  return invoke("strategy_scan", { itemId, folderPath, strategyType });
}

/**
 * Returns the display items for a folder according to the strategy.
 * @param folderPath - Absolute path to the folder
 * @param strategyType - Strategy identifier
 * @returns Array of display items
 * @throws {string} If the strategy is unknown or path is invalid
 */
export async function strategyGetDisplayItems(
  folderPath: string,
  strategyType: string
): Promise<DisplayItem[]> {
  return invoke("strategy_get_display_items", { folderPath, strategyType });
}

/**
 * Returns the launch action for an item using its stored strategy metadata.
 * @param itemId - The item UUID
 * @param folderPath - Absolute path to the folder
 * @param strategyType - Strategy identifier
 * @returns Launch action or null if no action is available
 * @throws {string} If the strategy is unknown or metadata fetch fails
 */
export async function strategyGetLaunchAction(
  itemId: string,
  folderPath: string,
  strategyType: string
): Promise<LaunchAction | null> {
  return invoke("strategy_get_launch_action", { itemId, folderPath, strategyType });
}

/**
 * Returns the metadata field schema for a strategy type.
 * @param strategyType - Strategy identifier
 * @returns Array of metadata field definitions
 * @throws {string} If the strategy type is unknown
 */
export async function strategyGetMetadataSchema(strategyType: string): Promise<MetadataField[]> {
  return invoke("strategy_get_metadata_schema", { strategyType });
}

/**
 * Executes the launch action for an item (fire-and-forget).
 * @param itemId - The item UUID
 * @param folderPath - Absolute path to the item's folder
 * @param strategyType - Strategy identifier
 * @throws {string} If no launch action exists, strategy is unknown, or spawn fails
 */
export async function strategyExecuteLaunch(
  itemId: string,
  folderPath: string,
  strategyType: string
): Promise<void> {
  return invoke("strategy_execute_launch", { itemId, folderPath, strategyType });
}

/**
 * Executes the launch action and tracks playtime.
 * Blocks until the game process exits, then updates total_playtime_minutes
 * and last_launched in strategy_metadata. Call from a non-blocking context.
 * @param itemId - The item UUID
 * @param folderPath - Absolute path to the game folder
 * @param strategyType - Strategy identifier
 * @returns Session duration in minutes
 * @throws {string} If the launch fails
 */
export async function strategyExecuteLaunchTracked(
  itemId: string,
  folderPath: string,
  strategyType: string
): Promise<number> {
  return invoke("strategy_execute_launch_tracked", { itemId, folderPath, strategyType });
}

/**
 * Returns playtime summary for a list of items.
 * @param itemIds - Array of item UUIDs
 * @returns Map of item_id → { total_playtime_minutes?, last_launched? }
 * @throws {string} If the database query fails
 */
export async function strategyGetPlaytimeBulk(
  itemIds: string[]
): Promise<Record<string, Record<string, string>>> {
  return invoke("strategy_get_playtime_bulk", { itemIds });
}

/**
 * Returns all stored strategy metadata for an item as a key-value map.
 * @param itemId - The item UUID
 * @returns Key-value map of metadata
 * @throws {string} If the database query fails
 */
export async function strategyGetMetadata(itemId: string): Promise<Record<string, string>> {
  return invoke("strategy_get_metadata", { itemId });
}

/**
 * Upserts a set of metadata key-value pairs for an item.
 * @param itemId - The item UUID
 * @param metadata - Key-value pairs to write
 * @throws {string} If the database write fails
 */
export async function strategyUpsertMetadata(
  itemId: string,
  metadata: Record<string, string>
): Promise<void> {
  return invoke("strategy_upsert_metadata", { itemId, metadata });
}

/**
 * Opens a path with the system default application (Explorer for folders).
 * @param path - Absolute path to open
 * @throws {string} If the opener fails
 */
export async function shellOpenPath(path: string): Promise<void> {
  return invoke("shell_open_path", { path });
}
