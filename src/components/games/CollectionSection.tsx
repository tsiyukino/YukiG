import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { Collection } from "@/types/collection";
import { Item } from "@/types/item";
import { itemGetByCollection } from "@/services/tauriCommands";
import FileItem from "@/components/games/FileItem";

interface CollectionSectionProps {
  /** The collection this section represents. */
  collection: Collection;
}

/**
 * Expandable accordion section for a single collection in the List view of GamesPage.
 * Lazy-loads items on first expand and renders them as FileItem rows.
 */
export default function CollectionSection({ collection }: CollectionSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const navigate = useNavigate();

  async function handleToggle() {
    if (!expanded && items.length === 0) {
      setItemsLoading(true);
      try {
        const data = await itemGetByCollection(collection.id);
        setItems(data);
      } finally {
        setItemsLoading(false);
      }
    }
    setExpanded((v) => !v);
  }

  return (
    <div className="cs">
      <button className="cs-header" onClick={handleToggle}>
        <ChevronRight
          size={14}
          className={`cs-chevron ${expanded ? "cs-chevron--open" : ""}`}
          color={collection.color}
        />
        <span className="cs-dot" style={{ background: collection.color }} />
        <span className="cs-name">{collection.name}</span>
        {collection.description && (
          <span className="cs-desc">{collection.description}</span>
        )}
        <button
          className="cs-open-btn"
          onClick={(e) => { e.stopPropagation(); navigate(`/collections/${collection.id}`); }}
          title="Open collection"
        >
          Open
        </button>
      </button>

      {expanded && (
        <div className="cs-items">
          {itemsLoading ? (
            <span className="cs-loading">Loading…</span>
          ) : items.length === 0 ? (
            <span className="cs-empty">No items in this collection.</span>
          ) : (
            items.map((item) => <FileItem key={item.id} item={item} collection={collection} />)
          )}
        </div>
      )}

      <style>{`
        .cs { border: 1px solid var(--color-border); border-radius: var(--radius-md); overflow: hidden; }
        .cs-header { display: flex; align-items: center; gap: var(--space-2); width: 100%; padding: var(--space-3) var(--space-4); background: var(--color-bg-secondary); text-align: left; transition: background var(--transition-fast); cursor: pointer; }
        .cs-header:hover { background: var(--color-bg-tertiary); }
        .cs-chevron { transition: transform var(--transition-fast); flex-shrink: 0; }
        .cs-chevron--open { transform: rotate(90deg); }
        .cs-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .cs-name { font-size: 13.5px; font-weight: 600; color: var(--color-text-primary); }
        .cs-desc { font-size: 12px; color: var(--color-text-muted); margin-left: var(--space-1); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; min-width: 0; }
        .cs-open-btn { margin-left: auto; flex-shrink: 0; font-size: 11.5px; color: var(--color-accent); padding: 2px 8px; border: 1px solid var(--color-accent); border-radius: var(--radius-sm); opacity: 0; transition: opacity var(--transition-fast); }
        .cs-header:hover .cs-open-btn { opacity: 1; }
        .cs-items { border-top: 1px solid var(--color-border); display: flex; flex-direction: column; }
        .cs-loading, .cs-empty { padding: var(--space-3) var(--space-6); font-size: 12.5px; color: var(--color-text-muted); }
      `}</style>
    </div>
  );
}
