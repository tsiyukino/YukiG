/**
 * Gallery card for displaying an item in the gallery view mode.
 *
 * Thumbnail-dominant layout designed for visual browsing — game covers,
 * images, and document previews. The cover fills the top two-thirds of
 * the card; name and actions appear in a compact footer below.
 */
import { FolderOpen, Play, Trash2, CheckSquare } from "lucide-react";
import { Item } from "@/types/item";
import { Tag } from "@/types/tag";
import TagChips from "@/components/common/TagChips";
import NowPlayingBadge from "@/components/common/NowPlayingBadge";
import { useGameLaunch } from "@/hooks/useGameLaunch";
import { useItemContextMenu } from "@/hooks/useItemContextMenu";
import { useItemIcon } from "@/hooks/useItemIcon";
import { itemTypeLabel } from "@/utils/strategyLabel";
import styles from "./GalleryItemCard.module.css";

interface GalleryItemCardProps {
  /** The item to display. */
  item: Item;
  /** Parent collection accent color used for the placeholder background. */
  collectionColor: string;
  /** Tags assigned to this item. */
  tags: Tag[];
  /** Called when the card is clicked to navigate to item detail. */
  onClick: () => void;
  /** Called when the delete button is clicked. */
  onDelete: (e: React.MouseEvent) => void;
  /** Whether this card is currently selected for bulk actions. */
  selected?: boolean;
  /** Called when the selection checkbox is toggled. */
  onSelect?: (e: React.MouseEvent) => void;
}

/**
 * Large thumbnail-first card for gallery / preview browsing.
 * Optimised for collections with cover art: games, images, documents.
 */
export default function GalleryItemCard({
  item,
  collectionColor,
  tags,
  onClick,
  onDelete,
  selected = false,
  onSelect,
}: GalleryItemCardProps) {
  const { launching, launch } = useGameLaunch(item);
  const { thumbnailSrc, iconSrc } = useItemIcon(item);
  const isGame = item.strategy_type === "game";
  const onContextMenu = useItemContextMenu(item, {
    onLaunch: isGame ? launch : undefined,
    onOpenDetail: onClick,
    onDelete,
  });

  return (
    <div
      className={selected ? `${styles.gc} ${styles.selected}` : styles.gc}
      onClick={selected || !onSelect ? onClick : undefined}
      onContextMenu={onContextMenu}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") onClick(); }}
    >
      <div className={styles.cover} style={{ background: `${collectionColor}1a` }}>
        {iconSrc ? (
          <img
            src={iconSrc}
            alt=""
            className={thumbnailSrc ? styles.img : styles.iconImg}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <FolderOpen size={28} color={collectionColor} strokeWidth={1.5} />
        )}

        {/* Overlay actions — appear on hover */}
        <div className={styles.overlay}>
          {isGame && (
            <button
              className={launching ? `${styles.launch} launch-pulsing` : styles.launch}
              onClick={launch}
              disabled={launching}
              title="Launch"
            >
              <Play size={14} />
            </button>
          )}
        </div>

        {/* Selection checkbox — top-left corner */}
        {onSelect && (
          <button
            className={styles.selectBtn}
            onClick={(e) => { e.stopPropagation(); onSelect(e); }}
            title={selected ? "Deselect" : "Select"}
          >
            {selected ? <CheckSquare size={13} /> : <span className={styles.selectCircle} />}
          </button>
        )}

        {/* Strategy badge top-right */}
        <span
          className={styles.badge}
          style={{ background: `${collectionColor}dd`, color: "#fff" }}
        >
          {itemTypeLabel(item)}
        </span>

        {/* Now-playing badge bottom-left (over cover art) */}
        <span className={styles.playingBadge}>
          <NowPlayingBadge itemId={item.id} variant="over-image" />
        </span>
      </div>

      <div className={styles.footer}>
        <div className={styles.footerMain}>
          <span className={styles.name} title={item.name}>{item.name}</span>
          <button
            className={styles.delete}
            onClick={(e) => { e.stopPropagation(); onDelete(e); }}
            title="Delete item"
          >
            <Trash2 size={11} />
          </button>
        </div>
        <TagChips tags={tags} max={2} />
      </div>
    </div>
  );
}
