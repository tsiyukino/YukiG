import { FolderOpen, Trash2 } from "lucide-react";
import { Collection } from "@/types/collection";

interface CompactCardProps {
  /** The collection to display. */
  collection: Collection;
  /** Called when the card is clicked (navigate to collection). */
  onClick: () => void;
  /** Called when the delete button is clicked. */
  onDelete: (e: React.MouseEvent) => void;
}

/**
 * Compact card for a collection in the Compact view of GamesPage.
 * Denser layout — icon initials, name, and a hover-revealed delete button.
 */
export default function CompactCard({ collection, onClick, onDelete }: CompactCardProps) {
  const initials = collection.name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <button className="ccrd" onClick={onClick}>
      <div className="ccrd-top" style={{ background: `${collection.color}16` }}>
        <div className="ccrd-icon" style={{ background: `${collection.color}30`, color: collection.color }}>
          {initials || <FolderOpen size={13} color={collection.color} />}
        </div>
        <button className="ccrd-del" onClick={onDelete} title="Delete">
          <Trash2 size={11} />
        </button>
      </div>
      <div className="ccrd-label">{collection.name}</div>

      <style>{`
        .ccrd {
          display: flex; flex-direction: column;
          border-radius: var(--radius-md);
          border: 1px solid var(--color-border);
          overflow: hidden;
          background: var(--color-bg);
          transition: box-shadow var(--transition-fast), border-color var(--transition-fast);
          text-align: left;
          cursor: pointer;
        }
        .ccrd:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.07); border-color: var(--color-accent); }
        .ccrd-top {
          display: flex; align-items: flex-start; justify-content: space-between;
          padding: var(--space-2) var(--space-2) var(--space-1);
        }
        .ccrd-icon {
          width: 32px; height: 32px;
          border-radius: var(--radius-sm);
          display: flex; align-items: center; justify-content: center;
          font-size: 12px; font-weight: 700;
        }
        .ccrd-del {
          opacity: 0; display: flex; align-items: center; justify-content: center;
          width: 20px; height: 20px; border-radius: var(--radius-sm);
          color: var(--color-text-muted);
          transition: opacity var(--transition-fast), color var(--transition-fast), background var(--transition-fast);
        }
        .ccrd:hover .ccrd-del { opacity: 1; }
        .ccrd-del:hover { color: var(--color-danger); background: var(--color-danger-light); }
        .ccrd-label {
          padding: var(--space-1) var(--space-2) var(--space-2);
          font-size: 12px; font-weight: 600;
          color: var(--color-text-primary);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
      `}</style>
    </button>
  );
}
