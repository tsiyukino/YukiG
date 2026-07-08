/**
 * Segmented icon toggle for switching between view modes.
 * Generic over the view-mode string union of the consuming page.
 */
import { ReactNode } from "react";
import styles from "./ViewToggle.module.css";

/** One selectable view mode. */
export interface ViewOption<V extends string> {
  /** The mode value this option represents. */
  value: V;
  /** Icon rendered inside the button. */
  icon: ReactNode;
  /** Tooltip label, e.g. "Card view". */
  title: string;
}

interface ViewToggleProps<V extends string> {
  /** Available view modes in display order. */
  options: ViewOption<V>[];
  /** The currently active mode. */
  value: V;
  /** Called with the newly selected mode. */
  onChange: (value: V) => void;
}

/**
 * Renders a bordered segmented control of icon buttons.
 */
export default function ViewToggle<V extends string>({ options, value, onChange }: ViewToggleProps<V>) {
  return (
    <div className={styles.toggle}>
      {options.map((opt) => (
        <button
          key={opt.value}
          className={opt.value === value ? `${styles.btn} ${styles.active}` : styles.btn}
          onClick={() => onChange(opt.value)}
          title={opt.title}
        >
          {opt.icon}
        </button>
      ))}
    </div>
  );
}
