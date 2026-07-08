/**
 * Tray-menu popup commands: recent-games data and popup window lifecycle.
 *
 * These are only invoked from the tray-menu window (`?window=tray` entry).
 */
import { invoke } from "@tauri-apps/api/core";

/** A recently played game as shown in the tray menu. */
export interface TrayRecentGame {
  id: string;
  name: string;
  strategy_type: string;
  thumbnail_path: string | null;
  icon_url: string | null;
}

/**
 * Returns the games for the tray menu, most recently played first.
 * @returns Up to 5 recent games (local + Steam merged)
 * @throws {string} If the database query fails
 */
export async function trayGetRecentGames(): Promise<TrayRecentGame[]> {
  return invoke("tray_get_recent_games");
}

/**
 * Launches an item from the tray menu, fire-and-forget.
 * Resolves immediately; playtime tracking continues in the backend.
 * @param itemId - The item UUID
 */
export async function trayLaunchItem(itemId: string): Promise<void> {
  return invoke("tray_launch_item", { itemId });
}

/**
 * Sizes, positions, shows, and focuses the tray-menu popup.
 * @param width - Measured content width in logical pixels
 * @param height - Measured content height in logical pixels
 * @throws {string} If the menu window is missing or a window operation fails
 */
export async function trayMenuPresent(width: number, height: number): Promise<void> {
  return invoke("tray_menu_present", { width, height });
}

/**
 * Hides the tray-menu popup.
 * @throws {string} If the menu window is missing or hiding fails
 */
export async function trayMenuHide(): Promise<void> {
  return invoke("tray_menu_hide");
}

/** Opens (or recreates) the main window from the tray menu. */
export async function trayOpenMain(): Promise<void> {
  return invoke("tray_open_main");
}

/** Quits the application from the tray menu. */
export async function trayQuit(): Promise<void> {
  return invoke("tray_quit");
}
