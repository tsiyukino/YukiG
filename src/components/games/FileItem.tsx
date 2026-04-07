import { useNavigate } from "react-router-dom";
import { FolderOpen } from "lucide-react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { Item } from "@/types/item";
import { Collection } from "@/types/collection";
import { strategyLabel } from "@/utils/strategyLabel";

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
      className="fi"
      onClick={() => navigate(`/collections/${collection.id}/items/${item.id}`)}
    >
      <div className="fi-icon" style={{ background: `${collection.color}18` }}>
        {thumbSrc ? (
          <img src={thumbSrc} alt="" className="fi-thumb" />
        ) : (
          <FolderOpen size={13} color={collection.color} />
        )}
      </div>
      <span className="fi-name">{item.name}</span>
      <span className="fi-type">{strategyLabel(item.strategy_type)}</span>
      <style>{`
        .fi { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-2) var(--space-4) var(--space-2) var(--space-6); width: 100%; text-align: left; border-bottom: 1px solid var(--color-border-subtle); transition: background var(--transition-fast); cursor: pointer; }
        .fi:last-child { border-bottom: none; }
        .fi:hover { background: var(--color-bg-secondary); }
        .fi-icon { width: 24px; height: 24px; border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; flex-shrink: 0; overflow: hidden; }
        .fi-thumb { width: 24px; height: 24px; object-fit: cover; display: block; }
        .fi-name { flex: 1; font-size: 13px; color: var(--color-text-primary); min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .fi-type { font-size: 11px; color: var(--color-text-muted); text-transform: capitalize; flex-shrink: 0; }
      `}</style>
    </button>
  );
}
