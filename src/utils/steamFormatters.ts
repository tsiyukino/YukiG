/**
 * Utility functions for formatting Steam-related data for display.
 */

import { SteamLibItem } from "@/types/steam";

/** Groups games by collection name, sorting installed before uninstalled, then by playtime. */
export interface CollectionGroup {
  name: string;
  games: SteamLibItem[];
}

/**
 * Builds a list of CollectionGroup from the library games.
 *
 * Every game belongs to a group by its `collections` (the Steam Collections it
 * is tagged with); a game in several collections appears in each. Games in no
 * collection go to "Steam — Uncategorized". Within each group, installed games
 * come first, then most-played descending.
 *
 * @param games - The Steam library games (from steam_get_library)
 * @returns Sorted array of collection groups (empty groups omitted)
 */
export function buildGroups(games: SteamLibItem[]): CollectionGroup[] {
  const map = new Map<string, SteamLibItem[]>();
  map.set("Steam — Uncategorized", []);

  for (const game of games) {
    if (game.collections.length === 0) {
      map.get("Steam — Uncategorized")!.push(game);
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
    // Primary: installed games before uninstalled.
    // Secondary (within each group): most-played descending.
    g.sort((a, b) => {
      if (a.is_installed !== b.is_installed) return a.is_installed ? -1 : 1;
      return b.playtime_minutes - a.playtime_minutes;
    });
    result.push({ name, games: g });
  }
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
