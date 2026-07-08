/**
 * Child-item rendering for a GroupSection: list, grid, or gallery layout,
 * with drag-to-reorder slots and a "move to root" drop zone.
 * Owns only the drag visuals; data mutations happen via callbacks.
 */
import { useState, useRef } from "react";
import { FolderOpen } from "lucide-react";
import { Item } from "@/types/item";
import { Tag } from "@/types/tag";
import ItemCard from "@/components/common/ItemCard";
import GalleryItemCard from "@/components/common/GalleryItemCard";
import ListItemRow from "@/components/common/ListItemRow";
import styles from "./GroupChildren.module.css";

interface GroupChildrenProps {
  children: Item[];
  viewMode: "grid" | "gallery" | "list";
  collectionColor: string;
  itemTagMap: Map<string, Tag[]>;
  selectionMode: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (itemId: string) => void;
  onItemClick: (item: Item) => void;
  onItemDelete: (item: Item) => void;
  /** Persists a reorder of the group's children. */
  onReorder: (next: Item[]) => void;
  /** Moves a child out of the group to root level. */
  onMoveToRoot: (childId: string) => void;
}

/**
 * Renders a group's children in the active view mode with drag support.
 */
export default function GroupChildren({
  children, viewMode, collectionColor, itemTagMap,
  selectionMode, selectedIds, onToggleSelect,
  onItemClick, onItemDelete, onReorder, onMoveToRoot,
}: GroupChildrenProps) {
  const dragIndexRef = useRef<number | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [dropIsRoot, setDropIsRoot] = useState(false);

  function handleDragStart(childId: string, index: number) {
    dragIndexRef.current = index;
    setDraggingId(childId);
    setDropIsRoot(false);
  }

  function handleDragEnd() {
    const from = dragIndexRef.current;
    const toIndex = dragOverIndex;
    const toRoot = dropIsRoot;
    const draggedId = draggingId;

    dragIndexRef.current = null;
    setDraggingId(null);
    setDragOverIndex(null);
    setDropIsRoot(false);

    if (!draggedId) return;
    if (toRoot) {
      onMoveToRoot(draggedId);
      return;
    }
    if (from !== null && toIndex !== null && from !== toIndex) {
      const next = [...children];
      const [moved] = next.splice(from, 1);
      next.splice(toIndex, 0, moved);
      onReorder(next);
    }
  }

  const dragClass = (childId: string) =>
    draggingId === childId ? `${styles.dragItem} ${styles.dragging}` : styles.dragItem;

  return (
    <>
      {viewMode === "list" ? (
        <div className={styles.list}>
          {children.map((child, index) => (
            <div
              key={child.id}
              draggable
              onDragStart={(e) => { e.stopPropagation(); e.dataTransfer.setData("text/plain", child.id); handleDragStart(child.id, index); }}
              onDragEnd={handleDragEnd}
              className={dragClass(child.id)}
            >
              <ListItemRow
                item={child}
                collectionColor={collectionColor}
                tags={itemTagMap.get(child.id) ?? []}
                onClick={() => onItemClick(child)}
                onDelete={(e) => { e.stopPropagation(); onItemDelete(child); }}
                selected={selectedIds.has(child.id)}
                onSelect={selectionMode ? (e) => { e.stopPropagation(); onToggleSelect(child.id); } : undefined}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className={viewMode === "gallery" ? styles.gallery : styles.grid}>
          {children.map((child, index) => (
            <div key={child.id} className={styles.dragWrapper}>
              {dragOverIndex === index && draggingId !== null && dragIndexRef.current !== index && dragOverIndex < (dragIndexRef.current ?? -1) && (
                <div className={styles.dropSlot} />
              )}
              <div
                draggable
                onDragStart={(e) => { e.stopPropagation(); e.dataTransfer.setData("text/plain", child.id); handleDragStart(child.id, index); }}
                onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverIndex(index); setDropIsRoot(false); }}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDragEnd={handleDragEnd}
                className={dragClass(child.id)}
              >
                {viewMode === "gallery" ? (
                  <GalleryItemCard
                    item={child}
                    collectionColor={collectionColor}
                    tags={itemTagMap.get(child.id) ?? []}
                    onClick={() => onItemClick(child)}
                    onDelete={(e) => { e.stopPropagation(); onItemDelete(child); }}
                    selected={selectedIds.has(child.id)}
                    onSelect={selectionMode ? (e) => { e.stopPropagation(); onToggleSelect(child.id); } : undefined}
                  />
                ) : (
                  <ItemCard
                    item={child}
                    collectionColor={collectionColor}
                    tags={itemTagMap.get(child.id) ?? []}
                    onClick={() => onItemClick(child)}
                    onDelete={(e) => { e.stopPropagation(); onItemDelete(child); }}
                    selected={selectedIds.has(child.id)}
                    onSelect={selectionMode ? (e) => { e.stopPropagation(); onToggleSelect(child.id); } : undefined}
                  />
                )}
              </div>
              {dragOverIndex === index && draggingId !== null && dragIndexRef.current !== index && dragOverIndex > (dragIndexRef.current ?? -1) && (
                <div className={styles.dropSlot} />
              )}
            </div>
          ))}
        </div>
      )}

      {draggingId !== null && (
        <div
          className={dropIsRoot ? `${styles.rootDrop} ${styles.rootDropActive}` : styles.rootDrop}
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDropIsRoot(true); setDragOverIndex(null); }}
          onDragLeave={() => setDropIsRoot(false)}
        >
          <FolderOpen size={14} strokeWidth={1.5} />
          Drop here to move to root level
        </div>
      )}
    </>
  );
}
