/**
 * Utility for displaying strategy type identifiers as human-readable labels.
 */

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
