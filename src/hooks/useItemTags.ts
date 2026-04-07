/**
 * Hook for loading and managing tags on a specific item.
 */
import { useState, useEffect, useCallback } from "react";
import { Tag } from "@/types/tag";
import { tagGetByItem, tagAssign, tagRemove } from "@/services/tauriCommands";

interface UseItemTagsReturn {
  tags: Tag[];
  loading: boolean;
  error: string | null;
  assign: (tagId: string) => Promise<void>;
  remove: (tagId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * Loads all tags assigned to an item and provides assign/remove operations.
 *
 * @param itemId - The item UUID to load tags for
 * @returns State and operations for this item's tags
 */
export function useItemTags(itemId: string): UseItemTagsReturn {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await tagGetByItem(itemId);
      setTags(data);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [itemId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const assign = useCallback(
    async (tagId: string) => {
      await tagAssign(itemId, tagId);
      await refresh();
    },
    [itemId, refresh]
  );

  const remove = useCallback(
    async (tagId: string) => {
      await tagRemove(itemId, tagId);
      setTags((prev) => prev.filter((t) => t.id !== tagId));
    },
    [itemId]
  );

  return { tags, loading, error, assign, remove, refresh };
}
