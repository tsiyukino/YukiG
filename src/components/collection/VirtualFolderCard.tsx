import { FolderOpen, Layers, Trash2, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Item } from "@/types/item";
import styles from "./VirtualFolderCard.module.css";

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
    <div className={styles.vfc} onClick={onClick} role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") onClick(); }}
    >
      <div className={styles.icon} style={{ background: `${collectionColor}22` }}>
        <FolderOpen size={18} color={collectionColor} />
      </div>
      <div className={styles.info}>
        <span className={styles.name}>{item.name}</span>
        <span className={styles.sub}>
          {item.strategy_type === "folder" ? "Disk folder" : "Virtual folder"}
        </span>
      </div>
      <div className={styles.right}>
        {item.strategy_type === "folder" && (
          <button
            className={`${styles.iconBtn} ${styles.infoBtn}`}
            onClick={(e) => { e.stopPropagation(); navigate(`/collections/${collectionId}/items/${item.id}`); }}
            title="View folder details"
          >
            <Layers size={12} />
          </button>
        )}
        <button
          className={`${styles.iconBtn} ${styles.deleteBtn}`}
          onClick={(e) => { e.stopPropagation(); onDelete(e); }}
          title="Delete folder"
        >
          <Trash2 size={12} />
        </button>
        <ChevronRight size={14} className={styles.chevron} color="var(--color-text-muted)" />
      </div>
    </div>
  );
}
