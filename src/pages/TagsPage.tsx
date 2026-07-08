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
import PageTitle from "@/components/common/PageTitle";
import styles from "./TagsPage.module.css";


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
    <div className={styles.page}>
      <PageTitle
        title="Tags"
        subtitle={`${tags.length} tag${tags.length !== 1 ? "s" : ""} across ${groups.length} group${groups.length !== 1 ? "s" : ""}`}
        actions={<NewGroupInline onCreate={handleCreateGroup} />}
      />

      {/* Search */}
      <div className={styles.searchWrap}>
        <Search size={13} color="var(--color-text-muted)" />
        <input
          className={styles.search}
          type="text"
          placeholder="Search by name or prefix…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <button className={styles.searchClear} onClick={() => setSearch("")}>
            <X size={11} strokeWidth={2.5} />
          </button>
        )}
      </div>

      <div className={styles.body} ref={bodyRef} onDrop={(e) => { e.preventDefault(); if (groupDragOver !== null) handleGroupDrop(groupDragOver); }} onDragOver={(e) => e.preventDefault()}>
        {/* Groups */}
        {filteredGroups.map((group, index) => (
          <div key={group.id} className={styles.dragWrapper}>
            {groupDragOver === index && groupDragging !== null && groupDragging !== index && groupDragOver < groupDragging && !q && (
              <div className={styles.dropSlot} />
            )}
            <div
              draggable={!q}
              onDragStart={() => handleGroupDragStart(index)}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setGroupDragOver(index); }}
              onDragEnd={() => { setGroupDragOver(null); setGroupDragging(null); }}
              className={groupDragging === index && !q ? `${styles.dragGroup} ${styles.dragging}` : styles.dragGroup}
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
              <div className={styles.dropSlot} />
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
          <div className={styles.noResults}>No tags or groups match "{search}"</div>
        )}
      </div>

    </div>
  );
}