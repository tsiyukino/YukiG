/**
 * Label/value metadata table for the item detail page.
 */
import styles from "./MetaSection.module.css";

/** One metadata line. */
export interface MetaEntry {
  label: string;
  value: string;
  /** Render the value in the mono font (paths, ids). */
  mono?: boolean;
}

/**
 * Renders a bordered stack of metadata rows.
 */
export default function MetaSection({ entries }: { entries: MetaEntry[] }) {
  return (
    <div className={styles.meta}>
      {entries.map(({ label, value, mono }) => (
        <div key={label} className={styles.row}>
          <span className={styles.label}>{label}</span>
          <span className={mono ? `${styles.value} ${styles.mono}` : styles.value}>{value}</span>
        </div>
      ))}
    </div>
  );
}
