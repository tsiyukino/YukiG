/**
 * Loads the Steam library from the DB for the Steam page.
 *
 * The page reads its games from imported `steam_game` items (via
 * `steam_get_library`), not from the in-memory scan. The scan/sync still runs in
 * steamStore (Sync button + hourly refresh); this hook re-fetches the library
 * whenever a sync completes, keyed off the store's `lastSyncAt` (which advances
 * only after the DB write finishes), so the two stay consistent without the page
 * owning the scan.
 */
import { useState, useEffect, useCallback } from "react";
import { steamGetLibrary } from "@/services/tauriCommands";
import { SteamLibItem } from "@/types/steam";
import { useSteamStore } from "@/store/steamStore";

interface SteamLibraryState {
  games: SteamLibItem[];
  loading: boolean;
  error: string | null;
  /** Re-reads the library from the DB (e.g. after a favourite toggle). */
  reload: () => void;
}

/**
 * Returns the Steam library from the DB, reloading after each sync.
 */
export function useSteamLibrary(): SteamLibraryState {
  const { lastSyncAt } = useSteamStore();
  const [games, setGames] = useState<SteamLibItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    steamGetLibrary()
      .then((g) => { setGames(g); setError(null); })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  // Initial load, and re-load whenever a sync finishes (lastSyncAt advances).
  useEffect(() => { reload(); }, [reload, lastSyncAt]);

  return { games, loading, error, reload };
}
