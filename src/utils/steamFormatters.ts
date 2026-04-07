/**
 * Utility functions for formatting Steam-related data for display.
 */

import { SteamGame } from "@/types/steam";

/** Groups games by collection name, sorting installed before uninstalled, then by playtime. */
export interface CollectionGroup {
  name: string;
  games: SteamGame[];
}

/**
 * Builds a list of CollectionGroup from a flat game array and a list of collection names.
 * Games not in any collection are placed in "Steam — Uncategorized".
 * Within each group, installed games come first, then sorted by playtime descending.
 *
 * @param games - Flat list of all Steam games from the scan result
 * @param collectionNames - Ordered list of Steam collection names
 * @returns Sorted array of collection groups (empty groups omitted)
 */
export function buildGroups(games: SteamGame[], collectionNames: string[]): CollectionGroup[] {
  const map = new Map<string, SteamGame[]>();
  for (const name of collectionNames) map.set(name, []);
  map.set("Steam — Uncategorized", []);

  for (const game of games) {
    const col = game.collections[0] ?? "Steam — Uncategorized";
    if (!map.has(col)) map.set(col, []);
    map.get(col)!.push(game);
  }

  const result: CollectionGroup[] = [];
  for (const [name, g] of map) {
    if (g.length === 0) continue;
    // Primary: installed games before uninstalled.
    // Secondary (within each group): most-played descending, then most-recently-played descending.
    g.sort((a, b) => {
      if (a.is_installed !== b.is_installed) return a.is_installed ? -1 : 1;
      if (b.playtime_minutes !== a.playtime_minutes) return b.playtime_minutes - a.playtime_minutes;
      return b.last_played - a.last_played;
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
