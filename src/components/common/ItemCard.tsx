/**
 * Card component for displaying a single item in a collection grid.
 *
 * Shows the item thumbnail (or a folder icon fallback), item name, strategy type
 * badge, assigned tags, and action buttons (launch for games, delete for all).
 */
import { FolderOpen, Play, Trash2, CheckSquare, Square } from "lucide-react";
import { Item } from "@/types/item";
import { Tag } from "@/types/tag";
import Card from "@/components/common/Card";
import TagChips from "@/components/common/TagChips";
import NowPlayingBadge from "@/components/common/NowPlayingBadge";
import { useGameLaunch } from "@/hooks/useGameLaunch";
import { useItemContextMenu } from "@/hooks/useItemContextMenu";
import { useItemIcon } from "@/hooks/useItemIcon";
import { itemTypeLabel } from "@/utils/strategyLabel";
import styles from "./ItemCard.module.css";

interface ItemCardProps {
  /** The item to display. */
  item: Item;
  /** The parent collection's accent color used for the icon background. */
  collectionColor: string;
  /** Tags currently assigned to this item. */
  tags: Tag[];
  /** Called when the card body is clicked to navigate to item detail. */
  onClick: () => void;
  /** Called when the delete button is clicked. */
  onDelete: (e: React.MouseEvent) => void;
  /** Whether this card is currently selected for bulk actions. */
  selected?: boolean;
  /** Called when the selection checkbox is toggled. */
  onSelect?: (e: React.MouseEvent) => void;
}

/**
 * Renders a single item card with icon, name, tags, and action buttons.
 */
export default function ItemCard({
  item,
  collectionColor,
  tags,
  onClick,
  onDelete,
  selected = false,
  onSelect,
}: ItemCardProps) {
  const { launching, launch } = useGameLaunch(item);
  const { thumbnailSrc, iconSrc } = useItemIcon(item);
  const isGame = item.strategy_type === "game";
  const onContextMenu = useItemContextMenu(item, {
    onLaunch: isGame ? launch : undefined,
    onOpenDetail: onClick,
    onDelete,
  });

  return (
    <Card onClick={selected || !onSelect ? onClick : undefined}>
      <div
        className={selected ? `${styles.icard} ${styles.selected}` : styles.icard}
        onContextMenu={onContextMenu}
      >
        {onSelect && (
          <button
            className={styles.selectBtn}
            onClick={(e) => { e.stopPropagation(); onSelect(e); }}
            title={selected ? "Deselect" : "Select"}
          >
            {selected
              ? <CheckSquare size={14} color="var(--color-accent)" />
              : <Square size={14} color="var(--color-text-muted)" />}
          </button>
        )}
        <div className={styles.icon} style={{ background: `${collectionColor}18` }}>
          {iconSrc ? (
            <img
              src={iconSrc}
              alt=""
              className={thumbnailSrc ? styles.thumbnail : styles.iconImg}
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
          ) : (
            <FolderOpen size={18} color={collectionColor} />
          )}
        </div>
        <div className={styles.info}>
          <span className={styles.name}>{item.name}</span>
          <span className={styles.strategy}>
            {itemTypeLabel(item)}
            <NowPlayingBadge itemId={item.id} />
          </span>
          <div className={styles.tagsRow}>
            <TagChips tags={tags} max={3} />
          </div>
        </div>
        <div className={styles.actions}>
          {isGame && (
            <button
              className={launching ? `${styles.launch} launch-pulsing` : styles.launch}
              onClick={launch}
              disabled={launching}
              title="Launch game"
            >
              <Play size={11} />
            </button>
          )}
          <button className={styles.delete} onClick={onDelete} title="Delete item">
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    </Card>
  );
}
