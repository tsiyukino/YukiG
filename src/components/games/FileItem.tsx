import { useNavigate } from "react-router-dom";
import { FolderOpen } from "lucide-react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { Item } from "@/types/item";
import { Collection } from "@/types/collection";
import { strategyLabel } from "@/utils/strategyLabel";
import styles from "./FileItem.module.css";

interface FileItemProps {
  /** The item to display. */
  item: Item;
  /** Parent collection (provides color and id for navigation). */
  collection: Collection;
}

/**
 * A single item row inside a CollectionSection in the List view of GamesPage.
 * Shows a thumbnail or icon, item name, and strategy type label.
 */
export default function FileItem({ item, collection }: FileItemProps) {
  const navigate = useNavigate();
  const thumbSrc = item.thumbnail_path ? convertFileSrc(item.thumbnail_path) : null;

  return (
    <button
      className={styles.fi}
      onClick={() => navigate(`/collections/${collection.id}/items/${item.id}`)}
    >
      <div className={styles.icon} style={{ background: `${collection.color}18` }}>
        {thumbSrc ? (
          <img src={thumbSrc} alt="" className={styles.thumb} />
        ) : (
          <FolderOpen size={13} color={collection.color} />
        )}
      </div>
      <span className={styles.name}>{item.name}</span>
      <span className={styles.type}>{strategyLabel(item.strategy_type)}</span>
    </button>
  );
}
