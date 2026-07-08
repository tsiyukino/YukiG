import { FolderOpen, Trash2 } from "lucide-react";
import { Collection } from "@/types/collection";
import styles from "./CompactCard.module.css";

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
    <div
      className={styles.ccrd}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") onClick(); }}
    >
      <div className={styles.top} style={{ background: `${collection.color}16` }}>
        <div className={styles.icon} style={{ background: `${collection.color}30`, color: collection.color }}>
          {initials || <FolderOpen size={13} color={collection.color} />}
        </div>
        <button className={styles.del} onClick={onDelete} title="Delete">
          <Trash2 size={11} />
        </button>
      </div>
      <div className={styles.label}>{collection.name}</div>
    </div>
  );
}
