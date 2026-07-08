import { useState, useEffect, useRef } from "react";
import { Pencil, Trash2, Check, X, Tag as TagIcon, GripVertical } from "lucide-react";
import { Tag, TagGroup } from "@/types/tag";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import TagChip from "@/components/tags/TagChip";
import NewTagInline from "@/components/tags/NewTagInline";
import styles from "./TagGroupSection.module.css";

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
    <div className={styles.gs}>
      <div className={styles.header}>
        {isDraggable && !editing && (
          <div className={styles.dragHandle} title="Drag to reorder">
            <GripVertical size={14} />
          </div>
        )}
        {editing ? (
          <div className={styles.editRow}>
            <input
              className={styles.editInput}
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Group name"
              autoFocus
            />
            <input
              className={`${styles.editInput} ${styles.editPrefix}`}
              value={editPrefix}
              onChange={(e) => setEditPrefix(e.target.value)}
              placeholder="Prefix (e.g. chem:)"
            />
            <button className={`${styles.iconBtn} ${styles.confirmBtn}`} onClick={handleSave} disabled={saving}>
              <Check size={13} />
            </button>
            <button className={styles.iconBtn} onClick={() => { setEditing(false); setEditName(group.name); setEditPrefix(group.prefix); }}>
              <X size={13} />
            </button>
          </div>
        ) : (
          <>
            <div className={styles.titleRow}>
              <TagIcon size={13} color="var(--color-accent)" />
              <span className={styles.name}>{group.name}</span>
              {group.prefix && <code className={styles.prefix}>{group.prefix}</code>}
              <span className={styles.count}>{localTags.length} tag{localTags.length !== 1 ? "s" : ""}</span>
            </div>
            <div className={styles.actions}>
              <button className={styles.iconBtn} onClick={() => setEditing(true)} title="Edit group">
                <Pencil size={12} />
              </button>
              <button className={`${styles.iconBtn} ${styles.dangerBtn}`} onClick={() => setConfirmDelete(true)} title="Delete group">
                <Trash2 size={12} />
              </button>
            </div>
          </>
        )}
      </div>

      <div className={styles.tags} onDrop={(e) => { e.preventDefault(); if (tagDragOver !== null) handleTagDrop(tagDragOver); }} onDragOver={(e) => e.preventDefault()}>
        {visibleTags.map((tag, index) => (
          <div key={tag.id} className={styles.tagWrapper}>
            {tagDragOver === index && tagDragging !== null && tagDragging !== index && tagDragOver < tagDragging && !searchQuery && (
              <div className={styles.tagSlot} />
            )}
            <div
              draggable={!searchQuery}
              onDragStart={() => handleTagDragStart(index)}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setTagDragOver(index); }}
              onDragEnd={() => { setTagDragOver(null); setTagDragging(null); }}
              className={tagDragging === index && !searchQuery ? `${styles.tagDrag} ${styles.tagDragging}` : styles.tagDrag}
            >
              <TagChip tag={tag} onDelete={() => onDeleteTag(tag)} onClick={() => onTagClick(tag)} />
            </div>
            {tagDragOver === index && tagDragging !== null && tagDragging !== index && tagDragOver > tagDragging && !searchQuery && (
              <div className={styles.tagSlot} />
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
    </div>
  );
}
