/**
 * Application UI preferences — persisted in localStorage.
 *
 * Covers user-configurable defaults for layout and behaviour that do not
 * require a backend round-trip. All keys are centralised here so every
 * consumer reads/writes the same string constants.
 *
 * Usage:
 *   const [prefs, setPrefs] = useAppPrefs();
 *   setPrefs({ defaultGamesView: "list" });
 */
import { useState, useEffect } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type GamesViewMode       = "card" | "compact" | "list" | "table";
export type CollectionViewMode  = "grid" | "gallery" | "list";
export type SteamSyncInterval   = "1h" | "2h" | "4h" | "8h" | "manual";

/** All UI preferences managed by this hook. */
export interface AppPrefs {
  /** Default view mode for the Games page. */
  defaultGamesView: GamesViewMode;
  /** App-wide default view for Collection pages (can be overridden per-collection). */
  defaultCollectionView: CollectionViewMode;
  /** Whether the left sidebar starts expanded on app launch. */
  sidebarExpandedOnStart: boolean;
  /** How often the Steam library syncs in the background. */
  steamSyncInterval: SteamSyncInterval;
  /** Whether background Steam sync is enabled at all. */
  steamSyncEnabled: boolean;
  /** Accent color as a hex string, e.g. "#6366f1". */
  accentColor: string;
}

const DEFAULTS: AppPrefs = {
  defaultGamesView: "card",
  defaultCollectionView: "grid",
  sidebarExpandedOnStart: false,
  steamSyncInterval: "1h",
  steamSyncEnabled: true,
  accentColor: "#6366f1",
};

const STORAGE_KEY = "app-prefs";

// ─── Singleton read/write ─────────────────────────────────────────────────────

/** Reads preferences from localStorage, falling back to defaults for missing keys. */
export function readAppPrefs(): AppPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

/** Writes a partial patch over the current preferences. */
export function writeAppPrefs(patch: Partial<AppPrefs>): AppPrefs {
  const next = { ...readAppPrefs(), ...patch };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

/**
 * Returns the Steam sync interval in milliseconds, or null when sync is
 * disabled or set to "manual".
 */
export function steamSyncIntervalMs(): number | null {
  const prefs = readAppPrefs();
  if (!prefs.steamSyncEnabled || prefs.steamSyncInterval === "manual") return null;
  const map: Record<SteamSyncInterval, number> = {
    "1h": 60 * 60 * 1000,
    "2h": 2 * 60 * 60 * 1000,
    "4h": 4 * 60 * 60 * 1000,
    "8h": 8 * 60 * 60 * 1000,
    "manual": Infinity,
  };
  return map[prefs.steamSyncInterval];
}

// ─── Accent color ─────────────────────────────────────────────────────────────

/**
 * Applies the stored accent color to the document CSS variables immediately.
 *
 * For the default accent this clears the overrides instead of setting them,
 * so the token layer (tokens.css) stays in charge — it defines proper
 * per-theme accents (lighter in dark mode) that an inline override would mask.
 */
export function applyAccentColor(color: string): void {
  const root = document.documentElement;

  if (color.toLowerCase() === DEFAULTS.accentColor) {
    root.style.removeProperty("--color-accent");
    root.style.removeProperty("--color-accent-hover");
    root.style.removeProperty("--color-accent-light");
    return;
  }

  root.style.setProperty("--color-accent", color);
  root.style.setProperty("--color-accent-hover", darkenHex(color, 0.12));
  root.style.setProperty("--color-accent-light", hexToAlpha(color, 0.12));
}

/** Converts a hex color to an rgba string with the given alpha. */
function hexToAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Darkens a hex color by the given fraction (0–1), used for hover states. */
function darkenHex(hex: string, amount: number): string {
  const channel = (offset: number) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16);
    return Math.max(0, Math.round(value * (1 - amount)))
      .toString(16)
      .padStart(2, "0");
  };
  return `#${channel(1)}${channel(3)}${channel(5)}`;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * React hook that provides the current app preferences and a setter.
 * Re-renders the component when preferences change.
 *
 * @returns [prefs, setPrefs] where setPrefs accepts a partial patch.
 */
export function useAppPrefs(): [AppPrefs, (patch: Partial<AppPrefs>) => void] {
  const [prefs, setPrefsState] = useState<AppPrefs>(readAppPrefs);

  function setPrefs(patch: Partial<AppPrefs>) {
    const next = writeAppPrefs(patch);
    if (patch.accentColor) applyAccentColor(patch.accentColor);
    setPrefsState(next);
  }

  // Apply the accent color on mount.
  useEffect(() => {
    applyAccentColor(prefs.accentColor);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return [prefs, setPrefs];
}
