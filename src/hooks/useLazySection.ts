/**
 * Lazy-loading collapsible section state, shared by the game detail tab's
 * achievements / screenshots / cloud-saves sections.
 *
 * First toggle fetches the data; later toggles just collapse/expand.
 * Fetch errors are treated as "loaded empty" so the section still opens.
 */
import { useState } from "react";

export interface LazySection<T> {
  items: T[];
  setItems: React.Dispatch<React.SetStateAction<T[]>>;
  loading: boolean;
  expanded: boolean;
  loaded: boolean;
  /** Expand (fetching on first call) or collapse the section. */
  toggle: () => Promise<void>;
}

/**
 * Returns lazy section state driven by the given fetcher.
 */
export function useLazySection<T>(fetcher: () => Promise<T[]>): LazySection<T> {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [loaded, setLoaded] = useState(false);

  async function toggle() {
    if (loading) return;
    if (loaded) { setExpanded((v) => !v); return; }
    setLoading(true);
    try {
      setItems(await fetcher());
    } catch {
      // Treat as empty — the section opens and shows its empty state.
    } finally {
      setLoaded(true);
      setExpanded(true);
      setLoading(false);
    }
  }

  return { items, setItems, loading, expanded, loaded, toggle };
}
