/**
 * Table view for the Games page — flat clickable rows per collection.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCollections } from "@/hooks/useCollections";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import { isPlatformCollection } from "@/utils/collectionSource";
import styles from "./TableView.module.css";

interface TableViewProps {
  /** Files a dragged unfiled game into a collection. */
  onFileGame?: (itemId: string, collectionId: string) => void;
}

/**
 * Simple two-column table of collections.
 * The Steam system group is always hidden (browsed on the Steam page).
 * Rows accept dropped games (from the unfiled panel) to file them.
 */
export default function TableView({ onFileGame }: TableViewProps) {
  const navigate = useNavigate();
  const { collections, loading, error } = useCollections();
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  if (loading) return <LoadingSpinner message="Loading collections..." />;
  if (error) return <div className={styles.error}>Failed to load collections: {error}</div>;

  const shown = collections.filter((c) => !isPlatformCollection(c));

  return (
    <div className={styles.wrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.th}>Name</th>
            <th className={styles.th}>Description</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((c) => (
            <tr
              key={c.id}
              className={dropTargetId === c.id ? `${styles.row} ${styles.fileTarget}` : styles.row}
              onClick={() => navigate(`/collections/${c.id}`)}
              onDragOver={(e) => {
                if (e.dataTransfer.types.includes("application/x-yukig-item")) {
                  e.preventDefault();
                  setDropTargetId(c.id);
                }
              }}
              onDragLeave={() => setDropTargetId((id) => (id === c.id ? null : id))}
              onDrop={(e) => {
                const itemId = e.dataTransfer.getData("application/x-yukig-item");
                if (itemId) { e.preventDefault(); setDropTargetId(null); onFileGame?.(itemId, c.id); }
              }}
            >
              <td className={styles.td}>
                <span className={styles.dot} style={{ background: c.color }} />
                {c.name}
              </td>
              <td className={`${styles.td} ${styles.muted}`}>{c.description || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
