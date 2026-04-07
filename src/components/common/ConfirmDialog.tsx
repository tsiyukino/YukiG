/**
 * Modal confirmation dialog for destructive actions.
 */
import { createPortal } from "react-dom";

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
      className="dialog-overlay"
      onMouseDown={(e) => { mouseDownOnOverlay = e.target === e.currentTarget; }}
      onMouseUp={(e) => { if (mouseDownOnOverlay && e.target === e.currentTarget) onCancel(); }}
    >
      <div className="dialog" onMouseDown={(e) => e.stopPropagation()}>
        <h2 className="dialog-title">{title}</h2>
        <p className="dialog-message">{message}</p>
        <div className="dialog-actions">
          <button className="dialog-btn dialog-btn--cancel" onClick={onCancel}>
            Cancel
          </button>
          <button className="dialog-btn dialog-btn--danger" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
      <style>{`
        .dialog-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        .dialog {
          background: var(--color-bg);
          border-radius: var(--radius-md);
          padding: var(--space-6);
          width: 360px;
          box-shadow: var(--shadow-lg);
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
        }
        .dialog-title {
          font-size: 16px;
          font-weight: 600;
          color: var(--color-text-primary);
        }
        .dialog-message {
          font-size: 14px;
          color: var(--color-text-secondary);
          line-height: 1.6;
        }
        .dialog-actions {
          display: flex;
          justify-content: flex-end;
          gap: var(--space-2);
        }
        .dialog-btn {
          padding: var(--space-2) var(--space-4);
          border-radius: var(--radius-sm);
          font-size: 14px;
          font-weight: 500;
          transition: background var(--transition-fast);
        }
        .dialog-btn--cancel {
          background: var(--color-bg-secondary);
          color: var(--color-text-secondary);
          border: 1px solid var(--color-border);
        }
        .dialog-btn--cancel:hover {
          background: var(--color-bg-tertiary);
        }
        .dialog-btn--danger {
          background: var(--color-danger);
          color: white;
        }
        .dialog-btn--danger:hover {
          background: var(--color-danger-hover);
        }
      `}</style>
    </div>,
    document.body
  );
}
