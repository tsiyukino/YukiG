import { FolderOpen, Layers, Trash2, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Item } from "@/types/item";
import styles from "./GalleryFolderCard.module.css";

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
    <div className={styles.gfc} onClick={onClick} role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") onClick(); }}
    >
      <div className={styles.cover} style={{ background: `${collectionColor}1a` }}>
        <FolderOpen size={32} color={collectionColor} strokeWidth={1.5} />
        <div className={styles.overlay}>
          <ChevronRight size={20} color="#fff" />
        </div>
        <span className={styles.badge} style={{ background: `${collectionColor}dd`, color: "#fff" }}>
          {item.strategy_type === "folder" ? "Folder" : "Virtual"}
        </span>
      </div>
      <div className={styles.footer}>
        <span className={styles.name} title={item.name}>{item.name}</span>
        {item.strategy_type === "folder" && (
          <button
            className={`${styles.iconBtn} ${styles.infoBtn}`}
            onClick={(e) => { e.stopPropagation(); navigate(`/collections/${collectionId}/items/${item.id}`); }}
            title="View folder details"
          >
            <Layers size={11} />
          </button>
        )}
        <button
          className={`${styles.iconBtn} ${styles.deleteBtn}`}
          onClick={(e) => { e.stopPropagation(); onDelete(e); }}
          title="Delete folder"
        >
          <Trash2 size={11} />
        </button>
      </div>
    </div>
  );
}
