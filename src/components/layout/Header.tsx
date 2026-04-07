/**
 * Custom application titlebar with context-aware search.
 *
 * Search behaviour:
 * - No prefix: scoped to the current page.
 *   - HomePage → collections only.
 *   - CollectionPage → items inside that collection only.
 * - `t>` — tags only (scoped to page context where applicable).
 * - `a>` — global search: collections + items + tags.
 * - `a,t>` — global tag search only.
 *
 * Window controls: minimize, maximize/restore, close.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { Search, Minus, Square, X } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  searchAll,
  searchItemsInCollection,
  searchItems,
  SearchAllResult,
} from "@/services/tauriCommands";
import { Collection } from "@/types/collection";
import { Item } from "@/types/item";
import { Tag } from "@/types/tag";
import { strategyLabel } from "@/utils/strategyLabel";

/** Milliseconds to wait after the last keystroke before firing the search. */
const SEARCH_DEBOUNCE_MS = 250;

/** Parsed result of the user's search prefixes. */
interface ParsedQuery {
  /** The actual search term after stripping prefixes. */
  term: string;
  /** Whether the `a>` (all) prefix was present. */
  all: boolean;
  /** Whether the `t>` (tags) prefix was present. */
  tagsOnly: boolean;
}

/** Parses `a>`, `t>`, and `a,t>` prefixes from the front of a search query. */
function parseQuery(raw: string): ParsedQuery {
  let rest = raw;
  let all = false;
  let tagsOnly = false;

  // `a,t>` is a combined prefix meaning "all + tags only" — check first so it
  // doesn't get partially consumed by the individual `a>` / `t>` checks.
  if (rest.toLowerCase().startsWith("a,t>")) {
    all = true;
    tagsOnly = true;
    rest = rest.slice(4);
  } else if (rest.toLowerCase().startsWith("a>")) {
    all = true;
    rest = rest.slice(2);
  } else if (rest.toLowerCase().startsWith("t>")) {
    tagsOnly = true;
    rest = rest.slice(2);
  }

  return { term: rest.trim(), all, tagsOnly };
}

/** Grouped results displayed in the dropdown. */
interface DropdownResults {
  collections: Collection[];
  items: Item[];
  tags: Tag[];
}

const EMPTY_RESULTS: DropdownResults = { collections: [], items: [], tags: [] };

/**
 * Frameless titlebar with drag region, context-aware live search, and window controls.
 */
export default function Header() {
  const [isMaximized, setIsMaximized] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DropdownResults>(EMPTY_RESULTS);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appWindow = getCurrentWindow();
  const navigate = useNavigate();
  const location = useLocation();

  // Derive the current collection id from the URL, if any.
  const collectionMatch = location.pathname.match(/^\/collections\/([^/]+)/);
  const currentCollectionId = collectionMatch ? collectionMatch[1] : null;
  // True when the user is on a page where the primary content is collections.
  const isHomePage = location.pathname === "/" || location.pathname === "/games";

  useEffect(() => {
    appWindow.isMaximized().then(setIsMaximized).catch(() => {});
    const unlisten = appWindow.onResized(() => {
      appWindow.isMaximized().then(setIsMaximized).catch(() => {});
    });
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  // Close dropdown when clicking outside.
  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // Close and reset when navigating to a new page.
  useEffect(() => {
    setSearchOpen(false);
    setQuery("");
    setResults(EMPTY_RESULTS);
  }, [location.pathname]);

  const runSearch = useCallback(
    async (raw: string) => {
      if (!raw.trim()) {
        setResults(EMPTY_RESULTS);
        setSearchOpen(false);
        return;
      }

      const { term, all, tagsOnly } = parseQuery(raw);
      if (!term) {
        setResults(EMPTY_RESULTS);
        setSearchOpen(false);
        return;
      }

      setSearching(true);
      try {
        let next: DropdownResults = EMPTY_RESULTS;

        if (all && tagsOnly) {
          // `a,t>` — global tag search only.
          const allRes: SearchAllResult = await searchAll(term);
          next = { collections: [], items: [], tags: allRes.tags };
        } else if (all) {
          // `a>` — global search across all types.
          const allRes: SearchAllResult = await searchAll(term);
          next = { collections: allRes.collections, items: allRes.items, tags: allRes.tags };
        } else if (isHomePage) {
          // Home page (no prefix): search collections only.
          if (tagsOnly) {
            // `t>` on home: show tags scoped to this page context (all tags, since home has no collection scope).
            const allRes: SearchAllResult = await searchAll(term);
            next = { collections: [], items: [], tags: allRes.tags };
          } else {
            const allRes: SearchAllResult = await searchAll(term);
            next = { collections: allRes.collections, items: [], tags: [] };
          }
        } else if (currentCollectionId) {
          // Inside a collection (no prefix): search items in this collection only.
          if (tagsOnly) {
            // `t>` inside collection: tags only, still no cross-collection scope.
            const allRes: SearchAllResult = await searchAll(term);
            next = { collections: [], items: [], tags: allRes.tags };
          } else {
            const items = await searchItemsInCollection(currentCollectionId, term);
            next = { collections: [], items, tags: [] };
          }
        } else {
          // Fallback (settings, search page, etc.): items globally.
          const items = await searchItems(term);
          next = { collections: [], items, tags: [] };
        }

        setResults(next);
        setSearchOpen(true);
      } catch {
        setResults(EMPTY_RESULTS);
        setSearchOpen(true);
      } finally {
        setSearching(false);
      }
    },
    [isHomePage, currentCollectionId],
  );

  function handleQueryChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(value), SEARCH_DEBOUNCE_MS);
  }

  function handleSelectItem(item: Item) {
    setSearchOpen(false);
    setQuery("");
    navigate(`/collections/${item.collection_id}/items/${item.id}`);
  }

  function handleSelectCollection(col: Collection) {
    setSearchOpen(false);
    setQuery("");
    navigate(`/collections/${col.id}`);
  }

  function handleSelectTag(tag: Tag) {
    // Navigate to global search page pre-filtered to this tag.
    setSearchOpen(false);
    setQuery("");
    navigate(`/search?tag=${encodeURIComponent(tag.id)}`);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setSearchOpen(false);
      setQuery("");
      setResults(EMPTY_RESULTS);
    }
  }

  const totalResults =
    results.collections.length + results.items.length + results.tags.length;

  const { term: displayTerm } = parseQuery(query);
  const placeholder = buildPlaceholder(isHomePage, currentCollectionId);

  async function handleMinimize() { await appWindow.minimize(); }

  async function handleMaximize() {
    if (isMaximized) { await appWindow.unmaximize(); }
    else { await appWindow.maximize(); }
    setIsMaximized(!isMaximized);
  }

  async function handleClose() { await appWindow.close(); }

  return (
    <header className="titlebar">
      <div className="titlebar-drag" data-tauri-drag-region />

      <div className="titlebar-left" data-tauri-drag-region>
        <span className="titlebar-app-name">YukiG</span>
      </div>

      <div className="titlebar-center" data-tauri-drag-region>
        <div className="titlebar-search-wrap" ref={searchContainerRef}>
          <div className="titlebar-search">
            <Search size={12} color="var(--color-text-muted)" strokeWidth={2} />
            <input
              className="titlebar-search-input"
              type="text"
              placeholder={placeholder}
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => { if (totalResults > 0) setSearchOpen(true); }}
            />
            {searching && <span className="titlebar-search-spinner" />}
            {query && (
              <button
                className="titlebar-search-clear"
                onClick={() => {
                  setQuery("");
                  setResults(EMPTY_RESULTS);
                  setSearchOpen(false);
                }}
              >
                <X size={11} strokeWidth={2.5} />
              </button>
            )}
          </div>

          {searchOpen && (
            <div className="titlebar-results">
              {totalResults === 0 ? (
                <span className="titlebar-results-empty">
                  No results for "{displayTerm || query}"
                </span>
              ) : (
                <>
                  {results.collections.length > 0 && (
                    <ResultGroup label="Collections">
                      {results.collections.slice(0, 5).map((col) => (
                        <button
                          key={col.id}
                          className="titlebar-result-row"
                          onClick={() => handleSelectCollection(col)}
                        >
                          <span
                            className="titlebar-result-dot"
                            style={{ background: col.color }}
                          />
                          <span className="titlebar-result-name">{col.name}</span>
                          <span className="titlebar-result-type">collection</span>
                        </button>
                      ))}
                    </ResultGroup>
                  )}
                  {results.items.length > 0 && (
                    <ResultGroup label="Items">
                      {results.items.slice(0, 8).map((item) => (
                        <button
                          key={item.id}
                          className="titlebar-result-row"
                          onClick={() => handleSelectItem(item)}
                        >
                          <span className="titlebar-result-name">{item.name}</span>
                          <span className="titlebar-result-type">{strategyLabel(item.strategy_type)}</span>
                        </button>
                      ))}
                    </ResultGroup>
                  )}
                  {results.tags.length > 0 && (
                    <ResultGroup label="Tags">
                      {results.tags.slice(0, 5).map((tag) => (
                        <button
                          key={tag.id}
                          className="titlebar-result-row"
                          onClick={() => handleSelectTag(tag)}
                        >
                          <span
                            className="titlebar-result-dot"
                            style={{ background: tag.color }}
                          />
                          <span className="titlebar-result-name">{tag.name}</span>
                          <span className="titlebar-result-type">tag</span>
                        </button>
                      ))}
                    </ResultGroup>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="titlebar-controls">
        <button className="titlebar-btn titlebar-btn--minimize" onClick={handleMinimize} title="Minimize">
          <Minus size={15} strokeWidth={2} />
        </button>
        <button className="titlebar-btn titlebar-btn--maximize" onClick={handleMaximize} title={isMaximized ? "Restore" : "Maximize"}>
          {isMaximized ? (
            <svg width="14" height="14" viewBox="0 0 11 11" fill="none">
              <rect x="2.5" y="0.5" width="8" height="8" rx="0.5" stroke="currentColor" strokeWidth="1.2" />
              <rect x="0.5" y="2.5" width="8" height="8" rx="0.5" stroke="currentColor" strokeWidth="1.2" fill="var(--color-bg)" />
            </svg>
          ) : (
            <Square size={14} strokeWidth={1.5} />
          )}
        </button>
        <button className="titlebar-btn titlebar-btn--close" onClick={handleClose} title="Close">
          <X size={16} strokeWidth={2} />
        </button>
      </div>

      <style>{`
        .titlebar {
          height: 48px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          background: var(--color-bg);
          border-bottom: 1px solid var(--color-border);
          position: relative;
          user-select: none;
        }
        .titlebar-drag { position: absolute; inset: 0; z-index: 0; }
        .titlebar-left {
          position: absolute; left: 0; top: 0; bottom: 0;
          display: flex; align-items: center;
          padding: 0 var(--space-4);
          z-index: 1; pointer-events: none;
        }
        .titlebar-app-name { font-size: 12px; font-weight: 600; color: var(--color-text-muted); letter-spacing: 0.01em; }
        .titlebar-center { flex: 1; display: flex; justify-content: center; align-items: center; z-index: 1; }
        .titlebar-search-wrap { position: relative; width: 320px; }
        .titlebar-search {
          display: flex; align-items: center; gap: var(--space-2);
          background: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          padding: 5px var(--space-3);
          transition: border-color var(--transition-fast);
        }
        .titlebar-search:focus-within { border-color: var(--color-accent); }
        .titlebar-search-input {
          background: none; border: none; outline: none;
          font-size: 12px; color: var(--color-text-secondary);
          flex: 1; min-width: 0;
        }
        .titlebar-search-input::placeholder { color: var(--color-text-muted); }
        .titlebar-search-spinner {
          width: 12px; height: 12px;
          border: 2px solid var(--color-border);
          border-top-color: var(--color-accent);
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
          flex-shrink: 0;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .titlebar-search-clear {
          display: flex; align-items: center; justify-content: center;
          color: var(--color-text-muted); flex-shrink: 0;
          transition: color var(--transition-fast);
        }
        .titlebar-search-clear:hover { color: var(--color-text-primary); }
        .titlebar-results {
          position: absolute;
          top: calc(100% + 4px);
          left: 0; right: 0;
          background: var(--color-bg);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          box-shadow: 0 4px 16px rgba(0,0,0,0.1);
          overflow: hidden;
          z-index: 100;
          max-height: 420px;
          overflow-y: auto;
        }
        .titlebar-results-empty {
          display: block;
          padding: var(--space-3) var(--space-4);
          font-size: 12.5px;
          color: var(--color-text-muted);
        }
        .titlebar-result-group-label {
          display: block;
          padding: var(--space-2) var(--space-3) 3px;
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--color-text-muted);
          border-top: 1px solid var(--color-border-subtle);
        }
        .titlebar-result-group-label:first-child { border-top: none; }
        .titlebar-result-row {
          display: flex; align-items: center; gap: var(--space-2);
          width: 100%;
          padding: 7px var(--space-3);
          font-size: 13px;
          text-align: left;
          transition: background var(--transition-fast);
        }
        .titlebar-result-row:hover { background: var(--color-bg-secondary); }
        .titlebar-result-dot {
          width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
        }
        .titlebar-result-name {
          flex: 1; min-width: 0;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          color: var(--color-text-primary);
        }
        .titlebar-result-type {
          font-size: 11px;
          color: var(--color-text-muted);
          text-transform: capitalize;
          flex-shrink: 0;
        }
        .titlebar-controls {
          position: absolute; right: 0; top: 0; bottom: 0;
          display: flex; align-items: stretch;
          z-index: 1;
        }
        .titlebar-btn {
          width: 46px; height: 100%;
          display: flex; align-items: center; justify-content: center;
          color: var(--color-text-secondary);
          transition: background var(--transition-fast), color var(--transition-fast);
          border-radius: 0;
        }
        .titlebar-btn:hover { background: var(--color-bg-tertiary); color: var(--color-text-primary); }
        .titlebar-btn--close:hover { background: #e81123; color: white; }
      `}</style>
    </header>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ResultGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <span className="titlebar-result-group-label">{label}</span>
      {children}
    </>
  );
}

/** Returns a context-aware placeholder string for the search box. */
function buildPlaceholder(isHome: boolean, collectionId: string | null): string {
  if (isHome) return "Search collections…  a> all";
  if (collectionId) return "Search items…  a> all";
  return "Search…  a> all";
}
