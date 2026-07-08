/**
 * Modal cluster for the collection view: delete confirmation (message varies
 * by item type), the add-item flow, and the edit-collection modal.
 */
import { Collection, NewCollection } from "@/types/collection";
import { Item } from "@/types/item";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import AddItemModal from "@/pages/AddItemModal";
import CollectionModal from "@/pages/NewCollectionModal";

function deleteMessage(target: Item | null): string {
  if (target?.strategy_type === "folder") {
    return `Delete "${target.name}"? All contents will be permanently deleted.`;
  }
  if (target?.strategy_type === "virtual_folder") {
    return `Delete "${target.name}"? Items inside will be moved to the parent level.`;
  }
  return `Delete "${target?.name}"? This cannot be undone.`;
}

interface CollectionModalsProps {
  collection: Collection;
  /** Item pending delete confirmation, or null. */
  deleteTarget: Item | null;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  showAdd: boolean;
  /** Parent for newly added items (current folder id, or null at root). */
  addParentId: string | null;
  onAddSuccess: (newItemId: string, strategyType: string) => void;
  onCloseAdd: () => void;
  showEdit: boolean;
  onEditConfirm: (input: NewCollection) => Promise<void>;
  onCloseEdit: () => void;
}

/**
 * Renders the collection page's three modals.
 */
export default function CollectionModals({
  collection,
  deleteTarget,
  onConfirmDelete,
  onCancelDelete,
  showAdd,
  addParentId,
  onAddSuccess,
  onCloseAdd,
  showEdit,
  onEditConfirm,
  onCloseEdit,
}: CollectionModalsProps) {
  return (
    <>
      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete Item"
        message={deleteMessage(deleteTarget)}
        confirmLabel="Delete Item"
        onConfirm={onConfirmDelete}
        onCancel={onCancelDelete}
      />

      {showAdd && (
        <AddItemModal
          collectionId={collection.id}
          defaultStrategy={collection.default_strategy}
          parentId={addParentId}
          onSuccess={onAddSuccess}
          onClose={onCloseAdd}
        />
      )}

      {showEdit && (
        <CollectionModal
          initial={{
            name: collection.name,
            description: collection.description,
            color: collection.color,
            default_strategy: collection.default_strategy,
          }}
          submitLabel="Save Changes"
          onConfirm={onEditConfirm}
          onCancel={onCloseEdit}
        />
      )}
    </>
  );
}
