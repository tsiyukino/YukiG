/**
 * Row component for displaying an item in the list view mode.
 *
 * Dense single-line layout optimised for fast name-based navigation.
 * Shows: small icon, name, type badge, tags, and action buttons in one row.
 * Items stack inside a bordered list container in CollectionPage.
 */
import { FolderOpen, Play, Trash2, CheckSquare, Square } from "lucide-react";
import { Item } from "@/types/item";
import { Tag } from "@/types/tag";
import TagChips from "@/components/common/TagChips";
import NowPlayingBadge from "@/components/common/NowPlayingBadge";
import { useGameLaunch } from "@/hooks/useGameLaunch";
import { useItemContextMenu } from "@/hooks/useItemContextMenu";
import { useItemIcon } from "@/hooks/useItemIcon";
import { itemTypeLabel } from "@/utils/strategyLabel";
import styles from "./ListItemRow.module.css";

interface ListItemRowProps {
  /** The item to display. */
  item: Item;
  /** Parent collection accent color for the icon background. */
  collectionColor: string;
  /** Tags assigned to this item. */
  tags: Tag[];
  /** Called when the row is clicked to navigate to item detail. */
  onClick: () => void;
  /** Called when the delete button is clicked. */
  onDelete: (e: React.MouseEvent) => void;
  /** Whether this row is currently selected for bulk actions. */
  selected?: boolean;
  /** Called when the selection checkbox is toggled. */
  onSelect?: (e: React.MouseEvent) => void;
}

/**
 * Single-row item entry for list view — optimised for scanning many names quickly.
 */
export default function ListItemRow({
  item,
  collectionColor,
  tags,
  onClick,
  onDelete,
  selected = false,
  onSelect,
}: ListItemRowProps) {
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
      className={selected ? `${styles.row} ${styles.selected}` : styles.row}
      onClick={selected || !onSelect ? onClick : undefined}
      onContextMenu={onContextMenu}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") onClick(); }}
    >
      {onSelect && (
        <button
          className={styles.selectBtn}
          onClick={(e) => { e.stopPropagation(); onSelect(e); }}
          title={selected ? "Deselect" : "Select"}
        >
          {selected
            ? <CheckSquare size={13} color="var(--color-accent)" />
            : <Square size={13} color="var(--color-text-muted)" />}
        </button>
      )}

      <div className={styles.icon} style={{ background: `${collectionColor}18` }}>
        {iconSrc ? (
          <img
            src={iconSrc}
            alt=""
            className={thumbnailSrc ? styles.thumb : styles.iconImg}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <FolderOpen size={13} color={collectionColor} />
        )}
      </div>

      <span className={styles.name}>
        <NowPlayingBadge itemId={item.id} variant="dot" />
        <span className={styles.nameText}>{item.name}</span>
      </span>

      <span
        className={styles.type}
        style={{ background: `${collectionColor}16`, color: collectionColor }}
      >
        {itemTypeLabel(item)}
      </span>

      <div className={styles.tags}>
        <TagChips tags={tags} max={3} />
      </div>

      <div className={styles.actions}>
        {isGame && (
          <button
            className={launching ? `${styles.launch} launch-pulsing` : styles.launch}
            onClick={launch}
            disabled={launching}
            title="Launch"
          >
            <Play size={11} />
          </button>
        )}
        <button
          className={styles.delete}
          onClick={(e) => { e.stopPropagation(); onDelete(e); }}
          title="Delete item"
        >
          <Trash2 size={11} />
        </button>
      </div>
    </div>
  );
}
