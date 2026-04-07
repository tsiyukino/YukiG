import { FolderOpen, Layers, Trash2, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Item } from "@/types/item";

interface GalleryFolderCardProps {
  /** The virtual_folder or disk-backed folder item to display. */
  item: Item;
  /** Accent color inherited from the parent collection. */
  collectionColor: string;
  /** Called when the card is clicked (navigate into folder). */
  onClick: () => void;
  /** Called when the delete button is clicked. */
  onDelete: (e: React.MouseEvent) => void;
}

/**
 * Gallery-sized card for folder items (virtual_folder and disk-backed folder).
 * Matches the GalleryItemCard aspect ratio so the gallery grid stays uniform.
 * Disk-backed folders show an ⓘ button that opens the detail page.
 */
export default function GalleryFolderCard({ item, collectionColor, onClick, onDelete }: GalleryFolderCardProps) {
  const navigate = useNavigate();
  const collectionId = item.collection_id;

  return (
    <div className="gfc" onClick={onClick} role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") onClick(); }}
    >
      <div className="gfc-cover" style={{ background: `${collectionColor}1a` }}>
        <FolderOpen size={32} color={collectionColor} strokeWidth={1.5} />
        <div className="gfc-overlay">
          <ChevronRight size={20} color="#fff" />
        </div>
        <span className="gfc-badge" style={{ background: `${collectionColor}dd`, color: "#fff" }}>
          {item.strategy_type === "folder" ? "Folder" : "Virtual"}
        </span>
      </div>
      <div className="gfc-footer">
        <span className="gfc-name" title={item.name}>{item.name}</span>
        {item.strategy_type === "folder" && (
          <button
            className="gfc-info"
            onClick={(e) => { e.stopPropagation(); navigate(`/collections/${collectionId}/items/${item.id}`); }}
            title="View folder details"
          >
            <Layers size={11} />
          </button>
        )}
        <button
          className="gfc-delete"
          onClick={(e) => { e.stopPropagation(); onDelete(e); }}
          title="Delete folder"
        >
          <Trash2 size={11} />
        </button>
      </div>
      <style>{`
        .gfc {
          display: flex; flex-direction: column;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          overflow: hidden;
          background: var(--color-bg);
          cursor: pointer;
          transition: box-shadow var(--transition-fast), border-color var(--transition-fast), transform var(--transition-fast);
        }
        .gfc:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.10); border-color: var(--color-accent); transform: translateY(-1px); }
        .gfc-cover {
          position: relative;
          height: 140px;
          display: flex; align-items: center; justify-content: center;
          overflow: hidden; flex-shrink: 0;
        }
        .gfc-overlay {
          position: absolute; inset: 0;
          display: flex; align-items: center; justify-content: center;
          background: rgba(0,0,0,0.28);
          opacity: 0;
          transition: opacity var(--transition-fast);
        }
        .gfc:hover .gfc-overlay { opacity: 1; }
        .gfc-badge {
          position: absolute; top: 6px; right: 6px;
          padding: 2px 7px; border-radius: var(--radius-full);
          font-size: 10px; font-weight: 600;
          backdrop-filter: blur(4px);
        }
        .gfc-footer {
          padding: var(--space-2) var(--space-3);
          display: flex; align-items: center; gap: var(--space-2);
          border-top: 1px solid var(--color-border-subtle);
          background: var(--color-bg);
        }
        .gfc-name {
          flex: 1; min-width: 0;
          font-size: 12.5px; font-weight: 600;
          color: var(--color-text-primary);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .gfc-info {
          opacity: 0; flex-shrink: 0;
          width: 22px; height: 22px; border-radius: var(--radius-sm);
          display: flex; align-items: center; justify-content: center;
          color: var(--color-text-muted);
          transition: opacity var(--transition-fast), color var(--transition-fast), background var(--transition-fast);
        }
        .gfc:hover .gfc-info { opacity: 1; }
        .gfc-info:hover { color: var(--color-accent); background: var(--color-accent-light); }
        .gfc-delete {
          opacity: 0; flex-shrink: 0;
          width: 22px; height: 22px; border-radius: var(--radius-sm);
          display: flex; align-items: center; justify-content: center;
          color: var(--color-text-muted);
          transition: opacity var(--transition-fast), color var(--transition-fast), background var(--transition-fast);
        }
        .gfc:hover .gfc-delete { opacity: 1; }
        .gfc-delete:hover { color: var(--color-danger); background: color-mix(in srgb, var(--color-danger) 12%, transparent); }
      `}</style>
    </div>
  );
}
