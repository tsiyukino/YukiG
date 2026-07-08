/**
 * Presentational context menu: a fixed-position command list rendered
 * into document.body. Clamps itself to the viewport and closes on any
 * outside interaction (mousedown, Escape, scroll, resize, window blur).
 * Owns no open/close state — ContextMenuProvider decides when it exists.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LucideIcon } from "lucide-react";
import styles from "./ContextMenu.module.css";

/** Gap kept between the menu edge and the viewport edge, in px. */
const VIEWPORT_MARGIN = 8;

/** A single selectable row in a context menu. */
export interface MenuEntry {
  /** Stable identifier, used as the React key. */
  id: string;
  /** Text shown for the row. */
  label: string;
  /** Optional Lucide icon rendered before the label. */
  icon?: LucideIcon;
  /** Renders the row in the danger color (destructive actions). */
  danger?: boolean;
  /** Greys the row out and ignores clicks. */
  disabled?: boolean;
  /** Called when the row is clicked; the menu closes afterwards. */
  onSelect: () => void;
}

/** Menu contents: rows, with "separator" strings drawing dividers. */
export type MenuContent = (MenuEntry | "separator")[];

interface ContextMenuProps {
  /** Cursor position in viewport coordinates. */
  x: number;
  y: number;
  /** Rows and separators to render, top to bottom. */
  entries: MenuContent;
  /** Called whenever the menu should disappear. */
  onClose: () => void;
}

/**
 * Renders an open context menu at the given cursor position.
 */
export default function ContextMenu({ x, y, entries, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });

  // Clamp to the viewport once the menu has a measurable size.
  // useLayoutEffect runs before paint, so the unclamped position never shows.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPos({
      left: Math.max(VIEWPORT_MARGIN, Math.min(x, window.innerWidth - rect.width - VIEWPORT_MARGIN)),
      top: Math.max(VIEWPORT_MARGIN, Math.min(y, window.innerHeight - rect.height - VIEWPORT_MARGIN)),
    });
  }, [x, y]);

  // Any outside interaction dismisses the menu. Mousedown covers both
  // left- and right-clicks; scroll uses capture because it doesn't bubble.
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onClose, true);
    window.addEventListener("resize", onClose);
    window.addEventListener("blur", onClose);
    return () => {
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onClose, true);
      window.removeEventListener("resize", onClose);
      window.removeEventListener("blur", onClose);
    };
  }, [onClose]);

  return createPortal(
    <div ref={ref} className={styles.menu} style={pos} role="menu">
      {entries.map((entry, i) =>
        entry === "separator" ? (
          <div key={`separator-${i}`} className={styles.separator} role="separator" />
        ) : (
          <button
            key={entry.id}
            type="button"
            role="menuitem"
            className={entry.danger ? `${styles.item} ${styles.danger}` : styles.item}
            disabled={entry.disabled}
            onClick={() => {
              entry.onSelect();
              onClose();
            }}
          >
            {entry.icon && <entry.icon size={14} className={styles.icon} />}
            <span>{entry.label}</span>
          </button>
        )
      )}
    </div>,
    document.body
  );
}
