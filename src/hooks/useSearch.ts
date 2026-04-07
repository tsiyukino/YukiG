/**
 * Hook for global full-text search across all items. Phase 3 feature.
 */
import { useState, useCallback } from "react";
import { Item } from "@/types/item";
import { searchItems } from "@/services/tauriCommands";

interface UseSearchReturn {
  results: Item[];
  loading: boolean;
  error: string | null;
  search: (query: string) => Promise<void>;
  clear: () => void;
}

/**
 * Provides a search function that queries items using FTS5.
 *
 * @returns Search state and the `search` trigger function
 */
export function useSearch(): UseSearchReturn {
  const [results, setResults] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (query: string) => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await searchItems(query);
      setResults(data);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setResults([]);
    setError(null);
  }, []);

  return { results, loading, error, search, clear };
}
