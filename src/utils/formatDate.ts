/**
 * Formats an ISO 8601 timestamp into a human-readable local date string.
 *
 * @param isoString - ISO 8601 timestamp (e.g., "2024-01-15T10:30:00Z")
 * @returns Locale-formatted date string (e.g., "Jan 15, 2024")
 */
export function formatDate(isoString: string): string {
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return isoString;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
