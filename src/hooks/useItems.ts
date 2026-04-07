/**
 * Hook for loading and managing items within a collection.
 */
import { useState, useEffect, useCallback } from "react";
import { Item } from "@/types/item";
import { itemGetByCollection, itemCreate, itemDelete } from "@/services/tauriCommands";

interface UseItemsReturn {
  items: Item[];
  loading: boolean;
  error: string | null;
  createItem: (
    name: string,
    folderPath: string,
    strategyType: string,
    description: string
  ) => Promise<Item>;
  deleteItem: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * Loads all items for a collection and provides CRUD operations.
 *
 * @param collectionId - The UUID of the parent collection
 * @returns State and operations for the items list
 */
export function useItems(collectionId: string): UseItemsReturn {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await itemGetByCollection(collectionId);
      setItems(data);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [collectionId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createItem = useCallback(
    async (
      name: string,
      folderPath: string,
      strategyType: string,
      description: string
    ): Promise<Item> => {
      const created = await itemCreate(collectionId, name, folderPath, strategyType, description);
      setItems((prev) => [...prev, created]);
      return created;
    },
    [collectionId]
  );

  const deleteItem = useCallback(async (id: string): Promise<void> => {
    await itemDelete(id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  return { items, loading, error, createItem, deleteItem, refresh };
}
