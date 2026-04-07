/**
 * Gallery card for displaying an item in the gallery view mode.
 *
 * Thumbnail-dominant layout designed for visual browsing — game covers,
 * images, and document previews. The cover fills the top two-thirds of
 * the card; name and actions appear in a compact footer below.
 */
import { useState } from "react";
import { FolderOpen, Play, Trash2, CheckSquare } from "lucide-react";
import { Item } from "@/types/item";
import { Tag } from "@/types/tag";
import { strategyExecuteLaunch } from "@/services/tauriCommands";
import { convertFileSrc } from "@tauri-apps/api/core";
import { useExeIcon } from "@/hooks/useExeIcon";
import { strategyLabel } from "@/utils/strategyLabel";

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
  const [launching, setLaunching] = useState(false);
  const isGame = item.strategy_type === "game";
  const exeIconSrc = useExeIcon(item.id, item.strategy_type);
  const thumbnailSrc = item.thumbnail_path ? convertFileSrc(item.thumbnail_path) : null;
  // For games: prefer manually-set thumbnail, then exe icon, then placeholder.
  const coverSrc = thumbnailSrc ?? exeIconSrc;

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
    <div className={`gc${selected ? " gc--selected" : ""}`} onClick={selected || !onSelect ? onClick : undefined} role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") onClick(); }}
    >
      {/* Cover area */}
      <div className="gc-cover" style={{ background: `${collectionColor}1a` }}>
        {coverSrc ? (
          <img
            src={coverSrc}
            alt=""
            className={thumbnailSrc ? "gc-img" : "gc-icon-img"}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <FolderOpen size={28} color={collectionColor} strokeWidth={1.5} />
        )}

        {/* Overlay actions — appear on hover */}
        <div className="gc-overlay">
          {isGame && (
            <button
              className="gc-launch"
              onClick={handleLaunch}
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
            className="gc-select"
            onClick={(e) => { e.stopPropagation(); onSelect(e); }}
            title={selected ? "Deselect" : "Select"}
          >
            {selected
              ? <CheckSquare size={13} />
              : <span className="gc-select-circle" />}
          </button>
        )}

        {/* Strategy badge top-right */}
        <span
          className="gc-badge"
          style={{ background: `${collectionColor}dd`, color: "#fff" }}
        >
          {item.strategy_type === "file" && item.category
            ? item.category.charAt(0).toUpperCase() + item.category.slice(1)
            : strategyLabel(item.strategy_type)}
        </span>
      </div>

      {/* Footer */}
      <div className="gc-footer">
        <div className="gc-footer-main">
          <span className="gc-name" title={item.name}>{item.name}</span>
          <button
            className="gc-delete"
            onClick={(e) => { e.stopPropagation(); onDelete(e); }}
            title="Delete item"
          >
            <Trash2 size={11} />
          </button>
        </div>
        {tags.length > 0 && (
          <div className="gc-tags">
            {tags.slice(0, 2).map((tag) => (
              <span
                key={tag.id}
                className="gc-tag"
                style={{ background: `${tag.color}22`, color: tag.color }}
              >
                {tag.name}
              </span>
            ))}
            {tags.length > 2 && (
              <span className="gc-tag gc-tag--more">+{tags.length - 2}</span>
            )}
          </div>
        )}
      </div>

      <style>{`
        .gc {
          display: flex; flex-direction: column;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          overflow: hidden;
          background: var(--color-bg);
          cursor: pointer;
          transition: box-shadow var(--transition-fast), border-color var(--transition-fast), transform var(--transition-fast);
        }
        .gc:hover {
          box-shadow: 0 4px 16px rgba(0,0,0,0.10);
          border-color: var(--color-accent);
          transform: translateY(-1px);
        }
        .gc-cover {
          position: relative;
          height: 140px;
          display: flex; align-items: center; justify-content: center;
          overflow: hidden;
          flex-shrink: 0;
        }
        .gc-img {
          width: 100%; height: 100%;
          object-fit: cover;
          display: block;
        }
        .gc-icon-img {
          width: 28px; height: 28px;
          object-fit: contain;
          display: block;
        }
        .gc-overlay {
          position: absolute; inset: 0;
          display: flex; align-items: center; justify-content: center;
          background: rgba(0,0,0,0.32);
          opacity: 0;
          transition: opacity var(--transition-fast);
        }
        .gc:hover .gc-overlay { opacity: 1; }
        .gc-launch {
          width: 40px; height: 40px;
          border-radius: 50%;
          background: var(--color-bg);
          color: var(--color-accent);
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 2px 8px rgba(0,0,0,0.2);
          transition: transform var(--transition-fast), background var(--transition-fast);
        }
        .gc-launch:hover:not(:disabled) { transform: scale(1.1); background: var(--color-accent); color: white; }
        .gc-launch:disabled { opacity: 0.5; cursor: not-allowed; }
        .gc-badge {
          position: absolute; top: 6px; right: 6px;
          padding: 2px 7px;
          border-radius: var(--radius-full);
          font-size: 10px; font-weight: 600;
          text-transform: capitalize;
          letter-spacing: 0.02em;
          backdrop-filter: blur(4px);
        }
        .gc-footer {
          padding: var(--space-2) var(--space-3);
          display: flex; flex-direction: column; gap: 4px;
          border-top: 1px solid var(--color-border-subtle);
          background: var(--color-bg);
        }
        .gc-footer-main {
          display: flex; align-items: center; gap: var(--space-2);
        }
        .gc-name {
          flex: 1; min-width: 0;
          font-size: 12.5px; font-weight: 600;
          color: var(--color-text-primary);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .gc-delete {
          opacity: 0; flex-shrink: 0;
          width: 22px; height: 22px; border-radius: var(--radius-sm);
          display: flex; align-items: center; justify-content: center;
          color: var(--color-text-muted);
          transition: opacity var(--transition-fast), color var(--transition-fast), background var(--transition-fast);
        }
        .gc:hover .gc-delete { opacity: 1; }
        .gc-delete:hover { color: var(--color-danger); background: var(--color-danger-light); }
        .gc-tags {
          display: flex; flex-wrap: wrap; gap: 3px;
        }
        .gc-tag {
          display: inline-block; padding: 1px 6px;
          border-radius: var(--radius-full);
          font-size: 10px; font-weight: 500;
        }
        .gc-tag--more { background: var(--color-bg-secondary); color: var(--color-text-muted); }
        .gc--selected {
          border-color: var(--color-accent);
          box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-accent) 30%, transparent);
        }
        .gc-select {
          position: absolute; top: 6px; left: 6px;
          width: 24px; height: 24px;
          border-radius: 50%;
          background: rgba(0,0,0,0.45);
          color: white;
          display: flex; align-items: center; justify-content: center;
          opacity: 0;
          transition: opacity var(--transition-fast);
          z-index: 1;
        }
        .gc:hover .gc-select { opacity: 1; }
        .gc--selected .gc-select { opacity: 1; background: var(--color-accent); }
        .gc-select-circle {
          width: 10px; height: 10px; border-radius: 50%;
          border: 2px solid white;
          display: block;
        }
      `}</style>
    </div>
  );
}
