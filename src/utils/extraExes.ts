/**
 * A game's extra executables — secondary launchers (server, config tool, …)
 * beyond the main exe. Stored as a JSON array in the `extra_exes` metadata key;
 * the main exe stays in `exe_path`.
 */

/** One extra executable with a user-facing label. */
export interface ExtraExe {
  /** Display label, e.g. "Server", "Config". */
  label: string;
  /** Absolute path to the executable. */
  path: string;
}

/** Parses the `extra_exes` metadata value into a list, tolerating bad data. */
export function parseExtraExes(value: string | undefined): ExtraExe[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is ExtraExe =>
        e && typeof e.label === "string" && typeof e.path === "string",
    );
  } catch {
    return [];
  }
}

/** Serializes a list of extra exes for storage in the `extra_exes` key. */
export function serializeExtraExes(exes: ExtraExe[]): string {
  return JSON.stringify(exes);
}
