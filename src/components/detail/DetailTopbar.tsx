/**
 * Top action row of the item detail page:
 * back, favorite toggle, open folder, edit, delete.
 */
import { ArrowLeft, Star, ExternalLink, Pencil, Trash2 } from "lucide-react";
import styles from "./DetailTopbar.module.css";

interface DetailTopbarProps {
  isFavorite: boolean;
  onBack: () => void;
  onToggleFavorite: () => void;
  onOpenFolder: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

/**
 * Renders the detail page's toolbar.
 */
export default function DetailTopbar({
  isFavorite,
  onBack,
  onToggleFavorite,
  onOpenFolder,
  onEdit,
  onDelete,
}: DetailTopbarProps) {
  return (
    <div className={styles.topbar}>
      <button className={styles.back} onClick={onBack}>
        <ArrowLeft size={16} />
        <span>Back</span>
      </button>
      <div className={styles.actions}>
        <button
          className={[styles.btn, styles.favorite, isFavorite ? styles.favoriteActive : ""].filter(Boolean).join(" ")}
          onClick={onToggleFavorite}
          title={isFavorite ? "Remove from Favorites" : "Add to Favorites"}
        >
          <Star size={13} />
          {isFavorite ? "Unfavorite" : "Favorite"}
        </button>
        <button className={`${styles.btn} ${styles.action}`} onClick={onOpenFolder} title="Open folder in Explorer">
          <ExternalLink size={13} />
          Open Folder
        </button>
        <button className={`${styles.btn} ${styles.edit}`} onClick={onEdit} title="Edit item">
          <Pencil size={13} />
          Edit
        </button>
        <button className={`${styles.btn} ${styles.delete}`} onClick={onDelete} title="Delete item">
          <Trash2 size={14} />
          Delete
        </button>
      </div>
    </div>
  );
}
