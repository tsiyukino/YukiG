/**
 * Inline tag assignment component.
 *
 * Displays the item's current tags as removable chips, and provides a
 * dropdown to assign existing tags or create new ones on the fly.
 */
import { useState, useRef, useEffect } from "react";
import { Plus, X, Tag as TagIcon } from "lucide-react";
import { Tag } from "@/types/tag";

/** Default palette for new tags created inline. */
const TAG_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e",
  "#f97316", "#eab308", "#22c55e", "#14b8a6",
  "#3b82f6", "#94a3b8",
];

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
    const color = TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)];
    setBusy("new");
    try {
      await onCreateAndAssign(name, color);
      setQuery("");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="tp-root" ref={containerRef}>
      <div className="tp-chips">
        {itemTags.map((tag) => (
          <span
            key={tag.id}
            className="tp-chip"
            style={{ background: `${tag.color}22`, borderColor: `${tag.color}55`, color: tag.color }}
          >
            {tag.name}
            <button
              className="tp-chip-remove"
              onClick={() => handleRemove(tag.id)}
              disabled={busy === tag.id}
              title={`Remove tag "${tag.name}"`}
            >
              <X size={10} strokeWidth={2.5} />
            </button>
          </span>
        ))}

        <button className="tp-add-btn" onClick={() => setOpen((o) => !o)} title="Add tag">
          <Plus size={12} strokeWidth={2.5} />
          <span>Add tag</span>
        </button>
      </div>

      {open && (
        <div className="tp-dropdown">
          <div className="tp-search-row">
            <TagIcon size={12} color="var(--color-text-muted)" />
            <input
              ref={inputRef}
              className="tp-search"
              placeholder="Search or create tag…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canCreate) handleCreate();
                if (e.key === "Escape") { setOpen(false); setQuery(""); }
              }}
            />
          </div>

          <div className="tp-list">
            {filtered.map((tag) => (
              <button
                key={tag.id}
                className="tp-option"
                onClick={() => handleAssign(tag.id)}
                disabled={busy === tag.id}
              >
                <span
                  className="tp-option-dot"
                  style={{ background: tag.color }}
                />
                {tag.name}
              </button>
            ))}

            {canCreate && (
              <button
                className="tp-option tp-option--create"
                onClick={handleCreate}
                disabled={busy === "new"}
              >
                <Plus size={12} />
                Create "{query.trim()}"
              </button>
            )}

            {filtered.length === 0 && !canCreate && (
              <span className="tp-empty">No tags found</span>
            )}
          </div>
        </div>
      )}

      <style>{`
        .tp-root { position: relative; }
        .tp-chips {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: var(--space-2);
        }
        .tp-chip {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 3px 8px 3px 9px;
          border-radius: var(--radius-full);
          border: 1px solid;
          font-size: 12px;
          font-weight: 500;
          line-height: 1;
        }
        .tp-chip-remove {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          opacity: 0.6;
          transition: opacity var(--transition-fast);
        }
        .tp-chip-remove:hover { opacity: 1; }
        .tp-add-btn {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 9px;
          border-radius: var(--radius-full);
          border: 1px dashed var(--color-border);
          font-size: 12px;
          color: var(--color-text-muted);
          transition: color var(--transition-fast), border-color var(--transition-fast), background var(--transition-fast);
        }
        .tp-add-btn:hover {
          color: var(--color-accent);
          border-color: var(--color-accent);
          background: var(--color-accent-light);
        }
        .tp-dropdown {
          position: absolute;
          top: calc(100% + 6px);
          left: 0;
          z-index: 50;
          min-width: 220px;
          background: var(--color-bg);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          box-shadow: 0 4px 16px rgba(0,0,0,0.1);
          overflow: hidden;
        }
        .tp-search-row {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-2) var(--space-3);
          border-bottom: 1px solid var(--color-border-subtle);
        }
        .tp-search {
          background: none;
          border: none;
          outline: none;
          font-size: 12.5px;
          color: var(--color-text-primary);
          flex: 1;
          min-width: 0;
        }
        .tp-search::placeholder { color: var(--color-text-muted); }
        .tp-list {
          max-height: 200px;
          overflow-y: auto;
          padding: var(--space-1);
        }
        .tp-option {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          width: 100%;
          padding: 6px var(--space-2);
          font-size: 13px;
          color: var(--color-text-primary);
          border-radius: var(--radius-sm);
          text-align: left;
          transition: background var(--transition-fast);
        }
        .tp-option:hover:not(:disabled) { background: var(--color-bg-secondary); }
        .tp-option:disabled { opacity: 0.5; }
        .tp-option--create { color: var(--color-accent); }
        .tp-option-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .tp-empty {
          display: block;
          padding: var(--space-3);
          font-size: 12.5px;
          color: var(--color-text-muted);
          text-align: center;
        }
      `}</style>
    </div>
  );
}
