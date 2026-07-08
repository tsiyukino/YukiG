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
import Card from "@/components/common/Card";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import CollectionCard from "@/components/games/CollectionCard";
import CollectionDialogs from "@/components/games/CollectionDialogs";
import styles from "./CardView.module.css";

/**
 * Reorderable collection card grid with create/delete actions.
 */
export default function CardView() {
  const navigate = useNavigate();
  const { collections: rawCollections, loading, error, createCollection, deleteCollection } = useCollections();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [showNewModal, setShowNewModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Collection | null>(null);
  const dragIndexRef = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  // Sync local order state from hook whenever raw data changes
  useEffect(() => { setCollections(rawCollections); }, [rawCollections]);

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
    await collectionReorder(next.map((c, i) => [c.id, i])).catch(() => {});
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
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverIndex(index); }}
                onDragEnd={() => { setDragOverIndex(null); setDraggingIndex(null); }}
                className={draggingIndex === index ? `${styles.dragItem} ${styles.dragging}` : styles.dragItem}
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
