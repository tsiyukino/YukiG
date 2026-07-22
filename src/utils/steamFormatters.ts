/**
 * Utility functions for formatting Steam-related data for display.
 */

import { SteamLibItem } from "@/types/steam";

/** Groups games by collection name, sorting installed before uninstalled, then by playtime. */
export interface CollectionGroup {
  name: string;
  games: SteamLibItem[];
}

/** Name of the catch-all group for games in no Steam Collection. */
const UNCATEGORIZED = "Steam — Uncategorized";

/**
 * Orders two group names the way the Steam client sidebar does: the Favorites
 * collection (whose localised name is `favoritesName`) pinned to the top, the
 * Uncategorized catch-all pinned to the bottom, and everything else
 * alphabetically (locale-aware).
 */
function compareGroupNames(a: string, b: string, favoritesName: string | null): number {
  if (a === b) return 0;
  if (favoritesName) {
    if (a === favoritesName) return -1;
    if (b === favoritesName) return 1;
  }
  if (a === UNCATEGORIZED) return 1;
  if (b === UNCATEGORIZED) return -1;
  return a.localeCompare(b);
}

/**
 * Builds a list of CollectionGroup from the library games.
 *
 * Every game belongs to a group by its `collections` (the Steam Collections it
 * is tagged with); a game in several collections appears in each. Games in no
 * collection go to "Steam — Uncategorized". Groups are ordered like the Steam
 * client (Favorites first, Uncategorized last, the rest alphabetically); within
 * a group, installed games come first, then most-played descending.
 *
 * @param games - The Steam library games (from steam_get_library)
 * @returns Sorted array of collection groups (empty groups omitted)
 */
export function buildGroups(games: SteamLibItem[]): CollectionGroup[] {
  const map = new Map<string, SteamLibItem[]>();
  // The Favorites collection's localised name, taken from any game in it.
  const favoritesName = games.find((g) => g.favorites_name)?.favorites_name ?? null;

  for (const game of games) {
    if (game.collections.length === 0) {
      (map.get(UNCATEGORIZED) ?? map.set(UNCATEGORIZED, []).get(UNCATEGORIZED)!).push(game);
      continue;
    }
    for (const col of game.collections) {
      if (!map.has(col)) map.set(col, []);
      map.get(col)!.push(game);
    }
  }

  const result: CollectionGroup[] = [];
  for (const [name, g] of map) {
    if (g.length === 0) continue;
    // Within a group: installed first, then most-played descending.
    g.sort((a, b) => {
      if (a.is_installed !== b.is_installed) return a.is_installed ? -1 : 1;
      return b.playtime_minutes - a.playtime_minutes;
    });
    result.push({ name, games: g });
  }
  result.sort((x, y) => compareGroupNames(x.name, y.name, favoritesName));
  return result;
}

/**
 * Formats a byte count into a human-readable string (e.g. "4.2 GB").
 *
 * @param bytes - Raw byte count
 * @returns Formatted string with appropriate unit suffix
 */
export function fmtBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

/**
 * Formats a Unix timestamp (seconds) into a locale-aware short date string.
 *
 * @param ts - Unix timestamp in seconds
 * @returns Formatted date string, e.g. "Jan 1, 2024"
 */
export function fmtDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString(undefined, {
    year: "numeric", month: "short", day: "numeric",
  });
}

/**
 * Formats Steam playtime minutes as hours text, or null when never played.
 *
 * @param minutes - Total playtime in minutes
 * @returns "12.5 hrs", "45 min", or null for zero playtime
 */
export function fmtPlaytimeHours(minutes: number): string | null {
  if (minutes <= 0) return null;
  if (minutes >= 60) return `${(minutes / 60).toFixed(1)} hrs`;
  return `${minutes} min`;
}
