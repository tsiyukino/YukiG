/**
 * Item detail view — shows metadata and strategy-specific info for a single item.
 *
 * Data and mutations live in useItemDetail; this component renders the
 * sections and delegates to the strategy view based on item.strategy_type.
 */
import { useParams, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useItemDetail } from "@/hooks/useItemDetail";
import { useExeIcon } from "@/hooks/useExeIcon";
import { useTags } from "@/hooks/useTags";
import { useItemTags } from "@/hooks/useItemTags";
import { Item } from "@/types/item";
import { ItemDetailSkeleton } from "@/components/common/Skeleton";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import TagPicker from "@/components/common/TagPicker";
import GameItemView from "@/components/strategies/GameItemView";
import SteamGameItemView from "@/components/strategies/SteamGameItemView";
import DetailTopbar from "@/components/detail/DetailTopbar";
import ItemHeader from "@/components/detail/ItemHeader";
import MetaSection, { MetaEntry } from "@/components/detail/MetaSection";
import GameStatusSection from "@/components/detail/GameStatusSection";
import EditItemModal from "@/pages/EditItemModal";
import { formatDate } from "@/utils/formatDate";
import styles from "./ItemDetailPage.module.css";

/**
 * Dispatches to the correct strategy view component based on strategy_type.
 *
 * @param item - The loaded item record
 */
function StrategyView({ item }: { item: Item }) {
  if (item.strategy_type === "game")
    return <GameItemView itemId={item.id} folderPath={item.folder_path} />;
  if (item.strategy_type === "steam_game")
    return <SteamGameItemView itemId={item.id} folderPath={item.folder_path} />;
  return null;
}

/** Displays full details for a single item including strategy-specific info. */
export default function ItemDetailPage() {
  const { id, itemId } = useParams<{ id?: string; itemId: string }>();
  const navigate = useNavigate();
  // After delete: return to the group the item was opened from, or back in
  // history when opened via the standalone /items/:itemId route (no group).
  const detail = useItemDetail(itemId!, () => (id ? navigate(`/collections/${id}`) : navigate(-1)));
  const { item } = detail;

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const exeIconSrc = useExeIcon(itemId!, item?.strategy_type ?? "");
  const { tags: allTags, createTag } = useTags();
  const itemTagsHook = useItemTags(itemId!);

  if (detail.loading) {
    return <div className={styles.loadingPad}><ItemDetailSkeleton /></div>;
  }
  if (detail.error || !item) {
    return (
      <div className={styles.errorState}>
        <span className={styles.errorMsg}>{detail.error ?? "Item not found"}</span>
        <button className={styles.retry} onClick={detail.retry}>Retry</button>
      </div>
    );
  }

  const metaEntries: MetaEntry[] = [
    { label: "Folder Path", value: item.folder_path, mono: true },
    ...(item.description ? [{ label: "Description", value: item.description }] : []),
    { label: "Added", value: formatDate(item.created_at) },
    { label: "Updated", value: formatDate(item.updated_at) },
  ];

  return (
    <div className={styles.page}>
      <DetailTopbar
        isFavorite={item.is_favorite}
        onBack={() => navigate(-1)}
        onToggleFavorite={detail.toggleFavorite}
        onOpenFolder={detail.openFolder}
        onEdit={() => setShowEdit(true)}
        onDelete={() => setShowDeleteConfirm(true)}
      />

      {detail.actionError && <div className={styles.openError}>{detail.actionError}</div>}

      <ItemHeader
        item={item}
        thumbnailSrc={detail.thumbnailSrc}
        exeIconSrc={exeIconSrc}
        onPickThumbnail={detail.pickThumbnail}
      />

      <MetaSection entries={metaEntries} />

      <div className={styles.section}>
        <div className={styles.sectionHeader}><span>Tags</span></div>
        <TagPicker
          itemTags={itemTagsHook.tags}
          allTags={allTags}
          onAssign={itemTagsHook.assign}
          onRemove={itemTagsHook.remove}
          onCreateAndAssign={async (name, color) => {
            const tag = await createTag(name, color);
            await itemTagsHook.assign(tag.id);
          }}
        />
      </div>

      {detail.gameStatus && <GameStatusSection gameStatus={detail.gameStatus} />}

      <div className={styles.section}>
        <div className={styles.sectionHeader}><span>Details</span></div>
        <StrategyView item={item} />
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span>Notes</span>
          {detail.notesSaving && <span className={styles.saving}>Saving…</span>}
        </div>
        <textarea
          className={styles.notesTextarea}
          value={detail.notes}
          placeholder="Add notes…"
          onChange={(e) => detail.setNotes(e.target.value)}
          onBlur={(e) => detail.saveNotes(e.target.value)}
          rows={4}
        />
      </div>

      {showEdit && (
        <EditItemModal
          item={item}
          onSave={(updated) => { detail.setItem(updated); setShowEdit(false); }}
          onClose={() => setShowEdit(false)}
        />
      )}

      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete Item"
        message={`Delete "${item.name}"? This cannot be undone.`}
        confirmLabel={detail.deleting ? "Deleting…" : "Delete Item"}
        onConfirm={detail.deleteItem}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
}
