import { useState, useEffect, useRef } from "react";
import { Pencil, Trash2, Check, X, Tag as TagIcon, GripVertical } from "lucide-react";
import { Tag, TagGroup } from "@/types/tag";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import TagChip from "@/components/tags/TagChip";
import NewTagInline from "@/components/tags/NewTagInline";

interface TagGroupSectionProps {
  /** The tag group to display. */
  group: TagGroup;
  /** Tags that belong to this group. */
  tags: Tag[];
  /** Current search query — disables drag when non-empty. */
  searchQuery: string;
  /** Called to persist a name/prefix rename. */
  onUpdateGroup: (id: string, name: string, prefix: string) => Promise<void>;
  /** Called to delete this group (tags become ungrouped). */
  onDeleteGroup: (g: TagGroup) => Promise<void>;
  /** Called to create a new tag inside this group. */
  onCreateTag: (name: string, color: string) => Promise<void>;
  /** Called to delete a tag. */
  onDeleteTag: (t: Tag) => Promise<void>;
  /** Called when a tag chip is clicked (navigate to search). */
  onTagClick: (t: Tag) => void;
  /** Called when the user drag-reorders tags inside this group. */
  onReorderTags: (reordered: Tag[]) => void;
  /** Whether this group can be dragged (false when search is active). */
  isDraggable: boolean;
}

/**
 * A collapsible group section in the Tags page.
 * Supports inline rename, tag drag-reorder, and deletion with confirmation.
 *
 * Exported as `TagGroupSection` (vs. the internal `GroupSection` name in TagsPage)
 * to avoid naming collisions when imported alongside other GroupSection components.
 */
export default function TagGroupSection({
  group, tags, searchQuery, onUpdateGroup, onDeleteGroup, onCreateTag, onDeleteTag, onTagClick, onReorderTags, isDraggable,
}: TagGroupSectionProps) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(group.name);
  const [editPrefix, setEditPrefix] = useState(group.prefix);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [localTags, setLocalTags] = useState<Tag[]>(tags);
  const tagDragIndexRef = useRef<number | null>(null);
  const [tagDragOver, setTagDragOver] = useState<number | null>(null);
  const [tagDragging, setTagDragging] = useState<number | null>(null);
  const tagsContainerRef = useRef<HTMLDivElement>(null);

  // Sync local tags when parent updates (search, create, delete)
  useEffect(() => { setLocalTags(tags); }, [tags]);

  async function handleSave() {
    if (!editName.trim()) return;
    setSaving(true);
    await onUpdateGroup(group.id, editName.trim(), editPrefix.trim());
    setSaving(false);
    setEditing(false);
  }

  // Tag drag handlers
  function handleTagDragStart(index: number) { tagDragIndexRef.current = index; setTagDragging(index); }

  function handleTagDrop(dropIndex: number) {
    const from = tagDragIndexRef.current;
    setTagDragOver(null);
    setTagDragging(null);
    if (from === null || from === dropIndex) return;
    const next = [...localTags];
    const [moved] = next.splice(from, 1);
    next.splice(dropIndex, 0, moved);
    setLocalTags(next);
    tagDragIndexRef.current = null;
    onReorderTags(next);
  }

  // Filter tags by search query
  const visibleTags = searchQuery
    ? localTags.filter((t) => t.name.toLowerCase().includes(searchQuery))
    : localTags;

  return (
    <div className="gs">
      <div className="gs-header">
        {isDraggable && !editing && (
          <div className="gs-drag-handle" title="Drag to reorder">
            <GripVertical size={14} />
          </div>
        )}
        {editing ? (
          <div className="gs-edit-row">
            <input
              className="gs-edit-input"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Group name"
              autoFocus
            />
            <input
              className="gs-edit-input gs-edit-prefix"
              value={editPrefix}
              onChange={(e) => setEditPrefix(e.target.value)}
              placeholder="Prefix (e.g. chem:)"
            />
            <button className="gs-icon-btn gs-icon-btn--confirm" onClick={handleSave} disabled={saving}>
              <Check size={13} />
            </button>
            <button className="gs-icon-btn" onClick={() => { setEditing(false); setEditName(group.name); setEditPrefix(group.prefix); }}>
              <X size={13} />
            </button>
          </div>
        ) : (
          <>
            <div className="gs-title-row">
              <TagIcon size={13} color="var(--color-accent)" />
              <span className="gs-name">{group.name}</span>
              {group.prefix && <code className="gs-prefix">{group.prefix}</code>}
              <span className="gs-count">{localTags.length} tag{localTags.length !== 1 ? "s" : ""}</span>
            </div>
            <div className="gs-actions">
              <button className="gs-icon-btn" onClick={() => setEditing(true)} title="Edit group">
                <Pencil size={12} />
              </button>
              <button className="gs-icon-btn gs-icon-btn--danger" onClick={() => setConfirmDelete(true)} title="Delete group">
                <Trash2 size={12} />
              </button>
            </div>
          </>
        )}
      </div>

      <div className="gs-tags" ref={tagsContainerRef} onDrop={(e) => { e.preventDefault(); if (tagDragOver !== null) handleTagDrop(tagDragOver); }} onDragOver={(e) => e.preventDefault()}>
        {visibleTags.map((tag, index) => (
          <div key={tag.id} className="gs-tag-wrapper">
            {tagDragOver === index && tagDragging !== null && tagDragging !== index && tagDragOver < tagDragging && !searchQuery && (
              <div className="gs-tag-slot" />
            )}
            <div
              draggable={!searchQuery}
              onDragStart={() => handleTagDragStart(index)}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setTagDragOver(index); }}
              onDragEnd={() => { setTagDragOver(null); setTagDragging(null); }}
              className={`gs-tag-drag${tagDragging === index && !searchQuery ? " gs-tag-drag--dragging" : ""}`}
            >
              <TagChip tag={tag} onDelete={() => onDeleteTag(tag)} onClick={() => onTagClick(tag)} />
            </div>
            {tagDragOver === index && tagDragging !== null && tagDragging !== index && tagDragOver > tagDragging && !searchQuery && (
              <div className="gs-tag-slot" />
            )}
          </div>
        ))}
        {!searchQuery && <NewTagInline onCreate={onCreateTag} />}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete Group"
        message={`Delete the group "${group.name}"? Tags in this group will become ungrouped. This cannot be undone.`}
        confirmLabel="Delete Group"
        onConfirm={async () => { await onDeleteGroup(group); setConfirmDelete(false); }}
        onCancel={() => setConfirmDelete(false)}
      />

      <style>{`
        .gs { border: 1px solid var(--color-border); border-radius: var(--radius-md); overflow: hidden; }
        .gs-header {
          display: flex; align-items: center; justify-content: space-between;
          gap: var(--space-3);
          padding: var(--space-3) var(--space-4);
          background: var(--color-bg-secondary);
          border-bottom: 1px solid var(--color-border);
          min-height: 44px;
        }
        .gs-drag-handle {
          color: var(--color-text-muted); cursor: grab; flex-shrink: 0;
          opacity: 0; transition: opacity var(--transition-fast);
          display: flex; align-items: center;
        }
        .gs-header:hover .gs-drag-handle { opacity: 1; }
        .gs-title-row { display: flex; align-items: center; gap: var(--space-2); flex: 1; min-width: 0; }
        .gs-name { font-size: 13px; font-weight: 600; color: var(--color-text-primary); }
        .gs-prefix { font-family: var(--font-mono); font-size: 11px; background: var(--color-accent-light); color: var(--color-accent); padding: 1px 6px; border-radius: var(--radius-sm); }
        .gs-count { font-size: 11.5px; color: var(--color-text-muted); margin-left: auto; flex-shrink: 0; }
        .gs-actions { display: flex; gap: var(--space-1); flex-shrink: 0; }
        .gs-edit-row { display: flex; align-items: center; gap: var(--space-2); flex: 1; }
        .gs-edit-input { height: 28px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); padding: 0 var(--space-2); font-size: 12.5px; background: var(--color-bg); outline: none; flex: 1; min-width: 0; transition: border-color var(--transition-fast); }
        .gs-edit-input:focus { border-color: var(--color-accent); }
        .gs-edit-prefix { flex: 0 0 120px; font-family: var(--font-mono); font-size: 12px; }
        .gs-icon-btn { display: flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: var(--radius-sm); color: var(--color-text-muted); transition: color var(--transition-fast), background var(--transition-fast); }
        .gs-icon-btn:hover { color: var(--color-text-primary); background: var(--color-bg-tertiary); }
        .gs-icon-btn--confirm:hover { color: var(--color-success) !important; }
        .gs-icon-btn--danger:hover { color: var(--color-danger) !important; background: var(--color-danger-light) !important; }
        .gs-tags { padding: var(--space-3) var(--space-4); display: flex; flex-wrap: wrap; gap: var(--space-2); align-items: center; min-height: 52px; }
        .gs-tag-wrapper { display: inline-flex; align-items: center; gap: var(--space-2); }
        .gs-tag-drag { display: inline-flex; cursor: grab; transition: opacity 200ms; }
        .gs-tag-drag--dragging { opacity: 0.35; }
        .gs-tag-slot {
          display: inline-flex;
          width: 60px;
          height: 26px;
          border-radius: var(--radius-full);
          border: 2px dashed var(--color-accent);
          background: var(--color-accent-light);
          animation: gs-slot-appear 150ms ease;
        }
        @keyframes gs-slot-appear { from { opacity: 0; width: 0; } to { opacity: 1; width: 60px; } }
      `}</style>
    </div>
  );
}
