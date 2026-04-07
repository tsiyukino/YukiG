/**
 * Hook for loading and managing the collections list.
 *
 * Fetches all collections on mount and provides create/update/delete
 * operations that keep the local state in sync with the database.
 *
 * A module-level cache avoids redundant SQLite round trips when navigating
 * between pages. The cache is invalidated on any write (create/update/delete)
 * and has a 30-second TTL so stale data is never shown for long.
 */
import { useState, useEffect, useCallback } from "react";
import { Collection, NewCollection, UpdateCollection } from "@/types/collection";
import {
  collectionGetAll,
  collectionCreate,
  collectionUpdate,
  collectionDelete,
} from "@/services/tauriCommands";

// ─── Module-level cache ───────────────────────────────────────────────────────

const CACHE_TTL_MS = 30_000;

let _cache: Collection[] | null = null;
let _cacheAt = 0;
let _inflight: Promise<Collection[]> | null = null;

function invalidate() {
  _cache = null;
  _cacheAt = 0;
}

/** Fetches collections, using the module cache when fresh. Deduplicates concurrent calls. */
async function fetchCollections(): Promise<Collection[]> {
  if (_cache && Date.now() - _cacheAt < CACHE_TTL_MS) return _cache;
  if (_inflight) return _inflight;

  _inflight = collectionGetAll().then((data) => {
    _cache = data;
    _cacheAt = Date.now();
    _inflight = null;
    return data;
  }).catch((e) => {
    _inflight = null;
    throw e;
  });

  return _inflight;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

interface UseCollectionsReturn {
  collections: Collection[];
  loading: boolean;
  error: string | null;
  createCollection: (input: NewCollection) => Promise<Collection>;
  updateCollection: (id: string, input: UpdateCollection) => Promise<Collection>;
  deleteCollection: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * Loads all collections and provides CRUD operations.
 *
 * @returns State and operations for the collections list
 */
export function useCollections(): UseCollectionsReturn {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (force = false) => {
    if (force) invalidate();
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCollections();
      // Steam collections are managed exclusively in the Steam tab.
      setCollections(data.filter((c) => c.default_strategy !== "steam_game"));
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(() => load(true), [load]);

  useEffect(() => {
    load();
  }, [load]);

  const createCollection = useCallback(
    async (input: NewCollection): Promise<Collection> => {
      const created = await collectionCreate(input);
      invalidate();
      setCollections((prev) => [...prev, created]);
      return created;
    },
    []
  );

  const updateCollection = useCallback(
    async (id: string, input: UpdateCollection): Promise<Collection> => {
      const updated = await collectionUpdate(id, input);
      invalidate();
      setCollections((prev) => prev.map((c) => (c.id === id ? updated : c)));
      return updated;
    },
    []
  );

  const deleteCollection = useCallback(async (id: string): Promise<void> => {
    await collectionDelete(id);
    invalidate();
    setCollections((prev) => prev.filter((c) => c.id !== id));
  }, []);

  return {
    collections,
    loading,
    error,
    createCollection,
    updateCollection,
    deleteCollection,
    refresh,
  };
}
