/**
 * Generic modal shell: portal, dimmed overlay, centered panel with
 * entrance animation. Clicking the overlay closes — but only when the
 * mousedown also started there, so text-selection drags out of inputs
 * don't dismiss the modal.
 */
import { ReactNode, useRef } from "react";
import { createPortal } from "react-dom";
import styles from "./Modal.module.css";

interface ModalProps {
  /** Optional heading rendered at the top of the panel. */
  title?: string;
  /** Panel width in px. Defaults to 420. */
  width?: number;
  /** Called when the user clicks the overlay. */
  onClose: () => void;
  children: ReactNode;
}

/**
 * Renders a centered modal dialog into document.body.
 */
export default function Modal({ title, width = 420, onClose, children }: ModalProps) {
  const mouseDownOnOverlay = useRef(false);

  return createPortal(
    <div
      className={styles.overlay}
      onMouseDown={(e) => { mouseDownOnOverlay.current = e.target === e.currentTarget; }}
      onMouseUp={(e) => { if (mouseDownOnOverlay.current && e.target === e.currentTarget) onClose(); }}
    >
      <div className={styles.panel} style={{ width }} onMouseDown={(e) => e.stopPropagation()}>
        {title && <h2 className={styles.title}>{title}</h2>}
        {children}
      </div>
    </div>,
    document.body
  );
}
