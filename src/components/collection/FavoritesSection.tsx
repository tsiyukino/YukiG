import { useState } from "react";
import { Star, ChevronDown, ChevronUp } from "lucide-react";
import { Item } from "@/types/item";
import { Tag } from "@/types/tag";
import ItemCard from "@/components/common/ItemCard";
import GalleryItemCard from "@/components/common/GalleryItemCard";
import ListItemRow from "@/components/common/ListItemRow";
import styles from "./FavoritesSection.module.css";

interface FavoritesSectionProps {
  /** All items marked is_favorite=true for this collection. */
  items: Item[];
  /** Accent color inherited from the parent collection. */
  collectionColor: string;
  /** Map of item ID → assigned tags, for rendering tag chips on cards. */
  itemTagMap: Map<string, Tag[]>;
  /** Current view mode — controls the card layout used for favorites. */
  viewMode: "grid" | "gallery" | "list";
  /** Called when an item card is clicked (navigate to detail page). */
  onItemClick: (item: Item) => void;
  /** Called when an item's delete button is clicked. */
  onItemDelete: (item: Item) => void;
}

/**
 * Virtual "Favorites" group pinned to the top of the collection view.
 * Contains a read-only snapshot of all items marked is_favorite=true.
 * Items are NOT moved here — they remain in their original positions below.
 * Collapsible via the header row.
 */
export default function FavoritesSection({
  items, collectionColor, itemTagMap, viewMode, onItemClick, onItemDelete,
}: FavoritesSectionProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className={styles.section}>
      <div className={styles.header} onClick={() => setCollapsed((c) => !c)}>
        <Star size={13} color="var(--color-accent-warm)" fill="var(--color-accent-warm)" />
        <span>Favorites</span>
        <span className={styles.count}>{items.length}</span>
        <span className={styles.chevron}>
          {collapsed ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
        </span>
      </div>
      {!collapsed && (
        <div className={styles.body}>
          {viewMode === "list" ? (
            <div className={styles.list}>
              {items.map((item) => (
                <ListItemRow
                  key={item.id}
                  item={item}
                  collectionColor={collectionColor}
                  tags={itemTagMap.get(item.id) ?? []}
                  onClick={() => onItemClick(item)}
                  onDelete={(e) => { e.stopPropagation(); onItemDelete(item); }}
                />
              ))}
            </div>
          ) : (
            <div className={viewMode === "gallery" ? styles.gallery : styles.grid}>
              {items.map((item) =>
                viewMode === "gallery" ? (
                  <GalleryItemCard
                    key={item.id}
                    item={item}
                    collectionColor={collectionColor}
                    tags={itemTagMap.get(item.id) ?? []}
                    onClick={() => onItemClick(item)}
                    onDelete={(e) => { e.stopPropagation(); onItemDelete(item); }}
                  />
                ) : (
                  <ItemCard
                    key={item.id}
                    item={item}
                    collectionColor={collectionColor}
                    tags={itemTagMap.get(item.id) ?? []}
                    onClick={() => onItemClick(item)}
                    onDelete={(e) => { e.stopPropagation(); onItemDelete(item); }}
                  />
                )
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
