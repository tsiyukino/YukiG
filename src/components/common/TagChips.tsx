/**
 * Compact read-only row of colored tag chips with a "+n" overflow marker.
 * Shared by the item card, list row, and gallery card.
 */
import { Tag } from "@/types/tag";
import styles from "./TagChips.module.css";

interface TagChipsProps {
  /** Tags to display. */
  tags: Tag[];
  /** How many chips to show before collapsing into "+n". */
  max: number;
}

/**
 * Renders up to `max` tag chips tinted with each tag's color,
 * plus an overflow chip when there are more.
 */
export default function TagChips({ tags, max }: TagChipsProps) {
  if (tags.length === 0) return null;

  return (
    <div className={styles.chips}>
      {tags.slice(0, max).map((tag) => (
        <span
          key={tag.id}
          className={styles.chip}
          style={{ background: `${tag.color}22`, color: tag.color }}
        >
          {tag.name}
        </span>
      ))}
      {tags.length > max && (
        <span className={`${styles.chip} ${styles.more}`}>+{tags.length - max}</span>
      )}
    </div>
  );
}
