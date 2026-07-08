/**
 * Progress dots for the add-item flow: numbered steps with connecting
 * lines; completed steps show a check.
 */
import { Check } from "lucide-react";
import styles from "./StepBar.module.css";

/** One step in the bar. */
export interface StepInfo {
  key: string;
  label: string;
}

interface StepBarProps {
  steps: StepInfo[];
  /** Index of the current step. */
  current: number;
}

/**
 * Renders the numbered step indicator row.
 */
export default function StepBar({ steps, current }: StepBarProps) {
  return (
    <div className={styles.bar}>
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={s.key} className={styles.item}>
            <div className={[styles.dot, active ? styles.dotActive : "", done ? styles.dotDone : ""].filter(Boolean).join(" ")}>
              {done ? <Check size={9} strokeWidth={3} /> : i + 1}
            </div>
            <span className={active ? `${styles.label} ${styles.labelActive}` : styles.label}>{s.label}</span>
            {i < steps.length - 1 && <div className={done ? `${styles.line} ${styles.lineDone}` : styles.line} />}
          </div>
        );
      })}
    </div>
  );
}
