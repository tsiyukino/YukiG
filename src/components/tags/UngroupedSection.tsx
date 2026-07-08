import { Tag } from "@/types/tag";
import TagChip from "@/components/tags/TagChip";
import NewTagInline from "@/components/tags/NewTagInline";
import styles from "./UngroupedSection.module.css";

interface UngroupedSectionProps {
  /** Tags that have no group assignment. */
  tags: Tag[];
  /** Called to create a new ungrouped tag. */
  onCreateTag: (name: string, color: string) => Promise<void>;
  /** Called to delete a tag. */
  onDeleteTag: (t: Tag) => Promise<void>;
  /** Called when a tag chip is clicked (navigate to search). */
  onTagClick: (t: Tag) => void;
}

/**
 * A special section at the bottom of the Tags page that shows all tags
 * not assigned to any group, plus an inline "Add tag" form.
 */
export default function UngroupedSection({
  tags, onCreateTag, onDeleteTag, onTagClick,
}: UngroupedSectionProps) {
  return (
    <div className={styles.ug}>
      <div className={styles.header}>
        <span className={styles.label}>Ungrouped</span>
        <span className={styles.count}>{tags.length} tag{tags.length !== 1 ? "s" : ""}</span>
      </div>
      <div className={styles.tags}>
        {tags.map((tag) => (
          <TagChip key={tag.id} tag={tag} onDelete={() => onDeleteTag(tag)} onClick={() => onTagClick(tag)} />
        ))}
        <NewTagInline onCreate={onCreateTag} />
      </div>
    </div>
  );
}
