/**
 * Tags page — view and manage all tags and tag groups.
 *
 * Features:
 * - Search by tag name or group prefix
 * - Drag-to-reorder tag groups
 * - Drag-to-reorder tags within a group
 * - Create, rename, and delete groups and tags
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X } from "lucide-react";
import {
  tagGetAll,
  tagCreate,
  tagCreateInGroup,
  tagDelete,
  tagGroupGetAll,
  tagGroupCreate,
  tagGroupUpdate,
  tagGroupDelete,
  tagGroupReorder,
} from "@/services/tauriCommands";
import { Tag, TagGroup } from "@/types/tag";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import GroupSection from "@/components/tags/TagGroupSection";
import UngroupedSection from "@/components/tags/UngroupedSection";
import NewGroupInline from "@/components/tags/NewGroupInline";


/** Main Tags page component. */
export default function TagsPage() {
  const [groups, setGroups] = useState<TagGroup[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  // Group drag state
  const groupDragIndexRef = useRef<number | null>(null);
  const [groupDragOver, setGroupDragOver] = useState<number | null>(null);
  const [groupDragging, setGroupDragging] = useState<number | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const [g, t] = await Promise.all([tagGroupGetAll(), tagGetAll()]);
    setGroups(g);
    setTags(t);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Tags not assigned to any group
  const ungrouped = tags.filter((t) => !t.group_id);

  // Search filter: matches tag name or group prefix/name
  const q = search.trim().toLowerCase();
  const filteredGroups = q
    ? groups.filter((g) =>
        g.name.toLowerCase().includes(q) ||
        g.prefix.toLowerCase().includes(q) ||
        tags.some((t) => t.group_id === g.id && t.name.toLowerCase().includes(q))
      )
    : groups;
  const filteredUngrouped = q
    ? ungrouped.filter((t) => t.name.toLowerCase().includes(q))
    : ungrouped;

  async function handleDeleteTag(tag: Tag) {
    await tagDelete(tag.id);
    setTags((prev) => prev.filter((t) => t.id !== tag.id));
  }

  async function handleDeleteGroup(group: TagGroup) {
    await tagGroupDelete(group.id);
    setGroups((prev) => prev.filter((g) => g.id !== group.id));
    setTags((prev) => prev.map((t) => t.group_id === group.id ? { ...t, group_id: null } : t));
  }

  async function handleCreateGroup(name: string, prefix: string) {
    const g = await tagGroupCreate(name, prefix);
    setGroups((prev) => [...prev, g]);
  }

  async function handleUpdateGroup(groupId: string, name: string, prefix: string) {
    const updated = await tagGroupUpdate(groupId, name, prefix);
    setGroups((prev) => prev.map((g) => g.id === groupId ? updated : g));
  }

  async function handleCreateTag(name: string, color: string, groupId: string | null) {
    const tag = groupId
      ? await tagCreateInGroup(name, color, groupId)
      : await tagCreate(name, color);
    setTags((prev) => [...prev, tag]);
  }

  // Reorder tags within a group (local state only — tags have no sort_order column yet)
  function handleReorderTagsInGroup(groupId: string, reordered: Tag[]) {
    setTags((prev) => {
      const others = prev.filter((t) => t.group_id !== groupId);
      return [...others, ...reordered];
    });
  }

  // Drag group reorder
  function handleGroupDragStart(index: number) { groupDragIndexRef.current = index; setGroupDragging(index); }
  async function handleGroupDrop(dropIndex: number) {
    const from = groupDragIndexRef.current;
    setGroupDragOver(null);
    setGroupDragging(null);
    if (from === null || from === dropIndex) return;
    const next = [...groups];
    const [moved] = next.splice(from, 1);
    next.splice(dropIndex, 0, moved);
    setGroups(next);
    groupDragIndexRef.current = null;
    await tagGroupReorder(next.map((g, i) => [g.id, i])).catch(() => {});
  }

  if (loading) return <LoadingSpinner message="Loading tags…" />;

  return (
    <div className="tp">
      <div className="tp-header">
        <div>
          <h1 className="tp-title">Tags</h1>
          <p className="tp-subtitle">
            {tags.length} tag{tags.length !== 1 ? "s" : ""} across {groups.length} group{groups.length !== 1 ? "s" : ""}
          </p>
        </div>
        <NewGroupInline onCreate={handleCreateGroup} />
      </div>

      {/* Search */}
      <div className="tp-search-wrap">
        <Search size={13} color="var(--color-text-muted)" />
        <input
          className="tp-search"
          type="text"
          placeholder="Search by name or prefix…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <button className="tp-search-clear" onClick={() => setSearch("")}>
            <X size={11} strokeWidth={2.5} />
          </button>
        )}
      </div>

      <div className="tp-body" ref={bodyRef} onDrop={(e) => { e.preventDefault(); if (groupDragOver !== null) handleGroupDrop(groupDragOver); }} onDragOver={(e) => e.preventDefault()}>
        {/* Groups */}
        {filteredGroups.map((group, index) => (
          <div key={group.id} className="tp-drag-wrapper">
            {groupDragOver === index && groupDragging !== null && groupDragging !== index && groupDragOver < groupDragging && !q && (
              <div className="tp-drop-slot" />
            )}
            <div
              draggable={!q}
              onDragStart={() => handleGroupDragStart(index)}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setGroupDragOver(index); }}
              onDragEnd={() => { setGroupDragOver(null); setGroupDragging(null); }}
              className={`tp-drag-group${groupDragging === index && !q ? " tp-drag-group--dragging" : ""}`}
            >
              <GroupSection
                group={group}
                tags={tags.filter((t) => t.group_id === group.id)}
                searchQuery={q}
                onUpdateGroup={handleUpdateGroup}
                onDeleteGroup={handleDeleteGroup}
                onCreateTag={(name, color) => handleCreateTag(name, color, group.id)}
                onDeleteTag={handleDeleteTag}
                onTagClick={(tag) => navigate(`/search?tag=${tag.id}`)}
                onReorderTags={(reordered) => handleReorderTagsInGroup(group.id, reordered)}
                isDraggable={!q}
              />
            </div>
            {groupDragOver === index && groupDragging !== null && groupDragging !== index && groupDragOver > groupDragging && !q && (
              <div className="tp-drop-slot" />
            )}
          </div>
        ))}

        {/* Ungrouped */}
        {(filteredUngrouped.length > 0 || (groups.length === 0 && !q)) && (
          <UngroupedSection
            tags={filteredUngrouped}
            onCreateTag={(name, color) => handleCreateTag(name, color, null)}
            onDeleteTag={handleDeleteTag}
            onTagClick={(tag) => navigate(`/search?tag=${tag.id}`)}
          />
        )}

        {q && filteredGroups.length === 0 && filteredUngrouped.length === 0 && (
          <div className="tp-no-results">No tags or groups match "{search}"</div>
        )}
      </div>

      <style>{`
        .tp { width: 100%; display: flex; flex-direction: column; gap: var(--space-5); }
        .tp-header {
          position: sticky;
          top: calc(-1 * var(--space-4));
          z-index: 10;
          background: var(--color-bg);
          display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-4);
          padding-top: var(--space-4);
          padding-bottom: var(--space-5);
          border-bottom: 1px solid var(--color-border-subtle);
          margin-bottom: calc(-1 * var(--space-5));
        }
        .tp-title { font-size: 22px; font-weight: 700; letter-spacing: -0.025em; }
        .tp-subtitle { font-size: 12.5px; color: var(--color-text-muted); margin-top: 2px; }
        .tp-search-wrap {
          display: flex; align-items: center; gap: var(--space-2);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          padding: 6px var(--space-3);
          background: var(--color-bg-secondary);
          transition: border-color var(--transition-fast);
        }
        .tp-search-wrap:focus-within { border-color: var(--color-accent); }
        .tp-search {
          flex: 1; background: none; border: none; outline: none;
          font-size: 13px; color: var(--color-text-primary);
        }
        .tp-search::placeholder { color: var(--color-text-muted); }
        .tp-search-clear {
          display: flex; align-items: center; color: var(--color-text-muted);
          transition: color var(--transition-fast);
        }
        .tp-search-clear:hover { color: var(--color-text-primary); }
        .tp-body { display: flex; flex-direction: column; gap: var(--space-4); }
        .tp-drag-wrapper { display: flex; flex-direction: column; gap: var(--space-4); }
        .tp-drag-group { border-radius: var(--radius-md); transition: opacity 200ms; }
        .tp-drag-group--dragging { opacity: 0.35; }
        .tp-drop-slot {
          border-radius: var(--radius-md);
          border: 2px dashed var(--color-accent);
          background: var(--color-accent-light);
          min-height: 60px;
          animation: tp-slot-appear 150ms ease;
        }
        @keyframes tp-slot-appear { from { opacity: 0; transform: scaleY(0.85); } to { opacity: 1; transform: scaleY(1); } }
        .tp-no-results { font-size: 13px; color: var(--color-text-muted); padding: var(--space-4) 0; text-align: center; }
      `}</style>
    </div>
  );
}