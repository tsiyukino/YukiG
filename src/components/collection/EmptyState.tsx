import { FolderOpen, Plus } from "lucide-react";
import styles from "./EmptyState.module.css";

interface EmptyStateProps {
  /** Called when the user clicks the "Add" button. */
  onAdd: () => void;
  /** Whether we are inside a virtual/disk folder (changes copy). */
  isFolder: boolean;
}

/**
 * Empty collection or folder placeholder shown when there are no items.
 * Displays contextual copy depending on whether we are inside a folder.
 */
export default function EmptyState({ onAdd, isFolder }: EmptyStateProps) {
  return (
    <div className={styles.empty}>
      <div className={styles.icon}>
        <FolderOpen size={28} color="var(--color-text-muted)" />
      </div>
      <p className={styles.title}>{isFolder ? "This folder is empty" : "No items yet"}</p>
      <p className={styles.hint}>
        {isFolder ? "Add items into this folder to get started." : "Add your first item to get started."}
      </p>
      <button className={styles.addBtn} onClick={onAdd}>
        <Plus size={14} />
        Add
      </button>
    </div>
  );
}
