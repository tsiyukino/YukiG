/**
 * List view for the Games page — expandable accordion section per collection.
 */
import { useCollections } from "@/hooks/useCollections";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import CollectionSection from "@/components/games/CollectionSection";
import styles from "./ListView.module.css";

/**
 * Stacked expandable collection sections.
 */
export default function ListView() {
  const { collections, loading, error } = useCollections();

  if (loading) return <LoadingSpinner message="Loading collections..." />;
  if (error) return <div className={styles.error}>Failed to load collections: {error}</div>;

  return (
    <div className={styles.list}>
      {collections.map((c) => <CollectionSection key={c.id} collection={c} />)}
      {collections.length === 0 && <p className={styles.empty}>No collections yet.</p>}
    </div>
  );
}
