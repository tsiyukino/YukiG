import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { Collection } from "@/types/collection";
import { Item } from "@/types/item";
import { itemGetByCollection } from "@/services/tauriCommands";
import FileItem from "@/components/games/FileItem";
import styles from "./CollectionSection.module.css";

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
    <div className={styles.cs}>
      {/* div with button role — a real <button> here would nest the inner
          "Open" button, which is invalid HTML */}
      <div
        className={styles.header}
        onClick={handleToggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter") handleToggle(); }}
      >
        <ChevronRight
          size={14}
          className={expanded ? `${styles.chevron} ${styles.chevronOpen}` : styles.chevron}
          color={collection.color}
        />
        <span className={styles.dot} style={{ background: collection.color }} />
        <span className={styles.name}>{collection.name}</span>
        {collection.description && (
          <span className={styles.desc}>{collection.description}</span>
        )}
        <button
          className={styles.openBtn}
          onClick={(e) => { e.stopPropagation(); navigate(`/collections/${collection.id}`); }}
          title="Open collection"
        >
          Open
        </button>
      </div>

      {expanded && (
        <div className={styles.items}>
          {itemsLoading ? (
            <span className={styles.status}>Loading…</span>
          ) : items.length === 0 ? (
            <span className={styles.status}>No items in this collection.</span>
          ) : (
            items.map((item) => <FileItem key={item.id} item={item} collection={collection} />)
          )}
        </div>
      )}
    </div>
  );
}
