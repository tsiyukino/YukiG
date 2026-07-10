/**
 * Card view for the Games page — large collection cards in a responsive
 * grid with drag-and-drop reordering and a dashed "new collection" card.
 */
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { collectionReorder } from "@/services/tauriCommands";
import { Collection, NewCollection } from "@/types/collection";
import { useCollections } from "@/hooks/useCollections";
import { isPlatformCollection } from "@/utils/collectionSource";
import Card from "@/components/common/Card";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import CollectionCard from "@/components/games/CollectionCard";
import CollectionDialogs from "@/components/games/CollectionDialogs";
import styles from "./CardView.module.css";

interface CardViewProps {
  /** Files a dragged unfiled game into a collection. */
  onFileGame?: (itemId: string, collectionId: string) => void;
}

/**
 * Reorderable collection card grid with create/delete actions.
 *
 * The Steam system group is always hidden here — it is the Steam library
 * container, browsed on the Steam page, not a user organisational group.
 * Collection cards accept dropped games (from the unfiled panel) to file them.
 */
export default function CardView({ onFileGame }: CardViewProps) {
  const navigate = useNavigate();
  const { collections: rawCollections, loading, error, createCollection, deleteCollection, refresh } = useCollections();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [showNewModal, setShowNewModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Collection | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const dragIndexRef = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  // Sync local order state from hook whenever raw data changes, always hiding
  // the Steam system group.
  useEffect(() => {
    setCollections(rawCollections.filter((c) => !isPlatformCollection(c)));
  }, [rawCollections]);

  async function handleCreate(input: NewCollection) {
    await createCollection(input);
    setShowNewModal(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await deleteCollection(deleteTarget.id);
    setDeleteTarget(null);
  }

  function handleDragStart(index: number) {
    dragIndexRef.current = index;
    setDraggingIndex(index);
  }

  async function handleDrop(dropIndex: number) {
    const from = dragIndexRef.current;
    setDragOverIndex(null);
    setDraggingIndex(null);
    if (from === null || from === dropIndex) return;
    const next = [...collections];
    const [moved] = next.splice(from, 1);
    next.splice(dropIndex, 0, moved);
    setCollections(next);
    dragIndexRef.current = null;
    await collectionReorder(next.map((c, i) => [c.id, i] as [string, number])).catch(() => {});
    // Invalidate the shared cache so navigating away and back reflects the new
    // order; the local state above already shows it for the current view.
    refresh();
  }

  if (loading) return <LoadingSpinner message="Loading collections..." />;
  if (error) return <div className={styles.error}>Failed to load collections: {error}</div>;

  return (
    <>
      <div
        className={styles.grid}
        onDrop={(e) => { e.preventDefault(); if (dragOverIndex !== null) handleDrop(dragOverIndex); }}
        onDragOver={(e) => e.preventDefault()}
      >
        {collections.map((collection, index) => {
          const showSlotBefore =
            dragOverIndex === index && draggingIndex !== null &&
            draggingIndex !== index && dragOverIndex < draggingIndex;
          const showSlotAfter =
            dragOverIndex === index && draggingIndex !== null &&
            draggingIndex !== index && dragOverIndex > draggingIndex;
          return (
            <div key={collection.id} className={styles.dragWrapper}>
              {showSlotBefore && <div className={styles.dropSlot} />}
              <div
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => {
                  e.preventDefault(); e.stopPropagation();
                  // A game being filed sets the item mime type; a reorder does not.
                  if (e.dataTransfer.types.includes("application/x-yukig-item")) {
                    setDropTargetId(collection.id);
                  } else {
                    setDragOverIndex(index);
                  }
                }}
                onDragLeave={() => setDropTargetId((id) => (id === collection.id ? null : id))}
                onDrop={(e) => {
                  const itemId = e.dataTransfer.getData("application/x-yukig-item");
                  if (itemId) {
                    e.preventDefault(); e.stopPropagation();
                    setDropTargetId(null);
                    onFileGame?.(itemId, collection.id);
                  }
                }}
                onDragEnd={() => { setDragOverIndex(null); setDraggingIndex(null); }}
                className={
                  dropTargetId === collection.id
                    ? `${styles.dragItem} ${styles.fileTarget}`
                    : draggingIndex === index
                    ? `${styles.dragItem} ${styles.dragging}`
                    : styles.dragItem
                }
              >
                <CollectionCard
                  collection={collection}
                  onClick={() => navigate(`/collections/${collection.id}`)}
                  onDelete={(e) => { e.stopPropagation(); setDeleteTarget(collection); }}
                />
              </div>
              {showSlotAfter && <div className={styles.dropSlot} />}
            </div>
          );
        })}

        <Card onClick={() => setShowNewModal(true)} className={styles.newCard}>
          <div className={styles.newInner}>
            <div className={styles.newIcon}>
              <Plus size={20} color="var(--color-text-muted)" strokeWidth={1.5} />
            </div>
            <span className={styles.newLabel}>New Collection</span>
          </div>
        </Card>
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
