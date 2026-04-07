/**
 * Card component for displaying a single item in a collection grid.
 *
 * Shows the item thumbnail (or a folder icon fallback), item name, strategy type
 * badge, assigned tags, and action buttons (launch for games, delete for all).
 */
import { useState } from "react";
import { FolderOpen, Play, Trash2, CheckSquare, Square } from "lucide-react";
import { Item } from "@/types/item";
import { Tag } from "@/types/tag";
import { strategyExecuteLaunch } from "@/services/tauriCommands";
import Card from "@/components/common/Card";
import { convertFileSrc } from "@tauri-apps/api/core";
import { useExeIcon } from "@/hooks/useExeIcon";
import { strategyLabel } from "@/utils/strategyLabel";

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
  const [launching, setLaunching] = useState(false);
  const isGame = item.strategy_type === "game";
  const exeIconSrc = useExeIcon(item.id, item.strategy_type);

  async function handleLaunch(e: React.MouseEvent) {
    e.stopPropagation();
    setLaunching(true);
    try {
      await strategyExecuteLaunch(item.id, item.folder_path, "game");
    } catch {
      // Silently ignore — nothing to show without a toast system
    } finally {
      setLaunching(false);
    }
  }

  const thumbnailSrc = item.thumbnail_path
    ? convertFileSrc(item.thumbnail_path)
    : null;
  // For games: prefer manually-set thumbnail, then exe icon, then folder icon fallback.
  const iconSrc = thumbnailSrc ?? exeIconSrc;

  return (
    <Card onClick={selected || !onSelect ? onClick : undefined}>
      <div className={`icard${selected ? " icard--selected" : ""}`}>
        {onSelect && (
          <button
            className="icard-select"
            onClick={(e) => { e.stopPropagation(); onSelect(e); }}
            title={selected ? "Deselect" : "Select"}
          >
            {selected
              ? <CheckSquare size={14} color="var(--color-accent)" />
              : <Square size={14} color="var(--color-text-muted)" />}
          </button>
        )}
        <div className="icard-icon" style={{ background: `${collectionColor}18` }}>
          {iconSrc ? (
            <img
              src={iconSrc}
              alt=""
              className={thumbnailSrc ? "icard-thumbnail" : "icard-icon-img"}
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
          ) : (
            <FolderOpen size={18} color={collectionColor} />
          )}
        </div>
        <div className="icard-info">
          <span className="icard-name">{item.name}</span>
          <span className="icard-strategy">
            {item.strategy_type === "file" && item.category
              ? item.category.charAt(0).toUpperCase() + item.category.slice(1)
              : strategyLabel(item.strategy_type)}
          </span>
          <div className="icard-tags">
            {tags.slice(0, 3).map((tag) => (
              <span
                key={tag.id}
                className="icard-tag"
                style={{ background: `${tag.color}22`, color: tag.color }}
              >
                {tag.name}
              </span>
            ))}
            {tags.length > 3 && (
              <span className="icard-tag icard-tag--more">+{tags.length - 3}</span>
            )}
          </div>
        </div>
        <div className="icard-actions">
          {isGame && (
            <button
              className="icard-launch"
              onClick={handleLaunch}
              disabled={launching}
              title="Launch game"
            >
              <Play size={11} />
            </button>
          )}
          <button className="icard-delete" onClick={onDelete} title="Delete item">
            <Trash2 size={12} />
          </button>
        </div>
      </div>
      <style>{`
        .icard {
          padding: var(--space-3);
          display: flex;
          align-items: flex-start;
          gap: var(--space-3);
        }
        .icard-icon {
          flex-shrink: 0;
          width: 34px;
          height: 34px;
          border-radius: var(--radius-sm);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-top: 2px;
          overflow: hidden;
        }
        .icard-thumbnail {
          width: 34px;
          height: 34px;
          object-fit: cover;
          display: block;
        }
        .icard-icon-img {
          width: 18px;
          height: 18px;
          object-fit: contain;
          display: block;
        }
        .icard-info {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .icard-name {
          font-size: 13px;
          font-weight: 500;
          color: var(--color-text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .icard-strategy {
          font-size: 11px;
          color: var(--color-text-muted);
          text-transform: capitalize;
        }
        .icard-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 3px;
          margin-top: 4px;
          min-height: 20px;
        }
        .icard-tag {
          display: inline-block;
          padding: 1px 6px;
          border-radius: var(--radius-full);
          font-size: 10.5px;
          font-weight: 500;
        }
        .icard-tag--more {
          background: var(--color-bg-secondary);
          color: var(--color-text-muted);
        }
        .icard-actions {
          display: flex;
          align-items: center;
          gap: 2px;
          flex-shrink: 0;
          opacity: 0;
          transition: opacity var(--transition-fast);
          padding-top: 2px;
        }
        .icard:hover .icard-actions { opacity: 1; }
        .icard-launch {
          width: 26px;
          height: 26px;
          border-radius: var(--radius-sm);
          background: var(--color-accent);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background var(--transition-fast);
        }
        .icard-launch:hover:not(:disabled) { background: var(--color-accent-hover); }
        .icard-launch:disabled { opacity: 0.5; cursor: not-allowed; }
        .icard-delete {
          width: 26px;
          height: 26px;
          border-radius: var(--radius-sm);
          color: var(--color-text-muted);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: color var(--transition-fast), background var(--transition-fast);
        }
        .icard-delete:hover { color: var(--color-danger); background: var(--color-danger-light); }
        .icard--selected {
          background: color-mix(in srgb, var(--color-accent) 8%, var(--color-bg));
        }
        .icard-select {
          flex-shrink: 0;
          width: 22px; height: 22px;
          display: flex; align-items: center; justify-content: center;
          border-radius: var(--radius-sm);
          opacity: 0;
          transition: opacity var(--transition-fast);
          align-self: center;
        }
        .icard:hover .icard-select { opacity: 1; }
        .icard--selected .icard-select { opacity: 1; }
      `}</style>
    </Card>
  );
}
