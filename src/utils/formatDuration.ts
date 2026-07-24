/**
 * Duration formatting helpers.
 */

/**
 * Formats a play duration in seconds as compact hours/minutes/seconds text.
 * @param secs - Total seconds; 0 yields "Never played"
 * @returns e.g. "3h 12m", "45m 10s", "8s"
 */
export function formatPlaySeconds(secs: number): string {
  if (secs === 0) return "Never played";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  if (m > 0) return s > 0 ? `${m}m ${s}s` : `${m}m`;
  return `${s}s`;
}
