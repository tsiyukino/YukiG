import { FolderOpen, Layers, Trash2, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Item } from "@/types/item";

interface VirtualFolderCardProps {
  /** The virtual_folder or disk-backed folder item to display. */
  item: Item;
  /** Accent color inherited from the parent collection. */
  collectionColor: string;
  /** Called when the card body is clicked (navigate into folder). */
  onClick: () => void;
  /** Called when the delete button is clicked. */
  onDelete: (e: React.MouseEvent) => void;
}

/**
 * Card for a virtual_folder or disk-backed folder item.
 * Disk-backed folders (`folder` strategy) show an ⓘ button that opens the detail page.
 */
export default function VirtualFolderCard({ item, collectionColor, onClick, onDelete }: VirtualFolderCardProps) {
  const navigate = useNavigate();
  const collectionId = item.collection_id;

  return (
    <div className="vfc" onClick={onClick} role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") onClick(); }}
    >
      <div className="vfc-icon" style={{ background: `${collectionColor}22` }}>
        <FolderOpen size={18} color={collectionColor} />
      </div>
      <div className="vfc-info">
        <span className="vfc-name">{item.name}</span>
        <span className="vfc-sub">
          {item.strategy_type === "folder" ? "Disk folder" : "Virtual folder"}
        </span>
      </div>
      <div className="vfc-right">
        {item.strategy_type === "folder" && (
          <button
            className="vfc-info-btn"
            onClick={(e) => { e.stopPropagation(); navigate(`/collections/${collectionId}/items/${item.id}`); }}
            title="View folder details"
          >
            <Layers size={12} />
          </button>
        )}
        <button
          className="vfc-delete"
          onClick={(e) => { e.stopPropagation(); onDelete(e); }}
          title="Delete folder"
        >
          <Trash2 size={12} />
        </button>
        <ChevronRight size={14} className="vfc-chevron" color="var(--color-text-muted)" />
      </div>
      <style>{`
        .vfc {
          display: flex; align-items: center; gap: var(--space-3);
          padding: var(--space-3);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          background: var(--color-bg);
          cursor: pointer;
          transition: background var(--transition-fast), border-color var(--transition-fast), box-shadow var(--transition-fast);
        }
        .vfc:hover { background: var(--color-bg-secondary); border-color: var(--color-accent); box-shadow: 0 1px 6px rgba(99,102,241,0.08); }
        .vfc-icon {
          width: 34px; height: 34px; border-radius: var(--radius-sm);
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .vfc-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
        .vfc-name { font-size: 13px; font-weight: 600; color: var(--color-text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .vfc-sub { font-size: 11px; color: var(--color-text-muted); }
        .vfc-right {
          display: flex; align-items: center; gap: 4px; flex-shrink: 0;
        }
        .vfc-info-btn {
          width: 26px; height: 26px; border-radius: var(--radius-sm);
          display: flex; align-items: center; justify-content: center;
          color: var(--color-text-muted);
          opacity: 0;
          transition: color var(--transition-fast), background var(--transition-fast), opacity var(--transition-fast);
        }
        .vfc:hover .vfc-info-btn { opacity: 1; }
        .vfc-info-btn:hover { color: var(--color-accent); background: var(--color-accent-light); }
        .vfc-delete {
          width: 26px; height: 26px; border-radius: var(--radius-sm);
          display: flex; align-items: center; justify-content: center;
          color: var(--color-text-muted);
          opacity: 0;
          transition: color var(--transition-fast), background var(--transition-fast), opacity var(--transition-fast);
        }
        .vfc:hover .vfc-delete { opacity: 1; }
        .vfc-delete:hover { color: var(--color-danger); background: color-mix(in srgb, var(--color-danger) 12%, transparent); }
        .vfc-chevron { opacity: 0.4; }
      `}</style>
    </div>
  );
}
