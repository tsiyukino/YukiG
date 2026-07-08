/**
 * Browse state for CollectionPage: the collection record, current item list
 * (root or inside a virtual folder), breadcrumb stack, tag map + filter,
 * and the pinned favorites list.
 */
import { useState, useEffect, useMemo, useCallback } from "react";
import { useItems } from "@/hooks/useItems";
import {
  collectionGetById,
  tagGetByCollection,
  itemGetByParent,
  itemGetFavorites,
  ItemTagRow,
} from "@/services/tauriCommands";
import { Collection } from "@/types/collection";
import { Item } from "@/types/item";
import { Tag } from "@/types/tag";

/** One level of virtual-folder navigation. */
export interface BreadcrumbEntry {
  item: Item;
  /** Items loaded at this folder level. */
  items: Item[];
}

/**
 * Loads and exposes everything CollectionPage needs to browse a collection.
 */
export function useCollectionBrowse(collectionId: string) {
  const [collection, setCollection] = useState<Collection | null>(null);
  const [collectionError, setCollectionError] = useState<string | null>(null);
  const { items: rootItems, loading, error, refresh: refreshRoot } = useItems(collectionId);

  // Current items displayed (root or inside a virtual folder)
  const [currentItems, setCurrentItems] = useState<Item[]>([]);
  // Breadcrumb stack — each entry represents a virtual_folder we've navigated into
  const [folderStack, setFolderStack] = useState<BreadcrumbEntry[]>([]);
  const isAtRoot = folderStack.length === 0;
  const currentFolder = isAtRoot ? null : folderStack[folderStack.length - 1].item;

  const [itemTagRows, setItemTagRows] = useState<ItemTagRow[]>([]);
  const [activeTagIds, setActiveTagIds] = useState<Set<string>>(new Set());
  const [favoriteItems, setFavoriteItems] = useState<Item[]>([]);

  useEffect(() => {
    collectionGetById(collectionId)
      .then(setCollection)
      .catch((e) => setCollectionError(String(e)));
  }, [collectionId]);

  // Sync currentItems from rootItems when at root
  useEffect(() => {
    if (isAtRoot) setCurrentItems(rootItems);
  }, [rootItems, isAtRoot]);

  // Reload item-tag map whenever rootItems change
  useEffect(() => {
    if (rootItems.length === 0) { setItemTagRows([]); return; }
    tagGetByCollection(collectionId).then(setItemTagRows).catch(() => {});
  }, [collectionId, rootItems]);

  // Favorited items fetched directly from DB — includes items inside groups/folders.
  useEffect(() => {
    itemGetFavorites(collectionId).then(setFavoriteItems).catch(() => setFavoriteItems([]));
  }, [collectionId, rootItems]); // re-fetch whenever rootItems reload (covers navigate-back)

  /** Re-fetches the item→tags map (call after tag mutations). */
  const refreshTags = useCallback(() => {
    tagGetByCollection(collectionId).then(setItemTagRows).catch(() => {});
  }, [collectionId]);

  const itemTagMap = useMemo(() => {
    const map = new Map<string, Tag[]>();
    for (const row of itemTagRows) {
      const existing = map.get(row.item_id) ?? [];
      existing.push({ id: row.tag_id, name: row.tag_name, color: row.tag_color, group_id: null, tag_type: "regular" });
      map.set(row.item_id, existing);
    }
    return map;
  }, [itemTagRows]);

  const collectionTags = useMemo(() => {
    const seen = new Map<string, Tag>();
    for (const row of itemTagRows) {
      if (!seen.has(row.tag_id)) {
        seen.set(row.tag_id, { id: row.tag_id, name: row.tag_name, color: row.tag_color, group_id: null, tag_type: "regular" });
      }
    }
    return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [itemTagRows]);

  // Non-group items for the filter (virtual_groups are excluded since they act as containers)
  const visibleItems = useMemo(() => {
    const base = currentItems.filter((item) => item.strategy_type !== "virtual_group");
    if (activeTagIds.size === 0) return base;
    return base.filter((item) => {
      const tags = itemTagMap.get(item.id) ?? [];
      const tagIds = new Set(tags.map((t) => t.id));
      return [...activeTagIds].every((tid) => tagIds.has(tid));
    });
  }, [currentItems, itemTagMap, activeTagIds]);

  const virtualGroups = useMemo(
    () => currentItems.filter((item) => item.strategy_type === "virtual_group"),
    [currentItems]
  );

  const toggleTag = useCallback((tagId: string) => {
    setActiveTagIds((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) next.delete(tagId);
      else next.add(tagId);
      return next;
    });
  }, []);

  const clearTagFilter = useCallback(() => setActiveTagIds(new Set()), []);

  /** Navigate into a virtual_folder — push onto the stack and load its children. */
  const openVirtualFolder = useCallback(async (folder: Item) => {
    const children = await itemGetByParent(folder.id);
    setFolderStack((prev) => [...prev, { item: folder, items: children }]);
    setCurrentItems(children);
    setActiveTagIds(new Set());
  }, []);

  /** Navigate up the breadcrumb stack; -1 goes back to root. */
  const navigateUp = useCallback((targetDepth: number) => {
    if (targetDepth < 0) {
      setFolderStack([]);
      setCurrentItems(rootItems);
    } else {
      setFolderStack((prev) => {
        const newStack = prev.slice(0, targetDepth + 1);
        setCurrentItems(newStack[newStack.length - 1].items);
        return newStack;
      });
    }
    setActiveTagIds(new Set());
  }, [rootItems]);

  /** Refresh children of the current level after an item is added/deleted. */
  const refreshCurrent = useCallback(async () => {
    if (isAtRoot) {
      await refreshRoot();
    } else {
      const children = await itemGetByParent(currentFolder!.id);
      setCurrentItems(children);
      setFolderStack((prev) => {
        const next = [...prev];
        next[next.length - 1] = { ...next[next.length - 1], items: children };
        return next;
      });
    }
  }, [isAtRoot, currentFolder, refreshRoot]);

  return {
    collection, setCollection, collectionError,
    loading, error, refreshRoot,
    rootItems, currentItems, setCurrentItems,
    folderStack, isAtRoot, currentFolder,
    itemTagMap, collectionTags, refreshTags,
    activeTagIds, toggleTag, clearTagFilter,
    visibleItems, virtualGroups, favoriteItems,
    openVirtualFolder, navigateUp, refreshCurrent,
  };
}
