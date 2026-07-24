/**
 * "Details" card: labelled path rows with per-row action buttons, used by
 * the game detail page for the executable / mod / screenshots / saves
 * paths. Presentational — rows and actions are composed by the caller.
 */
import { ReactNode } from "react";
import styles from "./PathRowsCard.module.css";

/** One labelled path row. */
export interface PathRowSpec {
  /** Stable key for React. */
  key: string;
  /** Icon rendered before the label. */
  icon: ReactNode;
  label: string;
  /** The path text; empty renders a muted "Not set". */
  path: string;
  /** Optional action button(s) on the right. */
  action?: ReactNode;
  /** Extra line under the path (e.g. "Last played …"). */
  sub?: string;
}

interface PathRowsCardProps {
  rows: PathRowSpec[];
  /** Optional footer content (e.g. a rescan button). */
  footer?: ReactNode;
}

/**
 * Renders the path rows and optional footer.
 */
export default function PathRowsCard({ rows, footer }: PathRowsCardProps) {
  return (
    <div className={styles.card}>
      {rows.map((row) => (
        <div key={row.key} className={styles.row}>
          <div className={styles.rowLeft}>
            <span className={styles.rowIcon}>{row.icon}</span>
            <div className={styles.rowContent}>
              <span className={styles.rowLabel}>{row.label}</span>
              {row.path
                ? <span className={styles.path}>{row.path}</span>
                : <span className={styles.missing}>Not set</span>}
              {row.sub && <span className={styles.sub}>{row.sub}</span>}
            </div>
          </div>
          {row.action}
        </div>
      ))}
      {footer && <div className={styles.footer}>{footer}</div>}
    </div>
  );
}
