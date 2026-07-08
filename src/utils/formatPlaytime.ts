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

/**
 * Formats a minute count as a compact hours-and-minutes duration.
 *
 * @param minutes - Total minutes played
 * @returns A string like "0h", "45m", "2h 15m", "12h"
 */
export function formatHoursMinutes(minutes: number): string {
  if (minutes === 0) return "0h";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
