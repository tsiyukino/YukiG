/**
 * Advanced search page — search across collections, items, and tags.
 *
 * URL params:
 * - `?q=<query>` — pre-fills the search input
 * - `?tag=<tagId>` — shows all items tagged with that tag (bypasses text search)
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Search, FolderOpen, Tag as TagIcon, LayoutGrid, X } from "lucide-react";
import { searchAll, tagGetAll, tagGetItems } from "@/services/tauriCommands";
import { Collection } from "@/types/collection";
import { Item } from "@/types/item";
import { Tag } from "@/types/tag";
import { convertFileSrc } from "@tauri-apps/api/core";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import { strategyLabel } from "@/utils/strategyLabel";

type FilterMode = "all" | "collections" | "items" | "tags";

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const initialQuery = searchParams.get("q") ?? "";
  const initialTagId = searchParams.get("tag") ?? null;

  const [query, setQuery] = useState(initialQuery);
  const [filter, setFilter] = useState<FilterMode>(initialTagId ? "items" : "all");
  const [collections, setCollections] = useState<Collection[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [tagFilter, setTagFilter] = useState<Tag | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load all tags for lookup by id.
  useEffect(() => {
    tagGetAll().then(setAllTags).catch(() => {});
  }, []);

  // When a tag id is provided via URL, load all items with that tag.
  useEffect(() => {
    if (!initialTagId || allTags.length === 0) return;
    const tag = allTags.find((t) => t.id === initialTagId) ?? null;
    setTagFilter(tag);
    setFilter("items");
    setLoading(true);
    tagGetItems(initialTagId)
      .then((data) => { setItems(data); setSearched(true); })
      .catch(() => { setItems([]); setSearched(true); })
      .finally(() => setLoading(false));
  }, [initialTagId, allTags]); // eslint-disable-line react-hooks/exhaustive-deps

  const runSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setCollections([]); setItems([]); setTags([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    setTagFilter(null);
    try {
      const res = await searchAll(q.trim());
      setCollections(res.collections);
      setItems(res.items);
      setTags(res.tags);
      setSearched(true);
    } catch {
      setCollections([]); setItems([]); setTags([]);
      setSearched(true);
    } finally {
      setLoading(false);
    }
  }, []);

  // Run search when the initial query is set from URL params.
  useEffect(() => {
    if (initialQuery) runSearch(initialQuery);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleQueryChange(value: string) {
    setQuery(value);
    setTagFilter(null);
    setSearchParams(value ? { q: value } : {});
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(value), 300);
  }

  function handleClearTagFilter() {
    setTagFilter(null);
    setItems([]);
    setSearched(false);
    setSearchParams({});
  }

  const totalResults = collections.length + items.length + tags.length;
  const pageTitle = tagFilter
    ? `Items tagged "${tagFilter.name}"`
    : "Search";

  return (
    <div className="sp2">
      <div className="sp2-header">
        <h1 className="sp2-title">{pageTitle}</h1>
        <p className="sp2-subtitle">
          {tagFilter
            ? `${items.length} item${items.length !== 1 ? "s" : ""} with this tag`
            : "Search across all collections, items, and tags."}
        </p>
      </div>

      {/* Tag filter banner */}
      {tagFilter && (
        <div className="sp2-tag-banner">
          <TagIcon size={13} />
          <span>Showing all items tagged</span>
          <span
            className="sp2-tag-pill"
            style={{
              background: `${tagFilter.color}22`,
              color: tagFilter.color,
            }}
          >
            {tagFilter.name}
          </span>
          <button className="sp2-tag-clear" onClick={handleClearTagFilter} title="Clear tag filter">
            <X size={12} />
          </button>
        </div>
      )}

      {/* Search input — hidden when browsing by tag */}
      {!tagFilter && (
        <div className="sp2-input-wrap">
          <Search size={15} color="var(--color-text-muted)" />
          <input
            className="sp2-input"
            type="text"
            placeholder="Type to search everything…"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            autoFocus
          />
          {query && (
            <button className="sp2-clear" onClick={() => handleQueryChange("")}>
              <X size={13} />
            </button>
          )}
        </div>
      )}

      {/* Filter tabs — only show for text search */}
      {!tagFilter && (
        <div className="sp2-filters">
          {(["all", "collections", "items", "tags"] as FilterMode[]).map((mode) => (
            <button
              key={mode}
              className={`sp2-filter-btn ${filter === mode ? "sp2-filter-btn--active" : ""}`}
              onClick={() => setFilter(mode)}
            >
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
              {mode === "collections" && searched && collections.length > 0 && (
                <span className="sp2-filter-count">{collections.length}</span>
              )}
              {mode === "items" && searched && items.length > 0 && (
                <span className="sp2-filter-count">{items.length}</span>
              )}
              {mode === "tags" && searched && tags.length > 0 && (
                <span className="sp2-filter-count">{tags.length}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Results */}
      <div className="sp2-results">
        {loading ? (
          <LoadingSpinner message={tagFilter ? "Loading items…" : "Searching…"} />
        ) : tagFilter ? (
          // Tag browse mode
          items.length === 0 ? (
            <div className="sp2-empty">
              <p>No items are tagged with "<strong>{tagFilter.name}</strong>".</p>
            </div>
          ) : (
            <ResultSection title="Items" icon={<FolderOpen size={13} />}>
              {items.map((item) => (
                <ItemResult
                  key={item.id}
                  item={item}
                  onClick={() => navigate(`/collections/${item.collection_id}/items/${item.id}`)}
                />
              ))}
            </ResultSection>
          )
        ) : !searched ? (
          <div className="sp2-empty">
            <Search size={32} color="var(--color-text-muted)" strokeWidth={1.5} />
            <p>Enter a search term to find collections, items, and tags.</p>
            <p className="sp2-hint">
              In the header search bar, use <code>a&gt;</code> to search all types,{" "}
              <code>t&gt;</code> for tags only, or <code>a,t&gt;</code> for tags globally.
            </p>
          </div>
        ) : totalResults === 0 ? (
          <div className="sp2-empty">
            <p>No results for "<strong>{query}</strong>".</p>
          </div>
        ) : (
          <>
            {(filter === "all" || filter === "collections") && collections.length > 0 && (
              <ResultSection title="Collections" icon={<LayoutGrid size={13} />}>
                {collections.map((col) => (
                  <CollectionResult
                    key={col.id}
                    collection={col}
                    onClick={() => navigate(`/collections/${col.id}`)}
                  />
                ))}
              </ResultSection>
            )}
            {(filter === "all" || filter === "items") && items.length > 0 && (
              <ResultSection title="Items" icon={<FolderOpen size={13} />}>
                {items.map((item) => (
                  <ItemResult
                    key={item.id}
                    item={item}
                    onClick={() => navigate(`/collections/${item.collection_id}/items/${item.id}`)}
                  />
                ))}
              </ResultSection>
            )}
            {(filter === "all" || filter === "tags") && tags.length > 0 && (
              <ResultSection title="Tags" icon={<TagIcon size={13} />}>
                <div className="sp2-tag-results">
                  {tags.map((tag) => (
                    <button
                      key={tag.id}
                      className="sp2-tag-result"
                      style={{ background: `${tag.color}22`, color: tag.color }}
                      onClick={() => {
                        setTagFilter(tag);
                        setFilter("items");
                        setSearchParams({ tag: tag.id });
                        tagGetItems(tag.id).then(setItems).catch(() => setItems([]));
                      }}
                    >
                      {tag.name}
                    </button>
                  ))}
                </div>
              </ResultSection>
            )}
          </>
        )}
      </div>

      <style>{`
        .sp2 { width: 100%; display: flex; flex-direction: column; gap: var(--space-5); }
        .sp2-header {
          position: sticky;
          top: calc(-1 * var(--space-4));
          z-index: 10;
          background: var(--color-bg);
          padding-top: var(--space-4);
          padding-bottom: var(--space-5);
          border-bottom: 1px solid var(--color-border-subtle);
          margin-bottom: calc(-1 * var(--space-5));
        }
        .sp2-title { font-size: 22px; font-weight: 700; letter-spacing: -0.025em; }
        .sp2-subtitle { font-size: 12.5px; color: var(--color-text-muted); margin-top: 2px; }

        .sp2-tag-banner {
          display: flex; align-items: center; gap: var(--space-2);
          padding: var(--space-3) var(--space-4);
          background: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          font-size: 13px; color: var(--color-text-secondary);
        }
        .sp2-tag-pill {
          padding: 2px 10px; border-radius: var(--radius-full);
          font-size: 12px; font-weight: 600;
        }
        .sp2-tag-clear {
          margin-left: auto; display: flex; align-items: center;
          color: var(--color-text-muted);
          transition: color var(--transition-fast);
        }
        .sp2-tag-clear:hover { color: var(--color-danger); }

        .sp2-input-wrap {
          display: flex; align-items: center; gap: var(--space-3);
          border: 1.5px solid var(--color-border);
          border-radius: var(--radius-md);
          padding: var(--space-3) var(--space-4);
          background: var(--color-bg-secondary);
          transition: border-color var(--transition-fast);
        }
        .sp2-input-wrap:focus-within { border-color: var(--color-accent); }
        .sp2-input {
          flex: 1; background: none; border: none; outline: none;
          font-size: 14px; color: var(--color-text-primary);
        }
        .sp2-input::placeholder { color: var(--color-text-muted); }
        .sp2-clear {
          display: flex; align-items: center; color: var(--color-text-muted);
          transition: color var(--transition-fast);
        }
        .sp2-clear:hover { color: var(--color-text-primary); }

        .sp2-filters {
          display: flex; gap: 0;
          border-bottom: 1px solid var(--color-border);
        }
        .sp2-filter-btn {
          display: flex; align-items: center; gap: 6px;
          padding: 7px 16px;
          font-size: 13px; font-weight: 500;
          color: var(--color-text-muted);
          border-bottom: 2px solid transparent;
          margin-bottom: -1px;
          transition: color var(--transition-fast), border-color var(--transition-fast);
        }
        .sp2-filter-btn:hover { color: var(--color-text-primary); }
        .sp2-filter-btn--active { color: var(--color-accent); border-bottom-color: var(--color-accent); }
        .sp2-filter-count {
          display: inline-flex; align-items: center; justify-content: center;
          min-width: 18px; height: 18px; padding: 0 5px;
          background: var(--color-bg-tertiary);
          border-radius: var(--radius-full);
          font-size: 10.5px; font-weight: 600;
          color: var(--color-text-muted);
        }
        .sp2-filter-btn--active .sp2-filter-count {
          background: var(--color-accent-light);
          color: var(--color-accent);
        }

        .sp2-results { display: flex; flex-direction: column; gap: var(--space-5); }
        .sp2-empty {
          display: flex; flex-direction: column; align-items: center;
          gap: var(--space-3); padding: 60px var(--space-8);
          text-align: center; color: var(--color-text-muted); font-size: 13.5px;
        }
        .sp2-hint {
          font-size: 12px; max-width: 400px;
          background: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          padding: var(--space-3) var(--space-4);
          line-height: 1.7;
        }
        .sp2-hint code {
          font-family: var(--font-mono); font-size: 11px;
          background: var(--color-bg-tertiary);
          padding: 1px 4px; border-radius: 3px;
        }

        .sp2-section { display: flex; flex-direction: column; gap: var(--space-2); }
        .sp2-section-heading {
          display: flex; align-items: center; gap: var(--space-2);
          font-size: 11px; font-weight: 600; text-transform: uppercase;
          letter-spacing: 0.06em; color: var(--color-text-muted);
          padding-bottom: var(--space-1);
          border-bottom: 1px solid var(--color-border-subtle);
        }
        .sp2-section-rows { display: flex; flex-direction: column; }
        .sp2-tag-results { display: flex; flex-wrap: wrap; gap: var(--space-2); padding-top: var(--space-1); }
        .sp2-tag-result {
          padding: 4px 12px; border-radius: var(--radius-full);
          font-size: 12.5px; font-weight: 500; cursor: pointer;
          transition: opacity var(--transition-fast);
        }
        .sp2-tag-result:hover { opacity: 0.8; }

        .sp2-row {
          display: flex; align-items: center; gap: var(--space-3);
          padding: var(--space-3) var(--space-2);
          border-bottom: 1px solid var(--color-border-subtle);
          text-align: left; width: 100%;
          transition: background var(--transition-fast);
          border-radius: var(--radius-sm);
        }
        .sp2-row:last-child { border-bottom: none; }
        .sp2-row:hover { background: var(--color-bg-secondary); }
        .sp2-row-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
        .sp2-row-name { font-size: 13.5px; font-weight: 500; color: var(--color-text-primary); flex-shrink: 0; }
        .sp2-row-desc { font-size: 12px; color: var(--color-text-muted); flex: 1; min-width: 0;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

        .sp2-item-row {
          display: flex; align-items: center; gap: var(--space-3);
          padding: var(--space-2) var(--space-2);
          border-bottom: 1px solid var(--color-border-subtle);
          text-align: left; width: 100%;
          transition: background var(--transition-fast);
          border-radius: var(--radius-sm);
        }
        .sp2-item-row:last-child { border-bottom: none; }
        .sp2-item-row:hover { background: var(--color-bg-secondary); }
        .sp2-item-icon {
          width: 26px; height: 26px; border-radius: var(--radius-sm);
          background: var(--color-bg-secondary); border: 1px solid var(--color-border);
          display: flex; align-items: center; justify-content: center;
          overflow: hidden; flex-shrink: 0;
        }
        .sp2-item-thumb { width: 26px; height: 26px; object-fit: cover; display: block; }
        .sp2-item-type { font-size: 11px; color: var(--color-text-muted); text-transform: capitalize; flex-shrink: 0; margin-left: auto; }
      `}</style>
    </div>
  );
}

function ResultSection({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="sp2-section">
      <div className="sp2-section-heading">{icon}{title}</div>
      <div className="sp2-section-rows">{children}</div>
    </div>
  );
}

function CollectionResult({ collection, onClick }: { collection: Collection; onClick: () => void }) {
  return (
    <button className="sp2-row" onClick={onClick}>
      <span className="sp2-row-dot" style={{ background: collection.color }} />
      <span className="sp2-row-name">{collection.name}</span>
      {collection.description && <span className="sp2-row-desc">{collection.description}</span>}
    </button>
  );
}

function ItemResult({ item, onClick }: { item: Item; onClick: () => void }) {
  const thumbSrc = item.thumbnail_path ? convertFileSrc(item.thumbnail_path) : null;
  return (
    <button className="sp2-item-row" onClick={onClick}>
      <div className="sp2-item-icon">
        {thumbSrc
          ? <img src={thumbSrc} alt="" className="sp2-item-thumb" />
          : <FolderOpen size={13} color="var(--color-text-muted)" />}
      </div>
      <span className="sp2-row-name">{item.name}</span>
      <span className="sp2-item-type">{strategyLabel(item.strategy_type)}</span>
    </button>
  );
}
