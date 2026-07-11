/**
 * Compact view for the Games page — small, dense collection cards.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { Collection, NewCollection } from "@/types/collection";
import { useCollections } from "@/hooks/useCollections";
import { isPlatformCollection } from "@/utils/collectionSource";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import CompactCard from "@/components/games/CompactCard";
import CollectionDialogs from "@/components/games/CollectionDialogs";
import styles from "./CompactView.module.css";

interface CompactViewProps {
  /** Files a dragged unfiled game into a collection. */
  onFileGame?: (itemId: string, collectionId: string) => void;
}

/**
 * Dense collection grid with create/delete actions.
 * The Steam system group is always hidden (browsed on the Steam page).
 * Cards accept dropped games (from the unfiled panel) to file them.
 */
export default function CompactView({ onFileGame }: CompactViewProps) {
  const navigate = useNavigate();
  const { collections, loading, error, createCollection, deleteCollection } = useCollections();
  const [showNewModal, setShowNewModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Collection | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  async function handleCreate(input: NewCollection) {
    await createCollection(input);
    setShowNewModal(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await deleteCollection(deleteTarget.id);
    setDeleteTarget(null);
  }

  if (loading) return <LoadingSpinner message="Loading collections..." />;
  if (error) return <div className={styles.error}>Failed to load collections: {error}</div>;

  const shown = collections.filter((c) => !isPlatformCollection(c));

  return (
    <>
      <div className={styles.grid}>
        {shown.map((collection) => (
          <div
            key={collection.id}
            className={dropTargetId === collection.id ? styles.fileTarget : undefined}
            onDragOver={(e) => {
              if (e.dataTransfer.types.includes("application/x-yukig-item")) {
                e.preventDefault();
                setDropTargetId(collection.id);
              }
            }}
            onDragLeave={() => setDropTargetId((id) => (id === collection.id ? null : id))}
            onDrop={(e) => {
              const itemId = e.dataTransfer.getData("application/x-yukig-item");
              if (itemId) { e.preventDefault(); setDropTargetId(null); onFileGame?.(itemId, collection.id); }
            }}
          >
            <CompactCard
              collection={collection}
              onClick={() => navigate(`/collections/${collection.id}`)}
              onDelete={(e) => { e.stopPropagation(); setDeleteTarget(collection); }}
            />
          </div>
        ))}
        <button className={styles.new} onClick={() => setShowNewModal(true)}>
          <Plus size={14} color="var(--color-text-muted)" strokeWidth={1.5} />
          <span>New Collection</span>
        </button>
      </div>

      <CollectionDialogs
        showNew={showNewModal}
        deleteTarget={deleteTarget}
        onCreate={handleCreate}
        onCancelNew={() => setShowNewModal(false)}
        onConfirmDelete={handleDelete}
        onCancelDelete={() => setDeleteTarget(null)}
      />
    </>
  );
}
