/**
 * Bulk-selection state and actions for CollectionPage:
 * selection mode, selected ids, bulk delete, and bulk tag assign/remove/create.
 */
import { useState, useEffect, useMemo, useCallback } from "react";
import { tagGetAll, tagAssign, tagRemove, tagCreate, itemDelete } from "@/services/tauriCommands";
import { Item } from "@/types/item";
import { Tag } from "@/types/tag";
import { randomTagColor } from "@/utils/colorPalettes";

interface BulkActionsDeps {
  /** Items currently visible — used by "select all". */
  visibleItems: Item[];
  /** Map of item id → assigned tags, for computing shared tags. */
  itemTagMap: Map<string, Tag[]>;
  /** Refreshes the current item list after deletions. */
  refreshCurrent: () => Promise<void>;
  /** Refreshes the item→tag map after tag mutations. */
  refreshTags: () => void;
}

/**
 * Owns bulk-selection state for a collection view.
 */
export function useBulkActions({ visibleItems, itemTagMap, refreshCurrent, refreshTags }: BulkActionsDeps) {
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [bulkTagBusy, setBulkTagBusy] = useState<string | null>(null);

  // Fetch all tags once on mount (used for the bulk-tag dropdown)
  useEffect(() => {
    tagGetAll().then(setAllTags).catch(() => {});
  }, []);

  const toggleSelect = useCallback((itemId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(
      visibleItems
        .filter((it) => it.strategy_type !== "virtual_folder" && it.strategy_type !== "folder")
        .map((it) => it.id)
    ));
  }, [visibleItems]);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  // Tags shared by every selected item — offered for removal in the dropdown
  const sharedTagIds = useMemo(() => {
    if (selectedIds.size === 0) return new Set<string>();
    const idArr = [...selectedIds];
    const firstTags = new Set((itemTagMap.get(idArr[0]) ?? []).map((t) => t.id));
    for (let i = 1; i < idArr.length; i++) {
      const tags = new Set((itemTagMap.get(idArr[i]) ?? []).map((t) => t.id));
      for (const tid of firstTags) {
        if (!tags.has(tid)) firstTags.delete(tid);
      }
    }
    return firstTags;
  }, [selectedIds, itemTagMap]);

  async function bulkDelete() {
    if (selectedIds.size === 0) return;
    setBulkDeleting(true);
    try {
      for (const itemId of selectedIds) {
        await itemDelete(itemId).catch(() => {});
      }
      setSelectedIds(new Set());
      await refreshCurrent();
      refreshTags();
    } finally {
      setBulkDeleting(false);
    }
  }

  /** Assigns a tag to all selected items; skips items that already have it. */
  async function bulkTagAssign(tagId: string) {
    setBulkTagBusy(tagId);
    try {
      await Promise.all([...selectedIds].map((itemId) => tagAssign(itemId, tagId).catch(() => {})));
      refreshTags();
    } finally {
      setBulkTagBusy(null);
    }
  }

  /** Removes a tag from all selected items. */
  async function bulkTagRemove(tagId: string) {
    setBulkTagBusy(tagId);
    try {
      await Promise.all([...selectedIds].map((itemId) => tagRemove(itemId, tagId).catch(() => {})));
      refreshTags();
    } finally {
      setBulkTagBusy(null);
    }
  }

  /** Creates a new tag and immediately assigns it to all selected items. */
  async function bulkTagCreate(name: string) {
    setBulkTagBusy("new");
    try {
      const newTag = await tagCreate(name, randomTagColor());
      setAllTags((prev) => [...prev, newTag].sort((a, b) => a.name.localeCompare(b.name)));
      await Promise.all([...selectedIds].map((itemId) => tagAssign(itemId, newTag.id).catch(() => {})));
      refreshTags();
    } finally {
      setBulkTagBusy(null);
    }
  }

  return {
    selectionMode, setSelectionMode, exitSelectionMode,
    selectedIds, toggleSelect, selectAll, clearSelection,
    bulkDeleting, bulkDelete,
    allTags, sharedTagIds, bulkTagBusy,
    bulkTagAssign, bulkTagRemove, bulkTagCreate,
  };
}
