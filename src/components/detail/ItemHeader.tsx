/**
 * Detail page identity block: clickable thumbnail (opens a file picker
 * to set a new one), item name, and strategy badge.
 */
import { FolderOpen, Camera } from "lucide-react";
import { Item } from "@/types/item";
import { strategyLabel } from "@/utils/strategyLabel";
import styles from "./ItemHeader.module.css";

interface ItemHeaderProps {
  item: Item;
  /** Cached thumbnail URL, if set. */
  thumbnailSrc: string | null;
  /** Extracted exe icon URL fallback. */
  exeIconSrc: string | null;
  /** Opens the thumbnail file picker. */
  onPickThumbnail: () => void;
}

/**
 * Renders the item's thumbnail, name, and type badge.
 */
export default function ItemHeader({ item, thumbnailSrc, exeIconSrc, onPickThumbnail }: ItemHeaderProps) {
  const imgSrc = thumbnailSrc ?? exeIconSrc;

  return (
    <div className={styles.header}>
      <button className={styles.thumbBtn} onClick={onPickThumbnail} title="Click to set thumbnail">
        {imgSrc ? (
          <div className={thumbnailSrc ? styles.thumbnail : styles.icon}>
            <img
              src={imgSrc}
              alt={item.name}
              className={thumbnailSrc ? styles.thumbImg : styles.exeIconImg}
            />
            <div className={styles.overlay}>
              <Camera size={16} color="#fff" />
            </div>
          </div>
        ) : (
          <div className={styles.icon}>
            <FolderOpen size={28} color="var(--color-accent)" />
            <div className={styles.overlay}>
              <Camera size={14} color="#fff" />
            </div>
          </div>
        )}
      </button>
      <div>
        <h1 className={styles.name}>{item.name}</h1>
        <span className={styles.badge}>{strategyLabel(item.strategy_type)}</span>
      </div>
    </div>
  );
}
