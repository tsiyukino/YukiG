/**
 * Tauri command wrappers — Play sessions and game status domain.
 */
import { invoke } from "@tauri-apps/api/core";

/** A recorded play session. */
export interface PlaySession {
  id: string;
  item_id: string;
  /** ISO 8601 */
  started_at: string;
  /** ISO 8601, or null while in progress */
  ended_at: string | null;
}

/** A game currently being played, as tracked by the in-memory registry. */
export interface ActiveSession {
  item_id: string;
  /** Unix timestamp (seconds) when the session started. */
  started_at: number;
}

/** Story-mode play status for a game. */
export type StoryStatus =
  | "unplayed"
  | "playing"
  | "on_hold"
  | "snoozed"
  | "completed"
  | "abandoned";

/** Online / live-service activity status. */
export type OnlineStatus = "inactive" | "active" | "snoozed";

/** Full status record for a single game. */
export interface GameStatus {
  item_id: string;
  story_status: StoryStatus;
  online_status: OnlineStatus;
  /** ISO 8601 snooze expiry, or null. */
  snooze_until: string | null;
}

// ---------------------------------------------------------------------------
// Play sessions
// ---------------------------------------------------------------------------

/**
 * Opens a new play session for an item and returns the session id.
 * @param itemId - The item UUID
 * @throws {string} If the database write fails
 */
export async function sessionStart(itemId: string): Promise<string> {
  return invoke("session_start", { itemId });
}

/**
 * Closes a play session by recording its end time.
 * @param sessionId - The session UUID returned by sessionStart
 * @throws {string} If the session is not found or the update fails
 */
export async function sessionEnd(sessionId: string): Promise<void> {
  return invoke("session_end", { sessionId });
}

/**
 * Returns all play sessions for an item, newest first.
 * @param itemId - The item UUID
 * @throws {string} If the query fails
 */
export async function sessionGetByItem(itemId: string): Promise<PlaySession[]> {
  return invoke("session_get_by_item", { itemId });
}

/**
 * Returns the items currently being played (local games launched via YukiG and
 * Steam games detected via Steam's registry).
 *
 * Read on window (re)creation to rebuild "now playing" state, since the backend
 * is the source of truth and the tray flow destroys the webview.
 * @throws {string} If the query fails
 */
export async function sessionGetActive(): Promise<ActiveSession[]> {
  return invoke("session_get_active");
}

// ---------------------------------------------------------------------------
// Game status
// ---------------------------------------------------------------------------

/**
 * Returns the game status for a single item.
 * Returns a default unplayed/inactive record if no row exists.
 * @param itemId - The item UUID
 * @throws {string} If the query fails
 */
export async function gameStatusGet(itemId: string): Promise<GameStatus> {
  return invoke("game_status_get", { itemId });
}

/**
 * Upserts the game status for an item.
 * @param itemId - The item UUID
 * @param storyStatus - New story status
 * @param onlineStatus - New online status
 * @param snoozeUntil - ISO 8601 snooze expiry, or null
 * @throws {string} If the write fails
 */
export async function gameStatusSet(
  itemId: string,
  storyStatus: StoryStatus,
  onlineStatus: OnlineStatus,
  snoozeUntil: string | null
): Promise<GameStatus> {
  return invoke("game_status_set", {
    itemId,
    storyStatus,
    onlineStatus,
    snoozeUntil,
  });
}

/**
 * Returns all game status rows in the database.
 * @throws {string} If the query fails
 */
export async function gameStatusGetAll(): Promise<GameStatus[]> {
  return invoke("game_status_get_all");
}

/**
 * Returns game status rows for a list of item ids.
 * Items with no row are not included in the result.
 * @param itemIds - Array of item UUIDs
 * @throws {string} If the query fails
 */
export async function gameStatusGetBulk(itemIds: string[]): Promise<GameStatus[]> {
  return invoke("game_status_get_bulk", { itemIds });
}

/**
 * Ensures every game item has a status row (inserts defaults for missing ones).
 * Call on app startup.
 * @returns Number of rows inserted
 * @throws {string} If the query fails
 */
export async function gameStatusBulkInit(): Promise<number> {
  return invoke("game_status_bulk_init");
}
