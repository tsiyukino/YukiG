/**
 * Draggable list of virtual-group sections in the collection view.
 * Handles group reordering; item-level drops onto groups are delegated
 * to GroupSection via the dnd hook's hover callbacks.
 */
import { Collection } from "@/types/collection";
import { Item } from "@/types/item";
import { Tag } from "@/types/tag";
import { useCollectionDnd } from "@/hooks/useCollectionDnd";
import GroupSection from "@/components/collection/GroupSection";
import { ItemViewMode } from "@/components/collection/CollectionHeader";
import styles from "./GroupList.module.css";

interface GroupListProps {
  groups: Item[];
  collection: Collection;
  collectionId: string;
  itemTagMap: Map<string, Tag[]>;
  viewMode: ItemViewMode;
  refreshKey: number;
  dnd: ReturnType<typeof useCollectionDnd>;
  selectionMode: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (itemId: string) => void;
  onItemClick: (item: Item) => void;
  onDelete: (item: Item) => void;
  onChildMoved: () => void;
}

/**
 * Renders the virtual groups with drag-to-reorder slots.
 */
export default function GroupList({
  groups,
  collection,
  collectionId,
  itemTagMap,
  viewMode,
  refreshKey,
  dnd,
  selectionMode,
  selectedIds,
  onToggleSelect,
  onItemClick,
  onDelete,
  onChildMoved,
}: GroupListProps) {
  return (
    <>
      {groups.map((group, index) => {
        const from = dnd.groupDragIndexRef.current;
        const showSlotBefore =
          dnd.groupDragOverIndex === index && dnd.draggingGroupId !== null &&
          from !== index && dnd.groupDragOverIndex < (from ?? -1);
        const showSlotAfter =
          dnd.groupDragOverIndex === index && dnd.draggingGroupId !== null &&
          from !== index && dnd.groupDragOverIndex > (from ?? -1);

        return (
          <div key={group.id} className={styles.dragWrapper}>
            {showSlotBefore && <div className={styles.dropSlot} />}
            <div
              className={dnd.draggingGroupId === group.id ? `${styles.dragItem} ${styles.dragging}` : styles.dragItem}
              draggable
              onDragStart={(e) => { e.dataTransfer.setData("text/plain", group.id); dnd.startGroupDrag(group.id, index); }}
              onDragEnter={(e) => { e.preventDefault(); dnd.setGroupDragOverIndex(index); }}
              onDragOver={(e) => e.preventDefault()}
              onDragEnd={dnd.endGroupDrag}
            >
              <GroupSection
                group={group}
                collectionId={collectionId}
                defaultStrategy={collection.default_strategy}
                collectionColor={collection.color}
                itemTagMap={itemTagMap}
                viewMode={viewMode}
                refreshKey={refreshKey}
                onItemClick={onItemClick}
                onItemDelete={onDelete}
                onGroupDelete={() => onDelete(group)}
                onDragOverGroup={(gid) => { if (dnd.draggingGroupId !== null) return; dnd.hoverGroup(gid); }}
                onDragLeaveGroup={() => dnd.hoverGroup(null)}
                isDropTarget={dnd.dropTargetGroupId === group.id}
                onChildMoved={onChildMoved}
                selectionMode={selectionMode}
                selectedIds={selectedIds}
                onToggleSelect={onToggleSelect}
              />
            </div>
            {showSlotAfter && <div className={styles.dropSlot} />}
          </div>
        );
      })}
    </>
  );
}
