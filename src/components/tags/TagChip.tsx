import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FolderOpen, X } from "lucide-react";
import { Tag } from "@/types/tag";
import { Item } from "@/types/item";
import { tagGetItems } from "@/services/tauriCommands";
import { strategyLabel } from "@/utils/strategyLabel";
import ConfirmDialog from "@/components/common/ConfirmDialog";

interface TagChipProps {
  /** The tag to display. */
  tag: Tag;
  /** Called when the tag is confirmed for deletion. */
  onDelete: () => void;
  /** Called when the tag name is clicked (navigate to tagged items search). */
  onClick: () => void;
}

/**
 * A pill-shaped tag chip with a click area for navigation, an expand button to show
 * tagged items, and a delete button with a confirmation dialog.
 */
export default function TagChip({ tag, onDelete, onClick }: TagChipProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showItems, setShowItems] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const navigate = useNavigate();

  async function handleShowItems() {
    if (!showItems) {
      const data = await tagGetItems(tag.id);
      setItems(data);
    }
    setShowItems((v) => !v);
  }

  return (
    <>
      <div className="tc-wrap">
        <button
          className="tc"
          style={{ background: `${tag.color}1a`, color: tag.color, borderColor: `${tag.color}40` }}
          onClick={onClick}
          title={`View items tagged "${tag.name}"`}
        >
          {tag.name}
        </button>
        <button className="tc-items-btn" onClick={handleShowItems} title="Show items with this tag" style={{ color: tag.color }}>
          <FolderOpen size={10} />
        </button>
        <button className="tc-del" onClick={() => setConfirmDelete(true)} title="Delete tag">
          <X size={10} />
        </button>
      </div>

      {showItems && items.length > 0 && (
        <div className="tc-items-popover">
          <div className="tc-items-header" style={{ color: tag.color }}>Items tagged "{tag.name}"</div>
          {items.map((item) => (
            <button key={item.id} className="tc-item-row" onClick={() => navigate(`/collections/${item.collection_id}/items/${item.id}`)}>
              {item.name}
              <span className="tc-item-type">{strategyLabel(item.strategy_type)}</span>
            </button>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="Delete Tag"
        message={`Delete the tag "${tag.name}"? It will be removed from all items. This cannot be undone.`}
        confirmLabel="Delete Tag"
        onConfirm={async () => { await onDelete(); setConfirmDelete(false); }}
        onCancel={() => setConfirmDelete(false)}
      />

      <style>{`
        .tc-wrap { display: inline-flex; align-items: center; border-radius: var(--radius-full); overflow: hidden; border: 1px solid transparent; }
        .tc { padding: 4px 10px; font-size: 12.5px; font-weight: 500; border-radius: var(--radius-full) 0 0 var(--radius-full); transition: opacity var(--transition-fast); cursor: pointer; }
        .tc:hover { opacity: 0.8; }
        .tc-items-btn { display: flex; align-items: center; justify-content: center; width: 22px; height: 100%; opacity: 0.5; transition: opacity var(--transition-fast); cursor: pointer; }
        .tc-items-btn:hover { opacity: 1; }
        .tc-del { display: flex; align-items: center; justify-content: center; width: 22px; height: 100%; color: #94a3b8; border-radius: 0 var(--radius-full) var(--radius-full) 0; opacity: 0; transition: opacity var(--transition-fast), color var(--transition-fast), background var(--transition-fast); }
        .tc-wrap:hover .tc-del { opacity: 1; }
        .tc-del:hover { color: var(--color-danger); background: var(--color-danger-light)55; }
        .tc-items-popover { width: 100%; background: var(--color-bg); border: 1px solid var(--color-border); border-radius: var(--radius-md); overflow: hidden; margin-top: -4px; box-shadow: var(--shadow-sm); }
        .tc-items-header { padding: var(--space-2) var(--space-3); font-size: 11px; font-weight: 600; background: var(--color-bg-secondary); border-bottom: 1px solid var(--color-border); }
        .tc-item-row { display: flex; align-items: center; justify-content: space-between; width: 100%; padding: var(--space-2) var(--space-3); font-size: 12.5px; color: var(--color-text-primary); text-align: left; border-bottom: 1px solid var(--color-border-subtle); transition: background var(--transition-fast); }
        .tc-item-row:last-child { border-bottom: none; }
        .tc-item-row:hover { background: var(--color-bg-secondary); }
        .tc-item-type { font-size: 11px; color: var(--color-text-muted); text-transform: capitalize; }
      `}</style>
    </>
  );
}
