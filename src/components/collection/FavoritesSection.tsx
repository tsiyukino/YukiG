import { useState } from "react";
import { Star, ChevronDown, ChevronUp } from "lucide-react";
import { Item } from "@/types/item";
import { Tag } from "@/types/tag";
import ItemCard from "@/components/common/ItemCard";
import GalleryItemCard from "@/components/common/GalleryItemCard";
import ListItemRow from "@/components/common/ListItemRow";

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
    <div className="cp-favorites-section">
      <div className="cp-favorites-header" onClick={() => setCollapsed((c) => !c)}>
        <Star size={13} color="#f59e0b" fill="#f59e0b" />
        <span>Favorites</span>
        <span style={{ fontWeight: 400, color: "#a16207", marginLeft: 4, fontSize: 12 }}>
          {items.length}
        </span>
        <span style={{ marginLeft: "auto" }}>
          {collapsed ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
        </span>
      </div>
      {!collapsed && (
        <div className="cp-favorites-body">
          {viewMode === "list" ? (
            <div className="cp-favorites-list">
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
            <div className={viewMode === "gallery" ? "cp-favorites-gallery" : "cp-favorites-grid"}>
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
