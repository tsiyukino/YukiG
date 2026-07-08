/**
 * Drag-and-drop state for CollectionPage: reordering items within a level,
 * reparenting into folders/groups, dragging out to root, and reordering
 * virtual groups.
 */
import { useState, useRef, useCallback } from "react";
import { itemReorder, itemReparent } from "@/services/tauriCommands";
import { Item } from "@/types/item";

interface CollectionDndDeps {
  /** Items currently rendered in the grid (post tag-filter). */
  visibleItems: Item[];
  /** Virtual groups rendered above the grid. */
  virtualGroups: Item[];
  /** Optimistically replaces the current item list. */
  setCurrentItems: React.Dispatch<React.SetStateAction<Item[]>>;
  /** Reloads the current level from the backend. */
  refreshCurrent: () => Promise<void>;
  /** Signals GroupSections to reload their children. */
  onStructureChange: () => void;
}

/**
 * Owns all drag state for the collection view and performs the
 * reorder/reparent mutations on drag end.
 */
export function useCollectionDnd({
  visibleItems,
  virtualGroups,
  setCurrentItems,
  refreshCurrent,
  onStructureChange,
}: CollectionDndDeps) {
  // ── Item drag state ──
  const dragItemIdRef = useRef<string | null>(null);
  const dragSourceParentIdRef = useRef<string | null>(null);
  const dragIndexRef = useRef<number | null>(null);
  const dropTargetGroupIdRef = useRef<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [draggingItemId, setDraggingItemId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [dropTargetGroupId, setDropTargetGroupId] = useState<string | null>(null);
  const [dropTargetIsRoot, setDropTargetIsRoot] = useState(false);

  // ── Group drag state ──
  const groupDragIndexRef = useRef<number | null>(null);
  const [draggingGroupId, setDraggingGroupId] = useState<string | null>(null);
  const [groupDragOverIndex, setGroupDragOverIndex] = useState<number | null>(null);

  const startItemDrag = useCallback((item: Item, index: number, sourceParentId: string | null) => {
    dragItemIdRef.current = item.id;
    dragSourceParentIdRef.current = sourceParentId;
    dragIndexRef.current = index;
    dropTargetGroupIdRef.current = null;
    setDraggingItemId(item.id);
  }, []);

  /** Marks a GroupSection as the reparent target (cleared on leave). */
  const hoverGroup = useCallback((groupId: string | null) => {
    dropTargetGroupIdRef.current = groupId;
    setDropTargetGroupId(groupId);
    if (groupId !== null) {
      setDropTargetId(null);
      setDragOverIndex(null);
      setDropTargetIsRoot(false);
    }
  }, []);

  /** Marks the root drop zone as the target. */
  const hoverRoot = useCallback((active: boolean) => {
    setDropTargetIsRoot(active);
    if (active) {
      setDropTargetId(null);
      setDragOverIndex(null);
    }
  }, []);

  /** Marks a folder card (reparent) or a slot index (reorder) as the target. */
  const hoverItem = useCallback((item: Item, index: number, isFolder: boolean) => {
    if (isFolder) {
      setDropTargetId(item.id);
      setDragOverIndex(null);
    } else {
      setDragOverIndex(index);
      setDropTargetId(null);
    }
  }, []);

  /**
   * Called on the dragged element's onDragEnd — acts on whatever destination
   * state was set during the drag.
   */
  async function endItemDrag() {
    const itemId = dragItemIdRef.current;
    const from = dragIndexRef.current;
    const targetFolderId = dropTargetId;                 // folder/group card being hovered
    const targetGroupId = dropTargetGroupIdRef.current;  // GroupSection being hovered
    const toIndex = dragOverIndex;
    const toRoot = dropTargetIsRoot;
    const sourceParentId = dragSourceParentIdRef.current;

    // Clear all drag state immediately
    dragItemIdRef.current = null;
    dragSourceParentIdRef.current = null;
    dragIndexRef.current = null;
    dropTargetGroupIdRef.current = null;
    setDragOverIndex(null);
    setDraggingItemId(null);
    setDropTargetId(null);
    setDropTargetGroupId(null);
    setDropTargetIsRoot(false);

    if (!itemId) return;

    // Priority 1: dropped onto a folder/group card
    if (targetFolderId && targetFolderId !== itemId) {
      await itemReparent(itemId, targetFolderId).catch(() => {});
      await refreshCurrent();
      onStructureChange();
      return;
    }

    // Priority 2: dropped onto a GroupSection header area
    if (targetGroupId && targetGroupId !== itemId) {
      await itemReparent(itemId, targetGroupId).catch(() => {});
      await refreshCurrent();
      onStructureChange();
      return;
    }

    // Priority 3: dropped onto the root zone (drag-out)
    if (toRoot && sourceParentId !== null) {
      await itemReparent(itemId, null).catch(() => {});
      await refreshCurrent();
      onStructureChange();
      return;
    }

    // Priority 4: reorder within the same level
    if (from !== null && toIndex !== null && from !== toIndex) {
      const next = [...visibleItems];
      const [moved] = next.splice(from, 1);
      next.splice(toIndex, 0, moved);
      setCurrentItems(next);
      await itemReorder(next.map((it, i) => [it.id, i])).catch(() => {});
    }
  }

  const startGroupDrag = useCallback((groupId: string, index: number) => {
    groupDragIndexRef.current = index;
    setDraggingGroupId(groupId);
  }, []);

  async function endGroupDrag() {
    const from = groupDragIndexRef.current;
    const toIndex = groupDragOverIndex;
    groupDragIndexRef.current = null;
    setDraggingGroupId(null);
    setGroupDragOverIndex(null);
    if (from === null || toIndex === null || from === toIndex) return;
    const next = [...virtualGroups];
    const [moved] = next.splice(from, 1);
    next.splice(toIndex, 0, moved);
    // Optimistically update currentItems to reflect new group order
    setCurrentItems((prev) => {
      const nonGroups = prev.filter((it) => it.strategy_type !== "virtual_group");
      return [...next, ...nonGroups];
    });
    await itemReorder(next.map((it, i) => [it.id, i])).catch(() => {});
  }

  return {
    // item drag
    draggingItemId, dragOverIndex, dropTargetId, dropTargetGroupId, dropTargetIsRoot,
    dragIndexRef, dragSourceParentIdRef,
    startItemDrag, endItemDrag, hoverItem, hoverGroup, hoverRoot,
    // group drag
    draggingGroupId, groupDragOverIndex, setGroupDragOverIndex, groupDragIndexRef,
    startGroupDrag, endGroupDrag,
  };
}
