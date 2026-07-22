/**
 * Module-level Steam scan store — singleton that persists across navigations.
 *
 * The scan is initiated once on app startup (via `initSteamStore()` called in
 * App.tsx) and refreshed every hour automatically. Any component can subscribe
 * to get the latest result reactively via `useSteamStore()`.
 *
 * This replaces the per-page module-level cache previously in SteamPage.tsx so
 * both SteamPage and StatusPage share the same data without double-scanning.
 */

import { useEffect, useState } from "react";
import { steamScan, steamSync } from "@/services/tauriCommands";
import { SteamScanResult } from "@/types/steam";
import { steamSyncIntervalMs } from "@/hooks/useAppPrefs";

// ─── Singleton state ──────────────────────────────────────────────────────────

interface SteamStoreState {
  result: SteamScanResult | null;
  loading: boolean;
  error: string | null;
  lastScanAt: number;
  /** Timestamp of the last completed DB sync. Advances only after the sync
   *  finishes, so consumers reading synced data (the Steam page library) can
   *  key their reload off it rather than off the earlier scan completion. */
  lastSyncAt: number;
}

type Listener = (state: SteamStoreState) => void;

// TTL is read from user preferences at scan time rather than hardcoded.

let _state: SteamStoreState = {
  result: null,
  loading: false,
  error: null,
  lastScanAt: 0,
  lastSyncAt: 0,
};

const _listeners = new Set<Listener>();
let _scanPromise: Promise<void> | null = null;
let _intervalId: ReturnType<typeof setInterval> | null = null;

function notify() {
  _listeners.forEach((fn) => fn({ ..._state }));
}

function setState(patch: Partial<SteamStoreState>) {
  _state = { ..._state, ...patch };
  notify();
}

/**
 * Runs a Steam scan if one is not already in progress.
 * Deduplicated — multiple callers share the same promise.
 */
export async function steamStoreScan(): Promise<void> {
  if (_scanPromise) return _scanPromise;

  _scanPromise = (async () => {
    setState({ loading: true, error: null });
    try {
      const result = await steamScan();
      setState({ result, loading: false, lastScanAt: Date.now() });
      // Persist the library into the DB so Steam games become tracked items
      // (home, tray, recent list, Play page). Non-fatal: a sync failure must
      // not break the in-memory browse view above. On success, advance
      // lastSyncAt so the Steam page reloads its DB-backed library.
      steamSync()
        .then(() => setState({ lastSyncAt: Date.now() }))
        .catch((e) => console.error("steam_sync failed:", e));
    } catch (e) {
      setState({ loading: false, error: String(e) });
    } finally {
      _scanPromise = null;
    }
  })();

  return _scanPromise;
}

/**
 * Initialises the store: runs an immediate scan and schedules hourly refreshes.
 * Safe to call multiple times — only the first call starts the interval.
 */
export function initSteamStore(): void {
  const intervalMs = steamSyncIntervalMs();

  // Scan immediately if never scanned, or TTL has expired (and sync is enabled).
  const age = Date.now() - _state.lastScanAt;
  if (!_state.result || (intervalMs !== null && age > intervalMs)) {
    steamStoreScan();
  }

  // Only start the interval once; skip when sync is disabled or manual.
  if (_intervalId === null && intervalMs !== null) {
    _intervalId = setInterval(() => { steamStoreScan(); }, intervalMs);
  }
}

/**
 * React hook — subscribes to the Steam store and returns the current state.
 * Re-renders whenever the store updates.
 */
export function useSteamStore(): SteamStoreState {
  const [state, setState_] = useState<SteamStoreState>({ ..._state });

  useEffect(() => {
    // Sync in case the store updated between render and effect
    setState_({ ..._state });

    const listener: Listener = (s) => setState_(s);
    _listeners.add(listener);
    return () => { _listeners.delete(listener); };
  }, []);

  return state;
}
