/**
 * Collection view — displays all items within a single collection.
 *
 * Handles three item types:
 * - Regular items (game, document, etc.): shown as ItemCards, click → detail page
 * - virtual_folder: shown as a folder card; clicking navigates into it (breadcrumb stack)
 * - virtual_group: shown as an inline expandable section with children rendered below it
 */
import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  ArrowLeft, Plus, FolderOpen, LayoutGrid, Pencil, X, ChevronRight,
  Trash2, LayoutList, Image, CheckSquare, Tag as TagIcon,
} from "lucide-react";
import { useItems } from "@/hooks/useItems";
import { readAppPrefs } from "@/hooks/useAppPrefs";
import {
  collectionGetById,
  collectionUpdate,
  tagGetAll,
  tagGetByCollection,
  tagAssign,
  tagRemove,
  tagCreate,
  itemReorder,
  itemReparent,
  itemGetByParent,
  itemGetById,
  itemDelete,
  itemGetFavorites,
  folderDelete,
  ItemTagRow,
} from "@/services/tauriCommands";
import { Collection, NewCollection } from "@/types/collection";
import { Item } from "@/types/item";
import { Tag } from "@/types/tag";
import { ItemGridSkeleton } from "@/components/common/Skeleton";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import ItemCard from "@/components/common/ItemCard";
import GalleryItemCard from "@/components/common/GalleryItemCard";
import ListItemRow from "@/components/common/ListItemRow";
import EmptyState from "@/components/collection/EmptyState";
import VirtualFolderCard from "@/components/collection/VirtualFolderCard";
import GalleryFolderCard from "@/components/collection/GalleryFolderCard";
import FavoritesSection from "@/components/collection/FavoritesSection";
import GroupSection from "@/components/collection/GroupSection";

type ItemViewMode = "grid" | "gallery" | "list";
import AddItemModal from "@/pages/AddItemModal";

const TAG_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e",
  "#f97316", "#eab308", "#22c55e", "#14b8a6",
  "#3b82f6", "#94a3b8",
];
import CollectionModal from "@/pages/NewCollectionModal";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BreadcrumbEntry {
  item: Item;
  /** Items loaded at this folder level. */
  items: Item[];
}

// ─── Main page ────────────────────────────────────────────────────────────────

/**
 * Displays items within a collection with tag-based filtering and create/delete actions.
 * Supports drilling into virtual_folder items and inline virtual_group expansion.
 */
export default function CollectionPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [collection, setCollection] = useState<Collection | null>(null);
  const [collectionError, setCollectionError] = useState<string | null>(null);
  const { items: rootItems, loading, error, refresh: refreshRoot } = useItems(id!);

  // Current items displayed (root or inside a virtual folder)
  const [currentItems, setCurrentItems] = useState<Item[]>([]);
  // Breadcrumb stack — each entry represents a virtual_folder we've navigated into
  const [folderStack, setFolderStack] = useState<BreadcrumbEntry[]>([]);
  const isAtRoot = folderStack.length === 0;
  const currentFolder = isAtRoot ? null : folderStack[folderStack.length - 1].item;

  const [itemTagRows, setItemTagRows] = useState<ItemTagRow[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<Item | null>(null);
  const [groupRefreshKey, setGroupRefreshKey] = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditCollection, setShowEditCollection] = useState(false);
  const [activeTagIds, setActiveTagIds] = useState<Set<string>>(new Set());
  // ── Drag state ──────────────────────────────────────────────────────────────
  // dragItemId: the item being dragged
  // dragSourceParentId: null = root level, string = inside a group/folder
  // dragOverIndex: reorder slot index within the current flat list
  // dropTargetId: id of a folder/group card being hovered (reparent target)
  // dropTargetIsRoot: true when hovering the "drag here to move to root" zone
  const dragItemIdRef = useRef<string | null>(null);
  const dragSourceParentIdRef = useRef<string | null>(null);
  const dragIndexRef = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [draggingItemId, setDraggingItemId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [dropTargetIsRoot, setDropTargetIsRoot] = useState(false);
  // ── Group drag state ─────────────────────────────────────────────────────────
  const groupDragIndexRef = useRef<number | null>(null);
  const [draggingGroupId, setDraggingGroupId] = useState<string | null>(null);
  const [groupDragOverIndex, setGroupDragOverIndex] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<ItemViewMode>(
    () => (localStorage.getItem(`collection-view-${id}`) as ItemViewMode | null) ?? readAppPrefs().defaultCollectionView
  );
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [showBulkTagDropdown, setShowBulkTagDropdown] = useState(false);
  const [bulkTagQuery, setBulkTagQuery] = useState("");
  const [bulkTagBusy, setBulkTagBusy] = useState<string | null>(null);
  const bulkTagRef = useRef<HTMLDivElement>(null);

  // Close bulk-tag dropdown when clicking outside
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (bulkTagRef.current && !bulkTagRef.current.contains(e.target as Node)) {
        setShowBulkTagDropdown(false);
        setBulkTagQuery("");
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  function handleSetViewMode(v: ItemViewMode) {
    localStorage.setItem(`collection-view-${id}`, v);
    setViewMode(v);
  }

  function toggleSelect(itemId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  function selectAll() {
    setSelectedIds(new Set(visibleItems.filter((it) => it.strategy_type !== "virtual_folder" && it.strategy_type !== "folder").map((it) => it.id)));
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  function exitSelectionMode() {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    setBulkDeleting(true);
    try {
      for (const itemId of selectedIds) {
        await itemDelete(itemId).catch(() => {});
      }
      setSelectedIds(new Set());
      setGroupRefreshKey((k) => k + 1);
      await refreshCurrent();
      if (isAtRoot) tagGetByCollection(id!).then(setItemTagRows).catch(() => {});
    } finally {
      setBulkDeleting(false);
    }
  }

  /** Assigns a tag to all selected items; skips items that already have it. */
  async function handleBulkTagAssign(tagId: string) {
    setBulkTagBusy(tagId);
    try {
      await Promise.all([...selectedIds].map((itemId) => tagAssign(itemId, tagId).catch(() => {})));
      tagGetByCollection(id!).then(setItemTagRows).catch(() => {});
    } finally {
      setBulkTagBusy(null);
      setBulkTagQuery("");
    }
  }

  /** Removes a tag from all selected items. Only offered when all selected items share that tag. */
  async function handleBulkTagRemove(tagId: string) {
    setBulkTagBusy(tagId);
    try {
      await Promise.all([...selectedIds].map((itemId) => tagRemove(itemId, tagId).catch(() => {})));
      tagGetByCollection(id!).then(setItemTagRows).catch(() => {});
    } finally {
      setBulkTagBusy(null);
      setBulkTagQuery("");
    }
  }

  /** Creates a new tag and immediately assigns it to all selected items. */
  async function handleBulkTagCreate(name: string) {
    const color = TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)];
    setBulkTagBusy("new");
    try {
      const newTag = await tagCreate(name, color);
      setAllTags((prev) => [...prev, newTag].sort((a, b) => a.name.localeCompare(b.name)));
      await Promise.all([...selectedIds].map((itemId) => tagAssign(itemId, newTag.id).catch(() => {})));
      tagGetByCollection(id!).then(setItemTagRows).catch(() => {});
      setBulkTagQuery("");
    } finally {
      setBulkTagBusy(null);
    }
  }

  useEffect(() => {
    collectionGetById(id!)
      .then(setCollection)
      .catch((e) => setCollectionError(String(e)));
  }, [id]);

  // Sync currentItems from rootItems when at root
  useEffect(() => {
    if (isAtRoot) setCurrentItems(rootItems);
  }, [rootItems, isAtRoot]);


  // Reload item-tag map whenever rootItems change
  useEffect(() => {
    if (rootItems.length === 0) { setItemTagRows([]); return; }
    tagGetByCollection(id!).then(setItemTagRows).catch(() => {});
  }, [id, rootItems]);

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

  // Fetch all tags once on mount (used for bulk-tag dropdown)
  useEffect(() => {
    tagGetAll().then(setAllTags).catch(() => {});
  }, []);

  // Tags shared by every selected item — used to offer removal in bulk-tag dropdown
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

  // Non-group items for the filter (virtual_groups are excluded since they act as containers)
  const visibleItems = useMemo(() => {
    const base = currentItems.filter((item) => item.strategy_type !== "virtual_group");
    if (activeTagIds.size === 0) return base;
    return base.filter((item) => {
      const tags = itemTagMap.get(item.id) ?? [];
      const tagIds = new Set(tags.map((t) => t.id));
      return [...activeTagIds].every((id) => tagIds.has(id));
    });
  }, [currentItems, itemTagMap, activeTagIds]);

  const virtualGroups = useMemo(
    () => currentItems.filter((item) => item.strategy_type === "virtual_group"),
    [currentItems]
  );

  // Favorited items fetched directly from DB — includes items inside groups/folders.
  const [favoriteItems, setFavoriteItems] = useState<Item[]>([]);
  useEffect(() => {
    itemGetFavorites(id!).then(setFavoriteItems).catch(() => setFavoriteItems([]));
  }, [id, rootItems]); // re-fetch whenever rootItems reload (covers navigate-back)

  function toggleTag(tagId: string) {
    setActiveTagIds((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) next.delete(tagId);
      else next.add(tagId);
      return next;
    });
  }

  /** Navigate into a virtual_folder — push onto the stack and load its children. */
  async function openVirtualFolder(folder: Item) {
    const children = await itemGetByParent(folder.id);
    setFolderStack((prev) => [...prev, { item: folder, items: children }]);
    setCurrentItems(children);
    setActiveTagIds(new Set());
    setSelectionMode(false);
    setSelectedIds(new Set());
  }

  /** Navigate up the breadcrumb stack. */
  function navigateUp(targetDepth: number) {
    if (targetDepth < 0) {
      // Go back to root
      setFolderStack([]);
      setCurrentItems(rootItems);
    } else {
      const newStack = folderStack.slice(0, targetDepth + 1);
      setFolderStack(newStack);
      setCurrentItems(newStack[newStack.length - 1].items);
    }
    setActiveTagIds(new Set());
  }

  /** Refresh children of current virtual folder after an item is added/deleted. */
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

  // dropTargetGroupId: id of a GroupSection being hovered (set by GroupSection via callback)
  const dropTargetGroupIdRef = useRef<string | null>(null);
  const [dropTargetGroupId, setDropTargetGroupId] = useState<string | null>(null);

  function handleItemDragStart(item: Item, index: number, sourceParentId: string | null) {
    dragItemIdRef.current = item.id;
    dragSourceParentIdRef.current = sourceParentId;
    dragIndexRef.current = index;
    dropTargetGroupIdRef.current = null;
    setDraggingItemId(item.id);
  }

  /**
   * Called on the dragged element's onDragEnd — acts on whatever destination
   * state was set during the drag (same pattern as the original reorder).
   */
  async function handleItemDragEnd() {
    const itemId = dragItemIdRef.current;
    const from = dragIndexRef.current;
    const targetFolderId = dropTargetId;        // folder/group card being hovered
    const targetGroupId = dropTargetGroupIdRef.current; // GroupSection being hovered
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
      setGroupRefreshKey((k) => k + 1);
      return;
    }

    // Priority 2: dropped onto a GroupSection header area
    if (targetGroupId && targetGroupId !== itemId) {
      await itemReparent(itemId, targetGroupId).catch(() => {});
      await refreshCurrent();
      setGroupRefreshKey((k) => k + 1);
      return;
    }

    // Priority 3: dropped onto the root zone (drag-out)
    if (toRoot && sourceParentId !== null) {
      await itemReparent(itemId, null).catch(() => {});
      await refreshCurrent();
      setGroupRefreshKey((k) => k + 1);
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

  function handleGroupDragStart(groupId: string, index: number) {
    groupDragIndexRef.current = index;
    setDraggingGroupId(groupId);
  }

  async function handleGroupDragEnd() {
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

  async function handleDelete() {
    if (!deleteTarget) return;
    if (deleteTarget.strategy_type === "folder") {
      await folderDelete(deleteTarget.id);
    } else {
      await itemDelete(deleteTarget.id);
    }
    setDeleteTarget(null);
    setGroupRefreshKey((k) => k + 1);
    await refreshCurrent();
    if (isAtRoot) {
      tagGetByCollection(id!).then(setItemTagRows).catch(() => {});
    }
  }

  async function handleEditCollection(input: NewCollection) {
    if (!collection) return;
    const updated = await collectionUpdate(collection.id, {
      name: input.name,
      description: input.description,
      color: input.color,
      default_strategy: input.default_strategy,
    });
    setCollection(updated);
    setShowEditCollection(false);
  }

  if (loading || !collection) {
    return (
      <div style={{ padding: "var(--space-6)", width: "100%" }}>
        <ItemGridSkeleton rows={2} />
      </div>
    );
  }
  if (error || collectionError) {
    return (
      <div className="cp-error-state">
        <span className="cp-error-msg">{error || collectionError}</span>
        <button className="cp-error-retry" onClick={refreshRoot}>Retry</button>
      </div>
    );
  }

  const totalCount = isAtRoot ? rootItems.length : currentItems.length;

  return (
    <div className="cp-outer">
    <div className="cp">
      {/* Header */}
      <div className="cp-header">
        <button className="cp-back" onClick={() => navigate(-1)}>
          <ArrowLeft size={14} />
          <span>Back</span>
        </button>
        <div className="cp-header-divider" />
        <div className="cp-accent-dot" style={{ background: collection.color }} />

        {/* Breadcrumb */}
        <div className="cp-breadcrumb">
          <button
            className={`cp-breadcrumb-seg${isAtRoot ? " cp-breadcrumb-seg--active" : ""}`}
            onClick={() => navigateUp(-1)}
          >
            {collection.name}
          </button>
          {folderStack.map((entry, i) => (
            <span key={entry.item.id} className="cp-breadcrumb-item">
              <ChevronRight size={12} className="cp-breadcrumb-sep" />
              <button
                className={`cp-breadcrumb-seg${i === folderStack.length - 1 ? " cp-breadcrumb-seg--active" : ""}`}
                onClick={() => navigateUp(i)}
              >
                {entry.item.name}
              </button>
            </span>
          ))}
          {collection.description && isAtRoot && (
            <p className="cp-desc">{collection.description}</p>
          )}
        </div>

        <div className="cp-header-right">
          <div className="cp-view-toggle">
            <button
              className={`cp-toggle-btn${viewMode === "grid" ? " cp-toggle-btn--active" : ""}`}
              onClick={() => handleSetViewMode("grid")}
              title="Grid view"
            >
              <LayoutGrid size={13} />
            </button>
            <button
              className={`cp-toggle-btn${viewMode === "gallery" ? " cp-toggle-btn--active" : ""}`}
              onClick={() => handleSetViewMode("gallery")}
              title="Gallery view"
            >
              <Image size={13} />
            </button>
            <button
              className={`cp-toggle-btn${viewMode === "list" ? " cp-toggle-btn--active" : ""}`}
              onClick={() => handleSetViewMode("list")}
              title="List view"
            >
              <LayoutList size={13} />
            </button>
          </div>
          <span className="cp-item-count">
            <LayoutGrid size={12} />
            {totalCount} {totalCount === 1 ? "item" : "items"}
          </span>
          <button
            className={`cp-select-btn${selectionMode ? " cp-select-btn--active" : ""}`}
            onClick={() => selectionMode ? exitSelectionMode() : setSelectionMode(true)}
            title={selectionMode ? "Exit selection mode" : "Select items"}
          >
            <CheckSquare size={13} />
            {selectionMode ? "Done" : "Select"}
          </button>
          {isAtRoot && (
            <button className="cp-edit-btn" onClick={() => setShowEditCollection(true)} title="Edit collection">
              <Pencil size={13} />
            </button>
          )}
          <button className="cp-add-inline" onClick={() => setShowAddModal(true)}>
            <Plus size={14} />
            Add
          </button>
        </div>
      </div>

      {/* Tag filter bar — only shown when at root and collection has tagged items */}
      {isAtRoot && collectionTags.length > 0 && (
        <div className="cp-filter-bar">
          {collectionTags.map((tag) => {
            const active = activeTagIds.has(tag.id);
            return (
              <button
                key={tag.id}
                className={`cp-filter-chip ${active ? "cp-filter-chip--active" : ""}`}
                style={active
                  ? { background: `${tag.color}22`, borderColor: tag.color, color: tag.color }
                  : undefined
                }
                onClick={() => toggleTag(tag.id)}
              >
                <span className="cp-filter-dot" style={{ background: tag.color }} />
                {tag.name}
                {active && <X size={10} strokeWidth={2.5} />}
              </button>
            );
          })}
          {activeTagIds.size > 0 && (
            <button className="cp-filter-clear" onClick={() => setActiveTagIds(new Set())}>
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Content */}
      {currentItems.length === 0 ? (
        <EmptyState onAdd={() => setShowAddModal(true)} isFolder={!isAtRoot} />
      ) : (
        <div className="cp-content">
          {/* Virtual Favorites group — pinned to top when any visible item is marked favourite */}
          {favoriteItems.length > 0 && (
            <FavoritesSection
              items={favoriteItems}
              collectionColor={collection.color}
              itemTagMap={itemTagMap}
              viewMode={viewMode}
              onItemClick={(item) => navigate(`/collections/${id}/items/${item.id}`)}
              onItemDelete={(item) => setDeleteTarget(item)}
            />
          )}

          {/* Virtual groups — rendered as inline sections, draggable to reorder */}
          {virtualGroups.map((group, index) => (
            <div key={group.id} className="cp-drag-wrapper">
              {groupDragOverIndex === index && draggingGroupId !== null && groupDragIndexRef.current !== index && groupDragOverIndex < (groupDragIndexRef.current ?? -1) && (
                <div className="cp-drop-slot cp-drop-slot--group" />
              )}
              <div
                className={`cp-drag-item${draggingGroupId === group.id ? " cp-drag-item--dragging" : ""}`}
                draggable
                onDragStart={(e) => { e.dataTransfer.setData("text/plain", group.id); handleGroupDragStart(group.id, index); }}
                onDragEnter={(e) => { e.preventDefault(); setGroupDragOverIndex(index); }}
                onDragOver={(e) => e.preventDefault()}
                onDragEnd={handleGroupDragEnd}
              >
                <GroupSection
                  group={group}
                  collectionId={id!}
                  defaultStrategy={collection.default_strategy}
                  collectionColor={collection.color}
                  itemTagMap={itemTagMap}
                  viewMode={viewMode}
                  refreshKey={groupRefreshKey}
                  onItemClick={(item) => navigate(`/collections/${id}/items/${item.id}`)}
                  onItemDelete={(item) => setDeleteTarget(item)}
                  onGroupDelete={() => setDeleteTarget(group)}
                  onDragOverGroup={(gid) => { if (draggingGroupId !== null) return; dropTargetGroupIdRef.current = gid; setDropTargetGroupId(gid); setDropTargetId(null); setDragOverIndex(null); setDropTargetIsRoot(false); }}
                  onDragLeaveGroup={() => { dropTargetGroupIdRef.current = null; setDropTargetGroupId(null); }}
                  isDropTarget={dropTargetGroupId === group.id}
                  onChildMoved={() => { refreshCurrent(); setGroupRefreshKey((k) => k + 1); }}
                  selectionMode={selectionMode}
                  selectedIds={selectedIds}
                  onToggleSelect={toggleSelect}
                />
              </div>
              {groupDragOverIndex === index && draggingGroupId !== null && groupDragIndexRef.current !== index && groupDragOverIndex > (groupDragIndexRef.current ?? -1) && (
                <div className="cp-drop-slot cp-drop-slot--group" />
              )}
            </div>
          ))}

          {/* Regular item grid (non-group items) */}
          {visibleItems.length > 0 && (
            viewMode === "list" ? (
              <div className="items-list">
                {visibleItems.map((item) => (
                  (item.strategy_type === "virtual_folder" || item.strategy_type === "folder") ? (
                    <VirtualFolderCard
                      key={item.id}
                      item={item}
                      collectionColor={collection.color}
                      onClick={() => openVirtualFolder(item)}
                      onDelete={(e) => { e.stopPropagation(); setDeleteTarget(item); }}
                    />
                  ) : (
                    <ListItemRow
                      key={item.id}
                      item={item}
                      collectionColor={collection.color}
                      tags={itemTagMap.get(item.id) ?? []}
                      onClick={() => navigate(`/collections/${id}/items/${item.id}`)}
                      onDelete={(e) => { e.stopPropagation(); setDeleteTarget(item); }}
                      selected={selectedIds.has(item.id)}
                      onSelect={selectionMode ? (e) => { e.stopPropagation(); toggleSelect(item.id); } : undefined}
                    />
                  )
                ))}
              </div>
            ) : (
              <div
                className={viewMode === "gallery" ? "items-gallery" : "items-grid"}
              >
                {visibleItems.map((item, index) => {
                  const isFolder = item.strategy_type === "virtual_folder" || item.strategy_type === "folder";
                  const isDraggingThis = draggingItemId === item.id;
                  const isDropTarget = dropTargetId === item.id;
                  return (
                    <div key={item.id} className="cp-drag-wrapper">
                      {dragOverIndex === index && draggingItemId !== null && dragIndexRef.current !== index && dragOverIndex < (dragIndexRef.current ?? -1) && (
                        <div className="cp-drop-slot" />
                      )}
                      <div
                        draggable
                        onDragStart={(e) => { e.dataTransfer.setData("text/plain", item.id); handleItemDragStart(item, index, currentFolder?.id ?? null); }}
                        onDragEnter={(e) => {
                          e.preventDefault();
                          if (isFolder) { setDropTargetId(item.id); setDragOverIndex(null); }
                          else { setDragOverIndex(index); setDropTargetId(null); }
                        }}
                        onDragOver={(e) => e.preventDefault()}
                        onDragEnd={handleItemDragEnd}
                        className={`cp-drag-item${isDraggingThis ? " cp-drag-item--dragging" : ""}${isDropTarget ? " cp-drag-item--drop-target" : ""}`}
                      >
                        {isFolder ? (
                          viewMode === "gallery" ? (
                            <GalleryFolderCard
                              item={item}
                              collectionColor={collection.color}
                              onClick={() => openVirtualFolder(item)}
                              onDelete={(e) => { e.stopPropagation(); setDeleteTarget(item); }}
                            />
                          ) : (
                            <VirtualFolderCard
                              item={item}
                              collectionColor={collection.color}
                              onClick={() => openVirtualFolder(item)}
                              onDelete={(e) => { e.stopPropagation(); setDeleteTarget(item); }}
                            />
                          )
                        ) : viewMode === "gallery" ? (
                          <GalleryItemCard
                            item={item}
                            collectionColor={collection.color}
                            tags={itemTagMap.get(item.id) ?? []}
                            onClick={() => navigate(`/collections/${id}/items/${item.id}`)}
                            onDelete={(e) => { e.stopPropagation(); setDeleteTarget(item); }}
                            selected={selectedIds.has(item.id)}
                            onSelect={selectionMode ? (e) => { e.stopPropagation(); toggleSelect(item.id); } : undefined}
                          />
                        ) : (
                          <ItemCard
                            item={item}
                            collectionColor={collection.color}
                            tags={itemTagMap.get(item.id) ?? []}
                            onClick={() => navigate(`/collections/${id}/items/${item.id}`)}
                            onDelete={(e) => { e.stopPropagation(); setDeleteTarget(item); }}
                            selected={selectedIds.has(item.id)}
                            onSelect={selectionMode ? (e) => { e.stopPropagation(); toggleSelect(item.id); } : undefined}
                          />
                        )}
                      </div>
                      {dragOverIndex === index && draggingItemId !== null && dragIndexRef.current !== index && dragOverIndex > (dragIndexRef.current ?? -1) && (
                        <div className="cp-drop-slot" />
                      )}
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>
      )}

      {/* Root drop zone — shown when dragging an item from inside a folder/group */}
      {draggingItemId !== null && dragSourceParentIdRef.current !== null && (
        <div
          className={`cp-root-drop${dropTargetIsRoot ? " cp-root-drop--active" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDropTargetIsRoot(true); setDropTargetId(null); setDragOverIndex(null); }}
          onDragLeave={() => setDropTargetIsRoot(false)}
        >
          <FolderOpen size={14} strokeWidth={1.5} />
          Drop here to move to root level
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete Item"
        message={
          deleteTarget?.strategy_type === "folder"
            ? `Delete "${deleteTarget?.name}"? All contents will be permanently deleted.`
            : deleteTarget?.strategy_type === "virtual_folder"
            ? `Delete "${deleteTarget?.name}"? Items inside will be moved to the parent level.`
            : `Delete "${deleteTarget?.name}"? This cannot be undone.`
        }
        confirmLabel="Delete Item"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {showAddModal && (
        <AddItemModal
          collectionId={id!}
          defaultStrategy={collection.default_strategy}
          parentId={currentFolder?.id ?? null}
          onSuccess={async (newItemId, strategyType) => {
            setShowAddModal(false);
            await refreshCurrent();
            if (strategyType === "folder") {
              // Disk-backed folder: navigate into it immediately like a virtual folder.
              const folderItem = await itemGetById(newItemId);
              await openVirtualFolder(folderItem);
            } else if (strategyType !== "virtual_folder" && strategyType !== "virtual_group") {
              navigate(`/collections/${id}/items/${newItemId}`);
            }
          }}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {showEditCollection && (
        <CollectionModal
          initial={{
            name: collection.name,
            description: collection.description,
            color: collection.color,
            default_strategy: collection.default_strategy,
          }}
          submitLabel="Save Changes"
          onConfirm={handleEditCollection}
          onCancel={() => setShowEditCollection(false)}
        />
      )}

    </div>

    {/* Bulk action bar — sticky to the bottom of the scroll container */}
    {selectedIds.size > 0 && (
      <div className="cp-bulk-bar">
        <span className="cp-bulk-count">
          <CheckSquare size={14} />
          {selectedIds.size} selected
        </span>
        <div className="cp-bulk-actions">
          <button className="cp-bulk-select-all" onClick={selectAll}>
            Select all
          </button>
          <button className="cp-bulk-clear" onClick={clearSelection}>
            <X size={12} />
            Clear
          </button>
          {/* Bulk tag button + dropdown */}
          <div className="cp-bulk-tag-wrap" ref={bulkTagRef}>
            <button
              className={`cp-bulk-tag-btn${showBulkTagDropdown ? " cp-bulk-tag-btn--active" : ""}`}
              onClick={() => setShowBulkTagDropdown((v) => !v)}
              title="Add or remove tags on selected items"
            >
              <TagIcon size={13} />
              Tag
            </button>
            {showBulkTagDropdown && (() => {
              const filteredAll = allTags.filter((t) =>
                t.name.toLowerCase().includes(bulkTagQuery.toLowerCase())
              );
              const canCreate =
                bulkTagQuery.trim().length > 0 &&
                !allTags.some((t) => t.name.toLowerCase() === bulkTagQuery.trim().toLowerCase());
              return (
                <div className="cp-bulk-tag-dropdown">
                  <div className="cp-bulk-tag-search-row">
                    <TagIcon size={11} color="rgba(255,255,255,0.5)" />
                    <input
                      autoFocus
                      className="cp-bulk-tag-search"
                      placeholder="Search or create tag…"
                      value={bulkTagQuery}
                      onChange={(e) => setBulkTagQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && canCreate) handleBulkTagCreate(bulkTagQuery.trim());
                        if (e.key === "Escape") { setShowBulkTagDropdown(false); setBulkTagQuery(""); }
                      }}
                    />
                  </div>
                  {/* Shared tags — removable */}
                  {sharedTagIds.size > 0 && (
                    <div className="cp-bulk-tag-section-label">Remove from all</div>
                  )}
                  {[...sharedTagIds].map((tid) => {
                    const tag = allTags.find((t) => t.id === tid);
                    if (!tag || !tag.name.toLowerCase().includes(bulkTagQuery.toLowerCase())) return null;
                    return (
                      <button
                        key={tid}
                        className="cp-bulk-tag-option cp-bulk-tag-option--remove"
                        onClick={() => handleBulkTagRemove(tid)}
                        disabled={bulkTagBusy === tid}
                      >
                        <span className="cp-bulk-tag-dot" style={{ background: tag.color }} />
                        {tag.name}
                        <X size={10} strokeWidth={2.5} style={{ marginLeft: "auto", opacity: 0.7 }} />
                      </button>
                    );
                  })}
                  {/* All tags — assignable (excluding already-shared ones when showing remove section) */}
                  {sharedTagIds.size > 0 && filteredAll.some((t) => !sharedTagIds.has(t.id)) && (
                    <div className="cp-bulk-tag-section-label">Add to all</div>
                  )}
                  {filteredAll.filter((t) => !sharedTagIds.has(t.id)).map((tag) => (
                    <button
                      key={tag.id}
                      className="cp-bulk-tag-option"
                      onClick={() => handleBulkTagAssign(tag.id)}
                      disabled={bulkTagBusy === tag.id}
                    >
                      <span className="cp-bulk-tag-dot" style={{ background: tag.color }} />
                      {tag.name}
                    </button>
                  ))}
                  {canCreate && (
                    <button
                      className="cp-bulk-tag-option cp-bulk-tag-option--create"
                      onClick={() => handleBulkTagCreate(bulkTagQuery.trim())}
                      disabled={bulkTagBusy === "new"}
                    >
                      <Plus size={11} />
                      Create "{bulkTagQuery.trim()}"
                    </button>
                  )}
                  {filteredAll.length === 0 && !canCreate && (
                    <span className="cp-bulk-tag-empty">No tags found</span>
                  )}
                </div>
              );
            })()}
          </div>
          <button
            className="cp-bulk-delete"
            onClick={handleBulkDelete}
            disabled={bulkDeleting}
          >
            <Trash2 size={13} />
            {bulkDeleting ? "Deleting…" : `Delete ${selectedIds.size}`}
          </button>
        </div>
      </div>
    )}

      <style>{`
        .cp-outer { display: flex; flex-direction: column; min-height: 100%; }
        .cp { width: 100%; flex: 1; }
        .cp-header {
          position: sticky;
          top: calc(-1 * var(--space-4));
          z-index: 10;
          background: var(--color-bg);
          display: flex;
          align-items: center;
          gap: var(--space-3);
          margin-bottom: var(--space-5);
          padding-top: var(--space-4);
          padding-bottom: var(--space-5);
          border-bottom: 1px solid var(--color-border-subtle);
        }
        .cp-back {
          display: flex;
          align-items: center;
          gap: 5px;
          color: var(--color-text-muted);
          font-size: 12.5px;
          font-weight: 500;
          padding: 5px 8px;
          border-radius: var(--radius-sm);
          transition: color var(--transition-fast), background var(--transition-fast);
          flex-shrink: 0;
        }
        .cp-back:hover { color: var(--color-text-primary); background: var(--color-bg-secondary); }
        .cp-header-divider { width: 1px; height: 20px; background: var(--color-border); flex-shrink: 0; }
        .cp-accent-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
        .cp-breadcrumb {
          flex: 1; min-width: 0;
          display: flex; align-items: center; flex-wrap: wrap; gap: 2px;
        }
        .cp-breadcrumb-item { display: flex; align-items: center; gap: 2px; }
        .cp-breadcrumb-sep { color: var(--color-text-muted); flex-shrink: 0; }
        .cp-breadcrumb-seg {
          font-size: 17px; font-weight: 700; letter-spacing: -0.025em;
          color: var(--color-text-muted);
          padding: 2px 4px; border-radius: var(--radius-sm);
          transition: color var(--transition-fast), background var(--transition-fast);
        }
        .cp-breadcrumb-seg:hover { color: var(--color-text-primary); background: var(--color-bg-secondary); }
        .cp-breadcrumb-seg--active { color: var(--color-text-primary); }
        .cp-desc { font-size: 12.5px; color: var(--color-text-muted); margin-top: 2px; width: 100%; }
        .cp-header-right { display: flex; align-items: center; gap: var(--space-3); flex-shrink: 0; }
        .cp-item-count { display: flex; align-items: center; gap: 5px; font-size: 12px; color: var(--color-text-muted); }
        .cp-select-btn {
          display: flex; align-items: center; gap: 5px;
          padding: 5px 10px;
          font-size: 12.5px; font-weight: 500;
          color: var(--color-text-muted);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          background: var(--color-bg);
          transition: color var(--transition-fast), background var(--transition-fast), border-color var(--transition-fast);
        }
        .cp-select-btn:hover { color: var(--color-text-primary); background: var(--color-bg-secondary); }
        .cp-select-btn--active {
          color: var(--color-accent);
          border-color: var(--color-accent);
          background: var(--color-accent-light);
        }
        .cp-select-btn--active:hover { background: color-mix(in srgb, var(--color-accent) 14%, transparent); }
        .cp-edit-btn {
          display: flex; align-items: center; justify-content: center;
          width: 30px; height: 30px;
          color: var(--color-text-muted);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          background: var(--color-bg);
          transition: color var(--transition-fast), background var(--transition-fast);
        }
        .cp-edit-btn:hover { color: var(--color-text-primary); background: var(--color-bg-secondary); }
        .cp-add-inline {
          display: flex; align-items: center; gap: var(--space-1);
          padding: 7px 14px;
          background: var(--color-accent); color: white;
          border-radius: var(--radius-sm);
          font-size: 13px; font-weight: 500;
          transition: background var(--transition-fast);
        }
        .cp-add-inline:hover { background: var(--color-accent-hover); }
        .cp-filter-bar {
          display: flex; flex-wrap: wrap; align-items: center;
          gap: var(--space-2); margin-bottom: var(--space-5);
        }
        .cp-filter-chip {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 4px 10px;
          border-radius: var(--radius-full);
          border: 1px solid var(--color-border);
          font-size: 12px; font-weight: 500;
          color: var(--color-text-secondary);
          background: var(--color-bg-secondary);
          transition: all var(--transition-fast); cursor: pointer;
        }
        .cp-filter-chip:hover { border-color: var(--color-accent); color: var(--color-accent); }
        .cp-filter-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
        .cp-filter-clear {
          font-size: 12px; color: var(--color-text-muted);
          padding: 4px 8px; border-radius: var(--radius-sm);
          transition: color var(--transition-fast), background var(--transition-fast);
        }
        .cp-filter-clear:hover { color: var(--color-text-primary); background: var(--color-bg-secondary); }
        .cp-error-state {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: var(--space-3); min-height: 40vh; text-align: center;
        }
        .cp-error-msg { font-size: 14px; color: var(--color-danger); }
        .cp-error-retry {
          padding: var(--space-2) var(--space-4);
          font-size: 13px; font-weight: 500;
          background: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          color: var(--color-text-secondary);
          transition: background var(--transition-fast), color var(--transition-fast);
        }
        .cp-error-retry:hover { background: var(--color-bg-tertiary); color: var(--color-text-primary); }
        .cp-content { display: flex; flex-direction: column; gap: var(--space-5); }
        .cp-drag-wrapper { display: contents; }
        .cp-drag-item { cursor: grab; border-radius: var(--radius-md); transition: opacity 200ms; }
        .cp-drag-item--dragging { opacity: 0.35; }
        .cp-drag-item--drop-target > * {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
          border-radius: var(--radius-md);
          box-shadow: 0 0 0 4px var(--color-accent-light);
        }
        .cp-drop-slot {
          border-radius: var(--radius-md);
          border: 2px dashed var(--color-accent);
          background: var(--color-accent-light);
          min-height: 72px;
          animation: cp-slot-appear 150ms ease;
        }
        .cp-drop-slot--group { min-height: 48px; }
        @keyframes cp-slot-appear { from { opacity: 0; transform: scaleY(0.85); } to { opacity: 1; transform: scaleY(1); } }
        .cp-root-drop {
          display: flex; align-items: center; justify-content: center; gap: var(--space-2);
          margin-top: var(--space-4);
          padding: var(--space-3) var(--space-4);
          border: 2px dashed var(--color-border);
          border-radius: var(--radius-md);
          font-size: 12.5px; color: var(--color-text-muted);
          transition: border-color var(--transition-fast), background var(--transition-fast), color var(--transition-fast);
          animation: cp-slot-appear 150ms ease;
        }
        .cp-root-drop--active {
          border-color: var(--color-accent);
          background: var(--color-accent-light);
          color: var(--color-accent);
        }
        .items-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
          gap: var(--space-3);
        }
        .items-gallery {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
          gap: var(--space-3);
        }
        .items-list {
          display: flex;
          flex-direction: column;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          overflow: hidden;
        }
        .cp-view-toggle {
          display: flex; align-items: center; gap: 2px;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          padding: 2px;
          background: var(--color-bg-secondary);
        }
        .cp-toggle-btn {
          display: flex; align-items: center; justify-content: center;
          width: 26px; height: 26px;
          border-radius: calc(var(--radius-sm) - 1px);
          color: var(--color-text-muted);
          transition: background var(--transition-fast), color var(--transition-fast);
        }
        .cp-toggle-btn:hover { color: var(--color-text-primary); }
        .cp-toggle-btn--active {
          background: var(--color-bg);
          color: var(--color-text-primary);
          box-shadow: 0 1px 2px rgba(0,0,0,0.06);
        }
        .cp-bulk-bar {
          position: sticky;
          bottom: 0;
          left: 0;
          right: 0;
          display: flex; align-items: center; gap: var(--space-3);
          padding: 10px 16px;
          margin-top: var(--space-4);
          background: var(--color-text-primary);
          color: var(--color-bg);
          border-radius: var(--radius-lg);
          box-shadow: 0 4px 24px rgba(0,0,0,0.22);
          z-index: 200;
          animation: cp-bulk-appear 180ms ease;
          white-space: nowrap;
        }
        @keyframes cp-bulk-appear {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .cp-bulk-count {
          display: flex; align-items: center; gap: 6px;
          font-size: 13px; font-weight: 600;
        }
        .cp-bulk-actions {
          display: flex; align-items: center; gap: var(--space-2);
        }
        .cp-bulk-select-all, .cp-bulk-clear {
          display: flex; align-items: center; gap: 4px;
          padding: 5px 10px;
          border-radius: var(--radius-sm);
          font-size: 12.5px; font-weight: 500;
          color: rgba(255,255,255,0.7);
          transition: background var(--transition-fast), color var(--transition-fast);
        }
        .cp-bulk-select-all:hover, .cp-bulk-clear:hover {
          background: rgba(255,255,255,0.12);
          color: white;
        }
        .cp-bulk-delete {
          display: flex; align-items: center; gap: 5px;
          padding: 5px 12px;
          border-radius: var(--radius-sm);
          font-size: 12.5px; font-weight: 600;
          background: var(--color-danger);
          color: white;
          transition: background var(--transition-fast);
        }
        .cp-bulk-delete:hover:not(:disabled) { background: #b91c1c; }
        .cp-bulk-delete:disabled { opacity: 0.6; cursor: not-allowed; }
        .cp-bulk-tag-wrap { position: relative; }
        .cp-bulk-tag-btn {
          display: flex; align-items: center; gap: 5px;
          padding: 5px 10px;
          border-radius: var(--radius-sm);
          font-size: 12.5px; font-weight: 500;
          color: rgba(255,255,255,0.7);
          border: 1px solid rgba(255,255,255,0.18);
          transition: background var(--transition-fast), color var(--transition-fast);
        }
        .cp-bulk-tag-btn:hover { background: rgba(255,255,255,0.12); color: white; }
        .cp-bulk-tag-btn--active { background: rgba(255,255,255,0.15); color: white; }
        .cp-bulk-tag-dropdown {
          position: absolute;
          bottom: calc(100% + 8px);
          left: 50%;
          transform: translateX(-50%);
          z-index: 300;
          min-width: 230px;
          background: var(--color-text-primary);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: var(--radius-md);
          box-shadow: 0 8px 32px rgba(0,0,0,0.35);
          overflow: hidden;
        }
        .cp-bulk-tag-search-row {
          display: flex; align-items: center; gap: var(--space-2);
          padding: 8px 10px;
          border-bottom: 1px solid rgba(255,255,255,0.1);
        }
        .cp-bulk-tag-search {
          background: none; border: none; outline: none;
          font-size: 12.5px; color: white; flex: 1; min-width: 0;
        }
        .cp-bulk-tag-search::placeholder { color: rgba(255,255,255,0.4); }
        .cp-bulk-tag-section-label {
          padding: 5px 10px 2px;
          font-size: 10.5px; font-weight: 600;
          text-transform: uppercase; letter-spacing: 0.06em;
          color: rgba(255,255,255,0.35);
        }
        .cp-bulk-tag-option {
          display: flex; align-items: center; gap: var(--space-2);
          width: 100%; padding: 7px 10px;
          font-size: 13px; color: rgba(255,255,255,0.85);
          text-align: left;
          transition: background var(--transition-fast);
        }
        .cp-bulk-tag-option:hover:not(:disabled) { background: rgba(255,255,255,0.1); color: white; }
        .cp-bulk-tag-option:disabled { opacity: 0.45; cursor: not-allowed; }
        .cp-bulk-tag-option--remove:hover:not(:disabled) { background: rgba(239,68,68,0.2); }
        .cp-bulk-tag-option--create { color: #a5b4fc; }
        .cp-bulk-tag-dot {
          width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
        }
        .cp-bulk-tag-empty {
          display: block; padding: 10px;
          font-size: 12px; color: rgba(255,255,255,0.35); text-align: center;
        }
        .cp-favorites-section {
          border: 1px solid #f59e0b44;
          border-radius: var(--radius-md);
          overflow: hidden;
          background: color-mix(in srgb, #f59e0b 6%, var(--color-bg));
        }
        .cp-favorites-header {
          display: flex; align-items: center; gap: var(--space-2);
          padding: var(--space-2) var(--space-4);
          border-bottom: 1px solid #f59e0b33;
          font-size: 12.5px; font-weight: 600;
          color: #b45309;
          cursor: pointer;
          user-select: none;
          transition: background var(--transition-fast);
        }
        .cp-favorites-header:hover { background: color-mix(in srgb, #f59e0b 10%, var(--color-bg)); }
        .cp-favorites-body { padding: var(--space-3); }
        .cp-favorites-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
          gap: var(--space-3);
        }
        .cp-favorites-gallery {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
          gap: var(--space-3);
        }
        .cp-favorites-list {
          display: flex; flex-direction: column;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          overflow: hidden;
        }
      `}</style>
    </div>
  );
}

// ─── FavoritesSection ────────────────────────────────────────────────────────
