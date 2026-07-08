/**
 * Utility for displaying strategy type identifiers as human-readable labels.
 */
import { Item } from "@/types/item";

/** Maps known strategy type strings to their display label. */
const STRATEGY_LABELS: Record<string, string> = {
  game: "Game",
  virtual_folder: "Folder",
  virtual_group: "Group",
};

/**
 * Returns a short, human-readable label for a strategy type.
 *
 * @param strategyType - The raw strategy_type string from the database
 * @returns Human-readable label, falling back to the type capitalized
 */
export function strategyLabel(strategyType: string): string {
  if (STRATEGY_LABELS[strategyType]) {
    return STRATEGY_LABELS[strategyType];
  }
  // Fallback: capitalize
  return strategyType.charAt(0).toUpperCase() + strategyType.slice(1);
}

/**
 * Returns the type label shown on an item's card or row.
 * File items prefer their category (e.g. "Video") over the generic label.
 *
 * @param item - The item whose badge label to compute
 * @returns Human-readable type label
 */
export function itemTypeLabel(item: Item): string {
  if (item.strategy_type === "file" && item.category) {
    return item.category.charAt(0).toUpperCase() + item.category.slice(1);
  }
  return strategyLabel(item.strategy_type);
}
