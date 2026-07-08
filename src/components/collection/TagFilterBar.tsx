/**
 * Tag filter chip row for the collection view.
 * Active chips are tinted with the tag's color; multiple tags AND-combine.
 */
import { X } from "lucide-react";
import { Tag } from "@/types/tag";
import styles from "./TagFilterBar.module.css";

interface TagFilterBarProps {
  /** All tags present on items in this collection. */
  tags: Tag[];
  /** Currently active filter tag ids. */
  activeTagIds: Set<string>;
  /** Toggles one tag in the filter. */
  onToggle: (tagId: string) => void;
  /** Clears the whole filter. */
  onClear: () => void;
}

/**
 * Renders the tag filter chips with a "clear filters" affordance.
 */
export default function TagFilterBar({ tags, activeTagIds, onToggle, onClear }: TagFilterBarProps) {
  return (
    <div className={styles.bar}>
      {tags.map((tag) => {
        const active = activeTagIds.has(tag.id);
        return (
          <button
            key={tag.id}
            className={styles.chip}
            style={active
              ? { background: `${tag.color}22`, borderColor: tag.color, color: tag.color }
              : undefined}
            onClick={() => onToggle(tag.id)}
          >
            <span className={styles.dot} style={{ background: tag.color }} />
            {tag.name}
            {active && <X size={10} strokeWidth={2.5} />}
          </button>
        );
      })}
      {activeTagIds.size > 0 && (
        <button className={styles.clear} onClick={onClear}>
          Clear filters
        </button>
      )}
    </div>
  );
}
