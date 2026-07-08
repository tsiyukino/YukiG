import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Layers, ChevronUp, ChevronDown, Plus, Trash2 } from "lucide-react";
import { Item } from "@/types/item";
import { Tag } from "@/types/tag";
import AddItemModal from "@/pages/AddItemModal";
import GroupChildren from "@/components/collection/GroupChildren";
import { itemGetByParent, itemReparent, itemReorder } from "@/services/tauriCommands";
import styles from "./GroupSection.module.css";

type ItemViewMode = "grid" | "gallery" | "list";

interface GroupSectionProps {
  /** The virtual_group item acting as a container. */
  group: Item;
  /** ID of the parent collection (needed for AddItemModal). */
  collectionId: string;
  /** Default strategy passed down from the collection. */
  defaultStrategy: string;
  /** Accent color inherited from the parent collection. */
  collectionColor: string;
  /** Map of item ID → assigned tags, for rendering tag chips on children. */
  itemTagMap: Map<string, Tag[]>;
  /** Current view mode — controls the card layout for children. */
  viewMode: ItemViewMode;
  /** Increment to trigger a children reload (e.g. after a child is deleted). */
  refreshKey: number;
  /** Called when a child item card is clicked (navigate to detail page). */
  onItemClick: (item: Item) => void;
  /** Called when a child item's delete button is clicked. */
  onItemDelete: (item: Item) => void;
  /** Called when the group's delete button is clicked. */
  onGroupDelete: () => void;
  /** Called while an external item is dragged over this group (set as drop target). */
  onDragOverGroup: (groupId: string) => void;
  /** Called when drag leaves this group (clear drop target). */
  onDragLeaveGroup: () => void;
  /** Whether this group is currently the active drop target. */
  isDropTarget: boolean;
  /** Called when a child item is moved out so the parent can refresh. */
  onChildMoved: () => void;
  /** Whether selection mode is active (shows checkboxes on children). */
  selectionMode: boolean;
  /** Currently selected item IDs (shared with parent). */
  selectedIds: Set<string>;
  /** Toggle selection for a child item. */
  onToggleSelect: (itemId: string) => void;
}

/**
 * Renders a virtual_group as a collapsible inline section.
 * Children are fetched here; layout and drag visuals live in GroupChildren.
 */
export default function GroupSection({
  group, collectionId, defaultStrategy, collectionColor, itemTagMap, viewMode, refreshKey,
  onItemClick, onItemDelete, onGroupDelete, onDragOverGroup, onDragLeaveGroup, isDropTarget, onChildMoved,
  selectionMode, selectedIds, onToggleSelect,
}: GroupSectionProps) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(true);
  const [children, setChildren] = useState<Item[]>([]);
  const [loadingChildren, setLoadingChildren] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const loadChildren = useCallback(async () => {
    setLoadingChildren(true);
    try {
      const items = await itemGetByParent(group.id);
      setChildren(items);
    } finally {
      setLoadingChildren(false);
    }
  }, [group.id]);

  // Reload when refreshKey changes (parent signals a deletion occurred)
  useEffect(() => { loadChildren(); }, [loadChildren, refreshKey]);

  /** Persists a child reorder optimistically. */
  async function handleReorder(next: Item[]) {
    setChildren(next);
    await itemReorder(next.map((it, i) => [it.id, i])).catch(() => {});
  }

  /** Moves a child out of the group to root level. */
  async function handleMoveToRoot(childId: string) {
    await itemReparent(childId, null).catch(() => {});
    await loadChildren();
    onChildMoved();
  }

  return (
    <div
      className={isDropTarget ? `${styles.gs} ${styles.dropTarget}` : styles.gs}
      onDragOver={(e) => { e.preventDefault(); onDragOverGroup(group.id); }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) onDragLeaveGroup(); }}
    >
      <div className={styles.header}>
        <button className={styles.toggle} onClick={() => setExpanded((v) => !v)}>
          <div className={styles.toggleIcon}>
            <Layers size={13} color={collectionColor} />
          </div>
          <span className={styles.name}>{group.name}</span>
          <span className={styles.count}>{children.length}</span>
          {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
        <button className={`${styles.headerBtn} ${styles.addBtn}`} onClick={() => { setExpanded(true); setShowAdd(true); }} title="Add item to group">
          <Plus size={13} />
        </button>
        <button className={`${styles.headerBtn} ${styles.deleteBtn}`} onClick={onGroupDelete} title="Delete group">
          <Trash2 size={12} />
        </button>
      </div>

      {expanded && (
        <div className={styles.body}>
          {loadingChildren ? (
            <p className={styles.loading}>Loading…</p>
          ) : children.length === 0 ? (
            <div className={styles.emptyState}>
              <p className={styles.empty}>No items in this group yet.</p>
              <button className={styles.addFirst} onClick={() => setShowAdd(true)}>
                <Plus size={12} /> Add item
              </button>
            </div>
          ) : (
            <GroupChildren
              children={children}
              viewMode={viewMode}
              collectionColor={collectionColor}
              itemTagMap={itemTagMap}
              selectionMode={selectionMode}
              selectedIds={selectedIds}
              onToggleSelect={onToggleSelect}
              onItemClick={onItemClick}
              onItemDelete={onItemDelete}
              onReorder={handleReorder}
              onMoveToRoot={handleMoveToRoot}
            />
          )}
        </div>
      )}

      {showAdd && (
        <AddItemModal
          collectionId={collectionId}
          defaultStrategy={defaultStrategy}
          parentId={group.id}
          onSuccess={async (newItemId, strategyType) => {
            setShowAdd(false);
            await loadChildren();
            if (strategyType !== "virtual_folder" && strategyType !== "virtual_group") {
              navigate(`/collections/${collectionId}/items/${newItemId}`);
            }
          }}
          onClose={() => setShowAdd(false)}
        />
      )}
    </div>
  );
}
