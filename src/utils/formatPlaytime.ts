/**
 * Formats a playtime value in minutes to a human-readable string.
 *
 * @param minutes - Total minutes played
 * @returns A string like "0 min", "45 min", "2.5 h", "12 h"
 */
export function formatPlaytime(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = minutes / 60;
  if (hours < 10) return `${hours.toFixed(1)} h`;
  return `${Math.round(hours)} h`;
}
