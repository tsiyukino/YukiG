import { FolderOpen, Plus } from "lucide-react";

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
    <div className="cp-empty">
      <div className="cp-empty-icon">
        <FolderOpen size={28} color="var(--color-text-muted)" />
      </div>
      <p className="cp-empty-title">{isFolder ? "This folder is empty" : "No items yet"}</p>
      <p className="cp-empty-hint">
        {isFolder ? "Add items into this folder to get started." : "Add your first item to get started."}
      </p>
      <button className="cp-add-btn" onClick={onAdd}>
        <Plus size={14} />
        Add
      </button>
      <style>{`
        .cp-empty {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: var(--space-2); padding: 80px var(--space-12); text-align: center;
        }
        .cp-empty-icon {
          width: 56px; height: 56px; border-radius: var(--radius-lg);
          background: var(--color-bg-secondary); border: 1px solid var(--color-border);
          display: flex; align-items: center; justify-content: center;
          margin-bottom: var(--space-2);
        }
        .cp-empty-title { font-size: 15px; font-weight: 600; color: var(--color-text-primary); }
        .cp-empty-hint { font-size: 13px; color: var(--color-text-muted); margin-bottom: var(--space-2); }
        .cp-add-btn {
          display: flex; align-items: center; gap: var(--space-1);
          padding: 8px 16px;
          background: var(--color-accent); color: white;
          border-radius: var(--radius-sm);
          font-size: 13px; font-weight: 500;
          transition: background var(--transition-fast);
        }
        .cp-add-btn:hover { background: var(--color-accent-hover); }
      `}</style>
    </div>
  );
}
