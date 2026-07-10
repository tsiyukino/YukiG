/**
 * Hook for the library-root (unfiled) games shown in the Games page staging
 * column, plus the operation to file a game into a collection.
 *
 * Unfiled games are those with no collection (collection_id = null). Filing a
 * game moves it out of this list into the target collection.
 */
import { useState, useEffect, useCallback } from "react";
import { FavoriteItem } from "@/types/item";
import { itemGetUngrouped, itemSetCollection } from "@/services/tauriCommands";

interface UseUngroupedReturn {
  games: FavoriteItem[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  /** Files a game into a collection (or unfiles when collectionId is null). */
  fileInto: (itemId: string, collectionId: string | null) => Promise<void>;
}

/**
 * Loads unfiled games and exposes a filing operation that keeps the list in
 * sync optimistically.
 */
export function useUngrouped(): UseUngroupedReturn {
  const [games, setGames] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setGames(await itemGetUngrouped());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const fileInto = useCallback(async (itemId: string, collectionId: string | null) => {
    await itemSetCollection(itemId, collectionId);
    // Filing removes it from the unfiled list; unfiling would add it, but this
    // hook only ever files *out* of the list, so drop it locally either way.
    setGames((prev) => prev.filter((g) => g.id !== itemId));
  }, []);

  return { games, loading, error, refresh, fileInto };
}
