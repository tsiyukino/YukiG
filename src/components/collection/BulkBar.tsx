/**
 * Floating bulk-action bar shown while items are selected:
 * select all / clear, bulk tag assign/remove/create dropdown, bulk delete.
 */
import { useState, useRef, useEffect } from "react";
import { CheckSquare, X, Tag as TagIcon, Trash2, Plus } from "lucide-react";
import { Tag } from "@/types/tag";
import styles from "./BulkBar.module.css";

interface BulkBarProps {
  selectedCount: number;
  onSelectAll: () => void;
  onClearSelection: () => void;
  bulkDeleting: boolean;
  onBulkDelete: () => void;
  allTags: Tag[];
  /** Tags shared by every selected item — offered for removal. */
  sharedTagIds: Set<string>;
  /** Id of the tag currently being mutated ("new" while creating). */
  bulkTagBusy: string | null;
  onTagAssign: (tagId: string) => void;
  onTagRemove: (tagId: string) => void;
  onTagCreate: (name: string) => void;
}

/**
 * Renders the sticky inverted action bar with the tag dropdown.
 */
export default function BulkBar({
  selectedCount,
  onSelectAll,
  onClearSelection,
  bulkDeleting,
  onBulkDelete,
  allTags,
  sharedTagIds,
  bulkTagBusy,
  onTagAssign,
  onTagRemove,
  onTagCreate,
}: BulkBarProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close the dropdown when clicking outside
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const filteredAll = allTags.filter((t) => t.name.toLowerCase().includes(query.toLowerCase()));
  const canCreate =
    query.trim().length > 0 &&
    !allTags.some((t) => t.name.toLowerCase() === query.trim().toLowerCase());

  function handleCreate() {
    onTagCreate(query.trim());
    setQuery("");
  }

  return (
    <div className={styles.bar}>
      <span className={styles.count}>
        <CheckSquare size={14} />
        {selectedCount} selected
      </span>
      <div className={styles.actions}>
        <button className={styles.ghostBtn} onClick={onSelectAll}>
          Select all
        </button>
        <button className={styles.ghostBtn} onClick={onClearSelection}>
          <X size={12} />
          Clear
        </button>

        <div className={styles.tagWrap} ref={wrapRef}>
          <button
            className={dropdownOpen ? `${styles.tagBtn} ${styles.tagBtnActive}` : styles.tagBtn}
            onClick={() => setDropdownOpen((v) => !v)}
            title="Add or remove tags on selected items"
          >
            <TagIcon size={13} />
            Tag
          </button>
          {dropdownOpen && (
            <div className={styles.dropdown}>
              <div className={styles.searchRow}>
                <TagIcon size={11} color="rgba(255,255,255,0.5)" />
                <input
                  autoFocus
                  className={styles.search}
                  placeholder="Search or create tag…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && canCreate) handleCreate();
                    if (e.key === "Escape") { setDropdownOpen(false); setQuery(""); }
                  }}
                />
              </div>

              {sharedTagIds.size > 0 && (
                <div className={styles.sectionLabel}>Remove from all</div>
              )}
              {[...sharedTagIds].map((tid) => {
                const tag = allTags.find((t) => t.id === tid);
                if (!tag || !tag.name.toLowerCase().includes(query.toLowerCase())) return null;
                return (
                  <button
                    key={tid}
                    className={`${styles.option} ${styles.optionRemove}`}
                    onClick={() => onTagRemove(tid)}
                    disabled={bulkTagBusy === tid}
                  >
                    <span className={styles.tagDot} style={{ background: tag.color }} />
                    {tag.name}
                    <X size={10} strokeWidth={2.5} style={{ marginLeft: "auto", opacity: 0.7 }} />
                  </button>
                );
              })}

              {sharedTagIds.size > 0 && filteredAll.some((t) => !sharedTagIds.has(t.id)) && (
                <div className={styles.sectionLabel}>Add to all</div>
              )}
              {filteredAll.filter((t) => !sharedTagIds.has(t.id)).map((tag) => (
                <button
                  key={tag.id}
                  className={styles.option}
                  onClick={() => onTagAssign(tag.id)}
                  disabled={bulkTagBusy === tag.id}
                >
                  <span className={styles.tagDot} style={{ background: tag.color }} />
                  {tag.name}
                </button>
              ))}

              {canCreate && (
                <button
                  className={`${styles.option} ${styles.optionCreate}`}
                  onClick={handleCreate}
                  disabled={bulkTagBusy === "new"}
                >
                  <Plus size={11} />
                  Create "{query.trim()}"
                </button>
              )}
              {filteredAll.length === 0 && !canCreate && (
                <span className={styles.empty}>No tags found</span>
              )}
            </div>
          )}
        </div>

        <button className={styles.deleteBtn} onClick={onBulkDelete} disabled={bulkDeleting}>
          <Trash2 size={13} />
          {bulkDeleting ? "Deleting…" : `Delete ${selectedCount}`}
        </button>
      </div>
    </div>
  );
}
