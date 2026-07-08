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
import PageTitle from "@/components/common/PageTitle";
import styles from "./SearchPage.module.css";

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
    <div className={styles.page}>
      <PageTitle
        title={pageTitle}
        subtitle={tagFilter
          ? `${items.length} item${items.length !== 1 ? "s" : ""} with this tag`
          : "Search across all collections, items, and tags."}
      />

      {/* Tag filter banner */}
      {tagFilter && (
        <div className={styles.tagBanner}>
          <TagIcon size={13} />
          <span>Showing all items tagged</span>
          <span
            className={styles.tagPill}
            style={{
              background: `${tagFilter.color}22`,
              color: tagFilter.color,
            }}
          >
            {tagFilter.name}
          </span>
          <button className={styles.tagClear} onClick={handleClearTagFilter} title="Clear tag filter">
            <X size={12} />
          </button>
        </div>
      )}

      {/* Search input — hidden when browsing by tag */}
      {!tagFilter && (
        <div className={styles.inputWrap}>
          <Search size={15} color="var(--color-text-muted)" />
          <input
            className={styles.input}
            type="text"
            placeholder="Type to search everything…"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            autoFocus
          />
          {query && (
            <button className={styles.clear} onClick={() => handleQueryChange("")}>
              <X size={13} />
            </button>
          )}
        </div>
      )}

      {/* Filter tabs — only show for text search */}
      {!tagFilter && (
        <div className={styles.filters}>
          {(["all", "collections", "items", "tags"] as FilterMode[]).map((mode) => (
            <button
              key={mode}
              className={filter === mode ? `${styles.filterBtn} ${styles.filterActive}` : styles.filterBtn}
              onClick={() => setFilter(mode)}
            >
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
              {mode === "collections" && searched && collections.length > 0 && (
                <span className={styles.filterCount}>{collections.length}</span>
              )}
              {mode === "items" && searched && items.length > 0 && (
                <span className={styles.filterCount}>{items.length}</span>
              )}
              {mode === "tags" && searched && tags.length > 0 && (
                <span className={styles.filterCount}>{tags.length}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Results */}
      <div className={styles.results}>
        {loading ? (
          <LoadingSpinner message={tagFilter ? "Loading items…" : "Searching…"} />
        ) : tagFilter ? (
          // Tag browse mode
          items.length === 0 ? (
            <div className={styles.empty}>
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
          <div className={styles.empty}>
            <Search size={32} color="var(--color-text-muted)" strokeWidth={1.5} />
            <p>Enter a search term to find collections, items, and tags.</p>
            <p className={styles.hint}>
              In the header search bar, use <code>a&gt;</code> to search all types,{" "}
              <code>t&gt;</code> for tags only, or <code>a,t&gt;</code> for tags globally.
            </p>
          </div>
        ) : totalResults === 0 ? (
          <div className={styles.empty}>
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
                <div className={styles.tagResults}>
                  {tags.map((tag) => (
                    <button
                      key={tag.id}
                      className={styles.tagResult}
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

    </div>
  );
}

function ResultSection({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionHeading}>{icon}{title}</div>
      <div className={styles.sectionRows}>{children}</div>
    </div>
  );
}

function CollectionResult({ collection, onClick }: { collection: Collection; onClick: () => void }) {
  return (
    <button className={styles.row} onClick={onClick}>
      <span className={styles.rowDot} style={{ background: collection.color }} />
      <span className={styles.rowName}>{collection.name}</span>
      {collection.description && <span className={styles.rowDesc}>{collection.description}</span>}
    </button>
  );
}

function ItemResult({ item, onClick }: { item: Item; onClick: () => void }) {
  const thumbSrc = item.thumbnail_path ? convertFileSrc(item.thumbnail_path) : null;
  return (
    <button className={styles.itemRow} onClick={onClick}>
      <div className={styles.itemIcon}>
        {thumbSrc
          ? <img src={thumbSrc} alt="" className={styles.itemThumb} />
          : <FolderOpen size={13} color="var(--color-text-muted)" />}
      </div>
      <span className={styles.rowName}>{item.name}</span>
      <span className={styles.itemType}>{strategyLabel(item.strategy_type)}</span>
    </button>
  );
}
