/**
 * Modal confirmation dialog for destructive actions.
 */
import { createPortal } from "react-dom";
import styles from "./ConfirmDialog.module.css";

interface ConfirmDialogProps {
  /** Whether the dialog is visible. */
  open: boolean;
  /** Dialog title. */
  title: string;
  /** Body message explaining what will happen. */
  message: string;
  /** Label for the confirm button. Defaults to "Delete". */
  confirmLabel?: string;
  /** Called when the user clicks the confirm button. */
  onConfirm: () => void;
  /** Called when the user cancels or clicks outside. */
  onCancel: () => void;
}

/**
 * Renders a confirmation modal overlay.
 * Does not render anything when `open` is false.
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Delete",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  let mouseDownOnOverlay = false;

  return createPortal(
    <div
      className={styles.overlay}
      onMouseDown={(e) => { mouseDownOnOverlay = e.target === e.currentTarget; }}
      onMouseUp={(e) => { if (mouseDownOnOverlay && e.target === e.currentTarget) onCancel(); }}
    >
      <div className={styles.dialog} onMouseDown={(e) => e.stopPropagation()}>
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.message}>{message}</p>
        <div className={styles.actions}>
          <button className={`${styles.btn} ${styles.cancel}`} onClick={onCancel}>
            Cancel
          </button>
          <button className={`${styles.btn} ${styles.danger}`} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
