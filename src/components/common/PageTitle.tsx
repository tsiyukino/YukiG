/**
 * Sticky page header with the app's signature accent tick, a display-font
 * title, an optional subtitle, and a right-aligned actions slot.
 */
import { ReactNode } from "react";
import styles from "./PageTitle.module.css";

interface PageTitleProps {
  title: string;
  /** Secondary line under the title. */
  subtitle?: ReactNode;
  /** Toolbar content rendered on the right, baseline-aligned. */
  actions?: ReactNode;
}

/**
 * Renders the standard page header used across top-level pages.
 */
export default function PageTitle({ title, subtitle, actions }: PageTitleProps) {
  return (
    <div className={styles.header}>
      <div className={styles.left}>
        <div className={styles.titleRow}>
          <span className={styles.tick} aria-hidden />
          <h1 className={styles.title}>{title}</h1>
        </div>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  );
}
