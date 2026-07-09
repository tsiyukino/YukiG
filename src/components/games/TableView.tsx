/**
 * Table view for the Games page — flat clickable rows per collection.
 */
import { useNavigate } from "react-router-dom";
import { useCollections } from "@/hooks/useCollections";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import { isPlatformCollection } from "@/utils/groupingTag";
import styles from "./TableView.module.css";

/**
 * Simple two-column table of collections.
 * The Steam system group is always hidden (browsed on the Steam page).
 */
export default function TableView() {
  const navigate = useNavigate();
  const { collections, loading, error } = useCollections();

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
            <tr key={c.id} className={styles.row} onClick={() => navigate(`/collections/${c.id}`)}>
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
