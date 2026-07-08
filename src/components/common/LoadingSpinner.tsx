/**
 * Centered loading spinner for async content areas.
 */
import styles from "./LoadingSpinner.module.css";

interface LoadingSpinnerProps {
  /** Optional message to display below the spinner. */
  message?: string;
}

/**
 * Displays a spinning indicator with an optional status message.
 */
export default function LoadingSpinner({ message }: LoadingSpinnerProps) {
  return (
    <div className={styles.wrap}>
      <div className={styles.spinner} />
      {message && <p className={styles.message}>{message}</p>}
    </div>
  );
}
