import { Tag } from "@/types/tag";
import TagChip from "@/components/tags/TagChip";
import NewTagInline from "@/components/tags/NewTagInline";

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
    <div className="ug">
      <div className="ug-header">
        <span className="ug-label">Ungrouped</span>
        <span className="ug-count">{tags.length} tag{tags.length !== 1 ? "s" : ""}</span>
      </div>
      <div className="ug-tags">
        {tags.map((tag) => (
          <TagChip key={tag.id} tag={tag} onDelete={() => onDeleteTag(tag)} onClick={() => onTagClick(tag)} />
        ))}
        <NewTagInline onCreate={onCreateTag} />
      </div>
      <style>{`
        .ug { border: 1px dashed var(--color-border); border-radius: var(--radius-md); overflow: hidden; }
        .ug-header { display: flex; align-items: center; gap: var(--space-2); padding: var(--space-2) var(--space-4); background: var(--color-bg-secondary); border-bottom: 1px solid var(--color-border); }
        .ug-label { font-size: 12px; font-weight: 600; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
        .ug-count { font-size: 11.5px; color: var(--color-text-muted); margin-left: auto; }
        .ug-tags { padding: var(--space-3) var(--space-4); display: flex; flex-wrap: wrap; gap: var(--space-2); align-items: center; min-height: 52px; }
      `}</style>
    </div>
  );
}
