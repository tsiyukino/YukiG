/**
 * Inline tag assignment component.
 *
 * Displays the item's current tags as removable chips, and provides a
 * dropdown to assign existing tags or create new ones on the fly.
 */
import { useState, useRef, useEffect } from "react";
import { Plus, X, Tag as TagIcon } from "lucide-react";
import { Tag } from "@/types/tag";
import { randomTagColor } from "@/utils/colorPalettes";
import styles from "./TagPicker.module.css";

interface TagPickerProps {
  /** Tags currently assigned to the item. */
  itemTags: Tag[];
  /** All available tags in the system. */
  allTags: Tag[];
  /** Called when the user selects an existing tag to assign. */
  onAssign: (tagId: string) => Promise<void>;
  /** Called when the user removes a tag from the item. */
  onRemove: (tagId: string) => Promise<void>;
  /** Called when the user creates a brand-new tag. */
  onCreateAndAssign: (name: string, color: string) => Promise<void>;
}

/**
 * Renders the current item's tags as chips with an inline picker for adding more.
 */
export default function TagPicker({
  itemTags,
  allTags,
  onAssign,
  onRemove,
  onCreateAndAssign,
}: TagPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // Focus input when dropdown opens
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const assignedIds = new Set(itemTags.map((t) => t.id));

  const filtered = allTags.filter(
    (t) =>
      !assignedIds.has(t.id) &&
      t.name.toLowerCase().includes(query.toLowerCase())
  );

  const canCreate =
    query.trim().length > 0 &&
    !allTags.some((t) => t.name.toLowerCase() === query.trim().toLowerCase());

  async function handleAssign(tagId: string) {
    setBusy(tagId);
    try {
      await onAssign(tagId);
    } finally {
      setBusy(null);
      setQuery("");
    }
  }

  async function handleRemove(tagId: string) {
    setBusy(tagId);
    try {
      await onRemove(tagId);
    } finally {
      setBusy(null);
    }
  }

  async function handleCreate() {
    const name = query.trim();
    if (!name) return;
    setBusy("new");
    try {
      await onCreateAndAssign(name, randomTagColor());
      setQuery("");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={styles.root} ref={containerRef}>
      <div className={styles.chips}>
        {itemTags.map((tag) => (
          <span
            key={tag.id}
            className={styles.chip}
            style={{ background: `${tag.color}22`, borderColor: `${tag.color}55`, color: tag.color }}
          >
            {tag.name}
            <button
              className={styles.chipRemove}
              onClick={() => handleRemove(tag.id)}
              disabled={busy === tag.id}
              title={`Remove tag "${tag.name}"`}
            >
              <X size={10} strokeWidth={2.5} />
            </button>
          </span>
        ))}

        <button className={styles.addBtn} onClick={() => setOpen((o) => !o)} title="Add tag">
          <Plus size={12} strokeWidth={2.5} />
          <span>Add tag</span>
        </button>
      </div>

      {open && (
        <div className={styles.dropdown}>
          <div className={styles.searchRow}>
            <TagIcon size={12} color="var(--color-text-muted)" />
            <input
              ref={inputRef}
              className={styles.search}
              placeholder="Search or create tag…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canCreate) handleCreate();
                if (e.key === "Escape") { setOpen(false); setQuery(""); }
              }}
            />
          </div>

          <div className={styles.list}>
            {filtered.map((tag) => (
              <button
                key={tag.id}
                className={styles.option}
                onClick={() => handleAssign(tag.id)}
                disabled={busy === tag.id}
              >
                <span className={styles.dot} style={{ background: tag.color }} />
                {tag.name}
              </button>
            ))}

            {canCreate && (
              <button
                className={`${styles.option} ${styles.optionCreate}`}
                onClick={handleCreate}
                disabled={busy === "new"}
              >
                <Plus size={12} />
                Create "{query.trim()}"
              </button>
            )}

            {filtered.length === 0 && !canCreate && (
              <span className={styles.empty}>No tags found</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
