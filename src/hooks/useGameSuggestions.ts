/**
 * Hook owning the scanned path suggestions (executables, mod folders,
 * screenshot folders) for a game folder, with incremental depth loading.
 *
 * Shared by the add-item flow and the edit-item modal so both pick exes from
 * the same scan. Pass `null` to disable (non-game items); suggestions reset
 * whenever the folder changes.
 */
import { useState, useEffect, useCallback } from "react";
import { gameSuggestPaths, GameSuggestions } from "@/services/tauriCommands";

/** Deepest directory level the suggestion scan will walk. */
const MAX_SUGGEST_DEPTH = 4;

interface UseGameSuggestionsReturn {
  suggestions: GameSuggestions | null;
  /** Scans one directory layer deeper and appends the results. */
  loadMore: () => Promise<void>;
  loadingMore: boolean;
  /** True once the maximum scan depth has been reached. */
  maxDepthReached: boolean;
}

/**
 * Fetches root-level suggestions for `folderPath` (fast, covers most games)
 * and exposes on-demand deeper scanning.
 */
export function useGameSuggestions(folderPath: string | null): UseGameSuggestionsReturn {
  const [suggestions, setSuggestions] = useState<GameSuggestions | null>(null);
  const [depth, setDepth] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [maxDepthReached, setMaxDepthReached] = useState(false);

  useEffect(() => {
    setDepth(0);
    setMaxDepthReached(false);
    if (!folderPath) {
      setSuggestions(null);
      return;
    }
    gameSuggestPaths(folderPath, 0).then(setSuggestions).catch(() => setSuggestions(null));
  }, [folderPath]);

  const loadMore = useCallback(async () => {
    if (!folderPath || loadingMore || maxDepthReached) return;
    const nextDepth = depth + 1;
    if (nextDepth > MAX_SUGGEST_DEPTH) { setMaxDepthReached(true); return; }
    setLoadingMore(true);
    try {
      const more = await gameSuggestPaths(folderPath, nextDepth);
      setDepth(nextDepth);
      if (nextDepth >= MAX_SUGGEST_DEPTH) setMaxDepthReached(true);
      // Append the new layer's results to what's already shown.
      setSuggestions((prev) => prev ? {
        executables: [...prev.executables, ...more.executables],
        mod_folders: [...prev.mod_folders, ...more.mod_folders],
        screenshot_folders: [...prev.screenshot_folders, ...more.screenshot_folders],
      } : more);
    } catch { /* non-fatal — deeper scan simply not shown */ } finally {
      setLoadingMore(false);
    }
  }, [folderPath, depth, loadingMore, maxDepthReached]);

  return { suggestions, loadMore, loadingMore, maxDepthReached };
}
