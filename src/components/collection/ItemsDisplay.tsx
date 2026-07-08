/**
 * Item rendering for the collection view: list, grid, or gallery mode,
 * with drag-to-reorder slots and folder drop targets wired to the
 * useCollectionDnd hook.
 */
import { Collection } from "@/types/collection";
import { Item } from "@/types/item";
import { Tag } from "@/types/tag";
import { useCollectionDnd } from "@/hooks/useCollectionDnd";
import ItemCard from "@/components/common/ItemCard";
import GalleryItemCard from "@/components/common/GalleryItemCard";
import ListItemRow from "@/components/common/ListItemRow";
import VirtualFolderCard from "@/components/collection/VirtualFolderCard";
import GalleryFolderCard from "@/components/collection/GalleryFolderCard";
import { ItemViewMode } from "@/components/collection/CollectionHeader";
import styles from "./ItemsDisplay.module.css";

function isFolderType(item: Item): boolean {
  return item.strategy_type === "virtual_folder" || item.strategy_type === "folder";
}

interface ItemsDisplayProps {
  items: Item[];
  viewMode: ItemViewMode;
  collection: Collection;
  itemTagMap: Map<string, Tag[]>;
  /** Parent id used as the drag source (null at root). */
  currentFolderId: string | null;
  dnd: ReturnType<typeof useCollectionDnd>;
  selectionMode: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (itemId: string) => void;
  onOpenFolder: (item: Item) => void;
  onItemClick: (item: Item) => void;
  onDelete: (item: Item) => void;
}

/**
 * Renders the collection's non-group items in the active view mode.
 */
export default function ItemsDisplay({
  items,
  viewMode,
  collection,
  itemTagMap,
  currentFolderId,
  dnd,
  selectionMode,
  selectedIds,
  onToggleSelect,
  onOpenFolder,
  onItemClick,
  onDelete,
}: ItemsDisplayProps) {
  if (viewMode === "list") {
    return (
      <div className={styles.list}>
        {items.map((item) =>
          isFolderType(item) ? (
            <VirtualFolderCard
              key={item.id}
              item={item}
              collectionColor={collection.color}
              onClick={() => onOpenFolder(item)}
              onDelete={(e) => { e.stopPropagation(); onDelete(item); }}
            />
          ) : (
            <ListItemRow
              key={item.id}
              item={item}
              collectionColor={collection.color}
              tags={itemTagMap.get(item.id) ?? []}
              onClick={() => onItemClick(item)}
              onDelete={(e) => { e.stopPropagation(); onDelete(item); }}
              selected={selectedIds.has(item.id)}
              onSelect={selectionMode ? (e) => { e.stopPropagation(); onToggleSelect(item.id); } : undefined}
            />
          )
        )}
      </div>
    );
  }

  return (
    <div className={viewMode === "gallery" ? styles.gallery : styles.grid}>
      {items.map((item, index) => {
        const folder = isFolderType(item);
        const dragging = dnd.draggingItemId === item.id;
        const isDropTarget = dnd.dropTargetId === item.id;
        const showSlotBefore =
          dnd.dragOverIndex === index && dnd.draggingItemId !== null &&
          dnd.dragIndexRef.current !== index && dnd.dragOverIndex < (dnd.dragIndexRef.current ?? -1);
        const showSlotAfter =
          dnd.dragOverIndex === index && dnd.draggingItemId !== null &&
          dnd.dragIndexRef.current !== index && dnd.dragOverIndex > (dnd.dragIndexRef.current ?? -1);

        return (
          <div key={item.id} className={styles.dragWrapper}>
            {showSlotBefore && <div className={styles.dropSlot} />}
            <div
              draggable
              onDragStart={(e) => { e.dataTransfer.setData("text/plain", item.id); dnd.startItemDrag(item, index, currentFolderId); }}
              onDragEnter={(e) => { e.preventDefault(); dnd.hoverItem(item, index, folder); }}
              onDragOver={(e) => e.preventDefault()}
              onDragEnd={dnd.endItemDrag}
              className={[
                styles.dragItem,
                dragging ? styles.dragging : "",
                isDropTarget ? styles.dropTarget : "",
              ].filter(Boolean).join(" ")}
            >
              {folder ? (
                viewMode === "gallery" ? (
                  <GalleryFolderCard
                    item={item}
                    collectionColor={collection.color}
                    onClick={() => onOpenFolder(item)}
                    onDelete={(e) => { e.stopPropagation(); onDelete(item); }}
                  />
                ) : (
                  <VirtualFolderCard
                    item={item}
                    collectionColor={collection.color}
                    onClick={() => onOpenFolder(item)}
                    onDelete={(e) => { e.stopPropagation(); onDelete(item); }}
                  />
                )
              ) : viewMode === "gallery" ? (
                <GalleryItemCard
                  item={item}
                  collectionColor={collection.color}
                  tags={itemTagMap.get(item.id) ?? []}
                  onClick={() => onItemClick(item)}
                  onDelete={(e) => { e.stopPropagation(); onDelete(item); }}
                  selected={selectedIds.has(item.id)}
                  onSelect={selectionMode ? (e) => { e.stopPropagation(); onToggleSelect(item.id); } : undefined}
                />
              ) : (
                <ItemCard
                  item={item}
                  collectionColor={collection.color}
                  tags={itemTagMap.get(item.id) ?? []}
                  onClick={() => onItemClick(item)}
                  onDelete={(e) => { e.stopPropagation(); onDelete(item); }}
                  selected={selectedIds.has(item.id)}
                  onSelect={selectionMode ? (e) => { e.stopPropagation(); onToggleSelect(item.id); } : undefined}
                />
              )}
            </div>
            {showSlotAfter && <div className={styles.dropSlot} />}
          </div>
        );
      })}
    </div>
  );
}
