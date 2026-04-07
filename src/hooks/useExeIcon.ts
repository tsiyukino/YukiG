/**
 * Hook that resolves the exe icon for a game item.
 *
 * Fetches strategy metadata to find the exe_path, then calls the
 * Rust icon extractor to get a PNG data URL. Returns null while loading
 * or if the item is not a game / has no exe configured.
 *
 * @param itemId - The item UUID
 * @param strategyType - Only runs for "game" items
 */
import { useState, useEffect } from "react";
import { strategyGetMetadata, getFileIcon } from "@/services/tauriCommands";

/**
 * Returns a PNG data URL for the exe icon of a game item, or null.
 * Resolves asynchronously; starts as null until the icon is ready.
 */
export function useExeIcon(itemId: string, strategyType: string): string | null {
  const [iconSrc, setIconSrc] = useState<string | null>(null);

  useEffect(() => {
    if (strategyType !== "game") return;
    let cancelled = false;

    strategyGetMetadata(itemId)
      .then(async (meta) => {
        const exePath = meta["exe_path"];
        if (!exePath || cancelled) return;
        const icon = await getFileIcon(exePath);
        if (!cancelled) setIconSrc(icon);
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [itemId, strategyType]);

  return iconSrc;
}
