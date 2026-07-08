import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FolderOpen, X } from "lucide-react";
import { Tag } from "@/types/tag";
import { Item } from "@/types/item";
import { tagGetItems } from "@/services/tauriCommands";
import { strategyLabel } from "@/utils/strategyLabel";
import { itemRoute } from "@/utils/itemNavigation";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import styles from "./TagChip.module.css";

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
      <div className={styles.wrap}>
        <button
          className={styles.chip}
          style={{ background: `${tag.color}1a`, color: tag.color, borderColor: `${tag.color}40` }}
          onClick={onClick}
          title={`View items tagged "${tag.name}"`}
        >
          {tag.name}
        </button>
        <button className={styles.itemsBtn} onClick={handleShowItems} title="Show items with this tag" style={{ color: tag.color }}>
          <FolderOpen size={10} />
        </button>
        <button className={styles.del} onClick={() => setConfirmDelete(true)} title="Delete tag">
          <X size={10} />
        </button>
      </div>

      {showItems && items.length > 0 && (
        <div className={styles.popover}>
          <div className={styles.popoverHeader} style={{ color: tag.color }}>Items tagged "{tag.name}"</div>
          {items.map((item) => (
            <button key={item.id} className={styles.itemRow} onClick={() => { const { to, options } = itemRoute(item); navigate(to, options); }}>
              {item.name}
              <span className={styles.itemType}>{strategyLabel(item.strategy_type)}</span>
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
    </>
  );
}
