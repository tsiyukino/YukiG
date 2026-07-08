/**
 * Shared color palettes for user-created entities (tags, collections).
 * Single source of truth — do not redeclare these lists in components.
 */

/** Palette offered when creating tags; also used for random assignment. */
export const TAG_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e",
  "#f97316", "#eab308", "#22c55e", "#14b8a6",
  "#3b82f6", "#94a3b8",
] as const;

/** Palette offered when creating or editing a collection. */
export const COLLECTION_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444", "#f97316",
  "#eab308", "#22c55e", "#14b8a6", "#3b82f6", "#64748b",
] as const;

/** Picks a random tag color, used when creating tags on the fly. */
export function randomTagColor(): string {
  return TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)];
}
