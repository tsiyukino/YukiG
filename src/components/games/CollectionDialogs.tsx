/**
 * Shared create/delete dialogs for the Games page collection views.
 * CardView and CompactView both render these with their own local state.
 */
import { Collection, NewCollection } from "@/types/collection";
import CollectionModal from "@/pages/NewCollectionModal";
import ConfirmDialog from "@/components/common/ConfirmDialog";

interface CollectionDialogsProps {
  /** Whether the "new collection" modal is open. */
  showNew: boolean;
  /** The collection pending deletion, or null. */
  deleteTarget: Collection | null;
  /** Creates the collection and closes the modal. */
  onCreate: (input: NewCollection) => Promise<void>;
  /** Closes the "new collection" modal. */
  onCancelNew: () => void;
  /** Confirms deletion of `deleteTarget`. */
  onConfirmDelete: () => void;
  /** Cancels the pending deletion. */
  onCancelDelete: () => void;
}

/**
 * Renders the new-collection modal and the delete confirmation dialog.
 */
export default function CollectionDialogs({
  showNew,
  deleteTarget,
  onCreate,
  onCancelNew,
  onConfirmDelete,
  onCancelDelete,
}: CollectionDialogsProps) {
  return (
    <>
      {showNew && (
        <CollectionModal
          submitLabel="Create"
          onConfirm={onCreate}
          onCancel={onCancelNew}
        />
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete Collection"
        message={`Delete "${deleteTarget?.name}"? This will also delete all items inside it. This cannot be undone.`}
        confirmLabel="Delete Collection"
        onConfirm={onConfirmDelete}
        onCancel={onCancelDelete}
      />
    </>
  );
}
