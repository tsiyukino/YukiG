import { FolderOpen, Trash2 } from "lucide-react";
import { Collection } from "@/types/collection";
import Card from "@/components/common/Card";
import { useContextMenu } from "@/components/common/ContextMenuProvider";
import styles from "./CollectionCard.module.css";

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
  const { open } = useContextMenu();

  const initials = collection.name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <Card onClick={onClick}>
      <div
        className={styles.ccard}
        onContextMenu={(e) =>
          open(e, [
            { id: "open", label: "Open", icon: FolderOpen, onSelect: onClick },
            "separator",
            { id: "delete", label: "Delete", icon: Trash2, danger: true, onSelect: () => onDelete(e) },
          ])
        }
      >
        <div className={styles.accent} style={{ background: collection.color }} />
        <div className={styles.body}>
          <div
            className={styles.icon}
            style={{ background: `${collection.color}20`, color: collection.color }}
          >
            {initials || <FolderOpen size={16} color={collection.color} />}
          </div>
          <div className={styles.info}>
            <h2 className={styles.name}>{collection.name}</h2>
            {collection.description && (
              <p className={styles.desc}>{collection.description}</p>
            )}
          </div>
          <span
            className={styles.strategy}
            style={{ background: `${collection.color}14`, color: collection.color }}
          >
            {collection.default_strategy}
          </span>
        </div>
        <div className={styles.footer}>
          <span className={styles.footerLabel}>View collection</span>
          <button className={styles.delete} onClick={onDelete} title="Delete collection">
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    </Card>
  );
}
