/**
 * Hook for loading and managing tags. Phase 3 feature.
 */
import { useState, useEffect, useCallback } from "react";
import { Tag } from "@/types/tag";
import { tagGetAll, tagCreate } from "@/services/tauriCommands";

interface UseTagsReturn {
  tags: Tag[];
  loading: boolean;
  error: string | null;
  createTag: (name: string, color: string) => Promise<Tag>;
  refresh: () => Promise<void>;
}

/**
 * Loads all tags and provides create operation.
 *
 * @returns State and operations for the tags list
 */
export function useTags(): UseTagsReturn {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await tagGetAll();
      setTags(data);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createTag = useCallback(async (name: string, color: string): Promise<Tag> => {
    const created = await tagCreate(name, color);
    setTags((prev) => [...prev, created]);
    return created;
  }, []);

  return { tags, loading, error, createTag, refresh };
}
