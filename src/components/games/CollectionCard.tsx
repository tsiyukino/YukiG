import { FolderOpen, Trash2 } from "lucide-react";
import { Collection } from "@/types/collection";
import Card from "@/components/common/Card";

interface CollectionCardProps {
  /** The collection to display. */
  collection: Collection;
  /** Called when the card is clicked (navigate to collection). */
  onClick: () => void;
  /** Called when the delete button is clicked. */
  onDelete: (e: React.MouseEvent) => void;
}

/**
 * Large card for a collection in the Card view of GamesPage.
 * Shows accent bar, icon, name, description, strategy badge, and a footer with a delete button.
 */
export default function CollectionCard({ collection, onClick, onDelete }: CollectionCardProps) {
  const initials = collection.name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <Card onClick={onClick}>
      <div className="ccard">
        <div className="ccard-accent" style={{ background: collection.color }} />
        <div className="ccard-body">
          <div
            className="ccard-icon"
            style={{ background: `${collection.color}20`, color: collection.color }}
          >
            {initials || <FolderOpen size={16} color={collection.color} />}
          </div>
          <div className="ccard-info">
            <h2 className="ccard-name">{collection.name}</h2>
            {collection.description && (
              <p className="ccard-desc">{collection.description}</p>
            )}
          </div>
          <span
            className="ccard-strategy"
            style={{ background: `${collection.color}14`, color: collection.color }}
          >
            {collection.default_strategy}
          </span>
        </div>
        <div className="ccard-footer">
          <span className="ccard-footer-label">View collection</span>
          <button className="ccard-delete" onClick={onDelete} title="Delete collection">
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      <style>{`
        .ccard { display: flex; flex-direction: column; overflow: hidden; border-radius: inherit; flex: 1; min-height: 160px; }
        .ccard-accent { height: 4px; width: 100%; flex-shrink: 0; }
        .ccard-body { padding: var(--space-4) var(--space-4) var(--space-3); display: flex; flex-direction: column; gap: var(--space-3); flex: 1; min-height: 0; }
        .ccard-icon { width: 40px; height: 40px; border-radius: var(--radius-md); display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700; letter-spacing: -0.02em; flex-shrink: 0; }
        .ccard-info { flex: 1; min-width: 0; }
        .ccard-name { font-size: 14px; font-weight: 650; color: var(--color-text-primary); letter-spacing: -0.02em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ccard-desc { font-size: 12px; color: var(--color-text-muted); margin-top: 3px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.5; }
        .ccard-strategy { align-self: flex-start; padding: 2px 8px; border-radius: var(--radius-full); font-size: 10.5px; font-weight: 600; text-transform: capitalize; letter-spacing: 0.02em; }
        .ccard-footer { display: flex; align-items: center; justify-content: space-between; padding: var(--space-2) var(--space-3) var(--space-2) var(--space-4); border-top: 1px solid var(--color-border-subtle); background: var(--color-bg-secondary); }
        .ccard-footer-label { font-size: 11.5px; color: var(--color-text-muted); font-weight: 500; transition: color var(--transition-fast); }
        .ccard:hover .ccard-footer-label { color: var(--color-accent); }
        .ccard-delete { display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: var(--radius-sm); opacity: 0; color: var(--color-text-muted); transition: opacity var(--transition-fast), color var(--transition-fast), background var(--transition-fast); }
        .ccard:hover .ccard-delete { opacity: 1; }
        .ccard-delete:hover { color: var(--color-danger); background: var(--color-danger-light); }
      `}</style>
    </Card>
  );
}
