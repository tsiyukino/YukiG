/**
 * Hook for strategy-specific operations on an item.
 *
 * Fetches strategy metadata, display items, and the launch action for a
 * given item. Designed to be used in the ItemDetailPage and strategy views.
 *
 * @param itemId - The item UUID
 * @param folderPath - Absolute path to the item's folder
 * @param strategyType - Strategy identifier (e.g., "game", "document")
 */
import { useState, useEffect, useCallback } from "react";
import {
  strategyGetMetadata,
  strategyGetDisplayItems,
  strategyGetLaunchAction,
  strategyScan,
} from "@/services/tauriCommands";
import { DisplayItem, LaunchAction } from "@/types/strategy";

interface UseStrategyResult {
  /** Key-value metadata stored for this item. */
  metadata: Record<string, string>;
  /** Files/folders to display, filtered by the strategy. */
  displayItems: DisplayItem[];
  /** The primary launch action for this item, or null if none. */
  launchAction: LaunchAction | null;
  loading: boolean;
  error: string | null;
  /** Re-runs the strategy scan and refreshes all data. */
  rescan: () => Promise<void>;
}

export function useStrategy(
  itemId: string,
  folderPath: string,
  strategyType: string
): UseStrategyResult {
  const [metadata, setMetadata] = useState<Record<string, string>>({});
  const [displayItems, setDisplayItems] = useState<DisplayItem[]>([]);
  const [launchAction, setLaunchAction] = useState<LaunchAction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [meta, items, action] = await Promise.all([
        strategyGetMetadata(itemId),
        strategyGetDisplayItems(folderPath, strategyType),
        strategyGetLaunchAction(itemId, folderPath, strategyType),
      ]);
      setMetadata(meta);
      setDisplayItems(items);
      setLaunchAction(action);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [itemId, folderPath, strategyType]);

  useEffect(() => {
    load();
  }, [load]);

  const rescan = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await strategyScan(itemId, folderPath, strategyType);
      await load();
    } catch (e) {
      setError(String(e));
      setLoading(false);
    }
  }, [itemId, folderPath, strategyType, load]);

  return { metadata, displayItems, launchAction, loading, error, rescan };
}
