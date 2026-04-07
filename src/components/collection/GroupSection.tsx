import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Layers, ChevronUp, ChevronDown, Plus, Trash2, FolderOpen } from "lucide-react";
import { Item } from "@/types/item";
import { Tag } from "@/types/tag";
import ItemCard from "@/components/common/ItemCard";
import GalleryItemCard from "@/components/common/GalleryItemCard";
import ListItemRow from "@/components/common/ListItemRow";
import AddItemModal from "@/pages/AddItemModal";
import { itemGetByParent, itemReparent, itemReorder } from "@/services/tauriCommands";

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
 * Children are fetched and displayed in a grid below the group header.
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

  const childDragIndexRef = useRef<number | null>(null);
  const [draggingChildId, setDraggingChildId] = useState<string | null>(null);
  const [childDragOverIndex, setChildDragOverIndex] = useState<number | null>(null);
  const [childDropTargetIsRoot, setChildDropTargetIsRoot] = useState(false);

  function handleChildDragStart(childId: string, index: number) {
    childDragIndexRef.current = index;
    setDraggingChildId(childId);
    setChildDropTargetIsRoot(false);
  }

  async function handleChildDragEnd() {
    const from = childDragIndexRef.current;
    const toIndex = childDragOverIndex;
    const toRoot = childDropTargetIsRoot;
    const draggedId = draggingChildId;

    childDragIndexRef.current = null;
    setDraggingChildId(null);
    setChildDragOverIndex(null);
    setChildDropTargetIsRoot(false);

    if (!draggedId) return;

    if (toRoot) {
      await itemReparent(draggedId, null).catch(() => {});
      await loadChildren();
      onChildMoved();
      return;
    }

    if (from !== null && toIndex !== null && from !== toIndex) {
      const next = [...children];
      const [moved] = next.splice(from, 1);
      next.splice(toIndex, 0, moved);
      setChildren(next);
      await itemReorder(next.map((it, i) => [it.id, i])).catch(() => {});
    }
  }

  return (
    <div
      className={`gs${isDropTarget ? " gs--drop-target" : ""}`}
      onDragOver={(e) => { e.preventDefault(); onDragOverGroup(group.id); }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) onDragLeaveGroup(); }}
    >
      <div className="gs-header">
        <button className="gs-toggle" onClick={() => setExpanded((v) => !v)}>
          <div className="gs-toggle-icon">
            <Layers size={13} color={collectionColor} />
          </div>
          <span className="gs-name">{group.name}</span>
          <span className="gs-count">{children.length}</span>
          {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
        <button className="gs-add" onClick={() => { setExpanded(true); setShowAdd(true); }} title="Add item to group">
          <Plus size={13} />
        </button>
        <button className="gs-delete" onClick={onGroupDelete} title="Delete group">
          <Trash2 size={12} />
        </button>
      </div>

      {expanded && (
        <div className="gs-body">
          {loadingChildren ? (
            <p className="gs-loading">Loading…</p>
          ) : children.length === 0 ? (
            <div className="gs-empty-state">
              <p className="gs-empty">No items in this group yet.</p>
              <button className="gs-add-first" onClick={() => setShowAdd(true)}>
                <Plus size={12} /> Add item
              </button>
            </div>
          ) : viewMode === "list" ? (
            <div className="items-list">
              {children.map((child) => (
                <div
                  key={child.id}
                  draggable
                  onDragStart={(e) => { e.stopPropagation(); e.dataTransfer.setData("text/plain", child.id); handleChildDragStart(child.id, children.indexOf(child)); }}
                  onDragEnd={handleChildDragEnd}
                  className={`cp-drag-item${draggingChildId === child.id ? " cp-drag-item--dragging" : ""}`}
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
            <div className={viewMode === "gallery" ? "items-gallery" : "items-grid"}>
              {children.map((child, index) => (
                <div key={child.id} className="cp-drag-wrapper">
                  {childDragOverIndex === index && draggingChildId !== null && childDragIndexRef.current !== index && childDragOverIndex < (childDragIndexRef.current ?? -1) && (
                    <div className="cp-drop-slot" />
                  )}
                  <div
                    draggable
                    onDragStart={(e) => { e.stopPropagation(); e.dataTransfer.setData("text/plain", child.id); handleChildDragStart(child.id, index); }}
                    onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setChildDragOverIndex(index); setChildDropTargetIsRoot(false); }}
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onDragEnd={handleChildDragEnd}
                    className={`cp-drag-item${draggingChildId === child.id ? " cp-drag-item--dragging" : ""}`}
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
                  {childDragOverIndex === index && draggingChildId !== null && childDragIndexRef.current !== index && childDragOverIndex > (childDragIndexRef.current ?? -1) && (
                    <div className="cp-drop-slot" />
                  )}
                </div>
              ))}
            </div>
          )}
          {draggingChildId !== null && (
            <div
              className={`cp-root-drop${childDropTargetIsRoot ? " cp-root-drop--active" : ""}`}
              style={{ marginTop: 8 }}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setChildDropTargetIsRoot(true); setChildDragOverIndex(null); }}
              onDragLeave={() => setChildDropTargetIsRoot(false)}
            >
              <FolderOpen size={14} strokeWidth={1.5} />
              Drop here to move to root level
            </div>
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

      <style>{`
        .gs { border: 1px solid var(--color-border); border-radius: var(--radius-md); overflow: hidden; transition: border-color var(--transition-fast), box-shadow var(--transition-fast); }
        .gs--drop-target { border-color: var(--color-accent); box-shadow: 0 0 0 3px var(--color-accent-light); }
        .gs-header {
          display: flex; align-items: center;
          padding: var(--space-2) var(--space-3);
          background: var(--color-bg-secondary);
          border-bottom: 1px solid var(--color-border);
          gap: var(--space-2);
        }
        .gs-toggle {
          flex: 1; display: flex; align-items: center; gap: var(--space-2);
          text-align: left; cursor: pointer;
          color: var(--color-text-secondary);
        }
        .gs-toggle-icon {
          width: 24px; height: 24px; border-radius: var(--radius-sm);
          background: var(--color-bg);
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .gs-name { font-size: 13px; font-weight: 600; color: var(--color-text-primary); flex: 1; }
        .gs-count {
          font-size: 11px; color: var(--color-text-muted);
          background: var(--color-bg); border: 1px solid var(--color-border);
          padding: 1px 7px; border-radius: var(--radius-full);
        }
        .gs-add {
          width: 26px; height: 26px; border-radius: var(--radius-sm);
          display: flex; align-items: center; justify-content: center;
          color: var(--color-text-muted);
          transition: color var(--transition-fast), background var(--transition-fast);
          flex-shrink: 0;
        }
        .gs-add:hover { color: var(--color-accent); background: var(--color-accent-light); }
        .gs-delete {
          width: 26px; height: 26px; border-radius: var(--radius-sm);
          display: flex; align-items: center; justify-content: center;
          color: var(--color-text-muted);
          transition: color var(--transition-fast), background var(--transition-fast);
          flex-shrink: 0;
        }
        .gs-delete:hover { color: var(--color-danger); background: color-mix(in srgb, var(--color-danger) 12%, transparent); }
        .gs-body { padding: var(--space-3); }
        .gs-loading { font-size: 12px; color: var(--color-text-muted); }
        .gs-empty-state { display: flex; align-items: center; gap: var(--space-3); }
        .gs-empty { font-size: 12px; color: var(--color-text-muted); font-style: italic; flex: 1; }
        .gs-add-first {
          display: inline-flex; align-items: center; gap: 4px;
          font-size: 12px; color: var(--color-accent);
          padding: 4px 10px; border-radius: var(--radius-sm);
          border: 1px dashed var(--color-accent);
          transition: background var(--transition-fast);
        }
        .gs-add-first:hover { background: var(--color-accent-light); }
      `}</style>
    </div>
  );
}
