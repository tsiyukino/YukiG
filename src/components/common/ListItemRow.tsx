/**
 * Row component for displaying an item in the list view mode.
 *
 * Dense single-line layout optimised for fast name-based navigation.
 * Shows: small icon, name, type badge, tags, and action buttons in one row.
 * Items stack inside a bordered list container in CollectionPage.
 */
import { useState } from "react";
import { FolderOpen, Play, Trash2, CheckSquare, Square } from "lucide-react";
import { Item } from "@/types/item";
import { Tag } from "@/types/tag";
import { strategyExecuteLaunch } from "@/services/tauriCommands";
import { convertFileSrc } from "@tauri-apps/api/core";
import { useExeIcon } from "@/hooks/useExeIcon";
import { strategyLabel } from "@/utils/strategyLabel";

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
  const [launching, setLaunching] = useState(false);
  const isGame = item.strategy_type === "game";
  const exeIconSrc = useExeIcon(item.id, item.strategy_type);
  const thumbnailSrc = item.thumbnail_path ? convertFileSrc(item.thumbnail_path) : null;
  // For games: prefer manually-set thumbnail, then exe icon, then folder icon.
  const iconSrc = thumbnailSrc ?? exeIconSrc;

  async function handleLaunch(e: React.MouseEvent) {
    e.stopPropagation();
    setLaunching(true);
    try {
      await strategyExecuteLaunch(item.id, item.folder_path, "game");
    } catch {
      // Silently ignore — no toast system yet
    } finally {
      setLaunching(false);
    }
  }

  return (
    <div className={`lr${selected ? " lr--selected" : ""}`} onClick={selected || !onSelect ? onClick : undefined} role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") onClick(); }}
    >
      {/* Selection checkbox */}
      {onSelect && (
        <button
          className="lr-select"
          onClick={(e) => { e.stopPropagation(); onSelect(e); }}
          title={selected ? "Deselect" : "Select"}
        >
          {selected
            ? <CheckSquare size={13} color="var(--color-accent)" />
            : <Square size={13} color="var(--color-text-muted)" />}
        </button>
      )}
      {/* Thumbnail / icon */}
      <div className="lr-icon" style={{ background: `${collectionColor}18` }}>
        {iconSrc ? (
          <img
            src={iconSrc}
            alt=""
            className={thumbnailSrc ? "lr-thumb" : "lr-icon-img"}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <FolderOpen size={13} color={collectionColor} />
        )}
      </div>

      {/* Name */}
      <span className="lr-name">{item.name}</span>

      {/* Type badge */}
      <span
        className="lr-type"
        style={{ background: `${collectionColor}16`, color: collectionColor }}
      >
        {item.strategy_type === "file" && item.category
          ? item.category.charAt(0).toUpperCase() + item.category.slice(1)
          : strategyLabel(item.strategy_type)}
      </span>

      {/* Tags */}
      <div className="lr-tags">
        {tags.slice(0, 3).map((tag) => (
          <span
            key={tag.id}
            className="lr-tag"
            style={{ background: `${tag.color}22`, color: tag.color }}
          >
            {tag.name}
          </span>
        ))}
        {tags.length > 3 && (
          <span className="lr-tag lr-tag--more">+{tags.length - 3}</span>
        )}
      </div>

      {/* Actions */}
      <div className="lr-actions">
        {isGame && (
          <button
            className="lr-launch"
            onClick={handleLaunch}
            disabled={launching}
            title="Launch"
          >
            <Play size={11} />
          </button>
        )}
        <button
          className="lr-delete"
          onClick={(e) => { e.stopPropagation(); onDelete(e); }}
          title="Delete item"
        >
          <Trash2 size={11} />
        </button>
      </div>

      <style>{`
        .lr {
          display: flex; align-items: center; gap: var(--space-3);
          padding: var(--space-2) var(--space-3);
          border-bottom: 1px solid var(--color-border-subtle);
          background: var(--color-bg);
          cursor: pointer;
          transition: background var(--transition-fast);
        }
        .lr:last-child { border-bottom: none; }
        .lr:hover { background: var(--color-bg-secondary); }
        .lr-icon {
          width: 28px; height: 28px; border-radius: var(--radius-sm);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0; overflow: hidden;
        }
        .lr-thumb {
          width: 28px; height: 28px; object-fit: cover; display: block;
        }
        .lr-icon-img {
          width: 16px; height: 16px; object-fit: contain; display: block;
        }
        .lr-name {
          flex: 1; min-width: 0;
          font-size: 13px; font-weight: 500;
          color: var(--color-text-primary);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .lr-type {
          flex-shrink: 0;
          padding: 2px 8px; border-radius: var(--radius-full);
          font-size: 10.5px; font-weight: 600; text-transform: capitalize;
        }
        .lr-tags {
          display: flex; align-items: center; gap: 3px; flex-shrink: 0;
        }
        .lr-tag {
          display: inline-block; padding: 1px 6px;
          border-radius: var(--radius-full);
          font-size: 10px; font-weight: 500;
          white-space: nowrap;
        }
        .lr-tag--more { background: var(--color-bg-secondary); color: var(--color-text-muted); }
        .lr-actions {
          display: flex; align-items: center; gap: 2px; flex-shrink: 0;
          opacity: 0;
          transition: opacity var(--transition-fast);
        }
        .lr:hover .lr-actions { opacity: 1; }
        .lr-launch {
          width: 24px; height: 24px; border-radius: var(--radius-sm);
          background: var(--color-accent); color: white;
          display: flex; align-items: center; justify-content: center;
          transition: background var(--transition-fast);
        }
        .lr-launch:hover:not(:disabled) { background: var(--color-accent-hover); }
        .lr-launch:disabled { opacity: 0.5; cursor: not-allowed; }
        .lr-delete {
          width: 24px; height: 24px; border-radius: var(--radius-sm);
          color: var(--color-text-muted);
          display: flex; align-items: center; justify-content: center;
          transition: color var(--transition-fast), background var(--transition-fast);
        }
        .lr-delete:hover { color: var(--color-danger); background: var(--color-danger-light); }
        .lr--selected { background: color-mix(in srgb, var(--color-accent) 6%, var(--color-bg)); }
        .lr--selected:hover { background: color-mix(in srgb, var(--color-accent) 10%, var(--color-bg)); }
        .lr-select {
          flex-shrink: 0; width: 22px; height: 22px;
          display: flex; align-items: center; justify-content: center;
          border-radius: var(--radius-sm);
          opacity: 0;
          transition: opacity var(--transition-fast);
        }
        .lr:hover .lr-select { opacity: 1; }
        .lr--selected .lr-select { opacity: 1; }
      `}</style>
    </div>
  );
}
