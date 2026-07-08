/**
 * Dashed pick-target button used across the add-item flow: shows an icon,
 * a state label, and the chosen path once selected.
 */
import { ReactNode } from "react";
import styles from "./PathPickerButton.module.css";

interface PathPickerButtonProps {
  /** Icon rendered in the leading square; receives white when selected. */
  icon: ReactNode;
  /** Label shown before a selection is made. */
  idleLabel: string;
  /** Label shown once a value is selected. */
  selectedLabel: string;
  /** Hint line under the label while idle (e.g. "Browse for a folder"). */
  idleHint?: string;
  /** The selected path; empty string means idle. */
  value: string;
  disabled?: boolean;
  onClick: () => void;
}

/**
 * Renders the shared path-picker affordance.
 */
export default function PathPickerButton({
  icon,
  idleLabel,
  selectedLabel,
  idleHint,
  value,
  disabled,
  onClick,
}: PathPickerButtonProps) {
  const active = value.length > 0;
  return (
    <button
      type="button"
      className={active ? `${styles.picker} ${styles.selected}` : styles.picker}
      onClick={onClick}
      disabled={disabled}
    >
      <div className={styles.icon}>{icon}</div>
      <div className={styles.text}>
        <span className={styles.label}>{active ? selectedLabel : idleLabel}</span>
        {(active || idleHint) && (
          <span className={styles.path}>{active ? value : idleHint}</span>
        )}
      </div>
    </button>
  );
}
