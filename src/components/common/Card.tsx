/**
 * Generic card container with hover effects.
 *
 * Used as the base for collection cards and item cards throughout the app.
 */
import { ReactNode, CSSProperties } from "react";

interface CardProps {
  /** Card body content. */
  children: ReactNode;
  /** Click handler — if provided, the card gets pointer cursor and hover state. */
  onClick?: () => void;
  /** Additional CSS class names. */
  className?: string;
  /** Inline styles for one-off overrides. */
  style?: CSSProperties;
}

/**
 * Base card container with consistent shadow, border, and hover behavior.
 */
export default function Card({ children, onClick, className = "", style }: CardProps) {
  return (
    <div
      className={`card ${onClick ? "card--clickable" : ""} ${className}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === "Enter" && onClick() : undefined}
      style={style}
    >
      {children}
      <style>{`
        .card {
          background: var(--color-bg);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          box-shadow: var(--shadow-sm);
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        .card--clickable {
          cursor: pointer;
          transition: box-shadow var(--transition-fast), border-color var(--transition-fast);
        }
        .card--clickable:hover {
          box-shadow: var(--shadow-md);
          border-color: var(--color-border);
        }
        .card--clickable:active {
          box-shadow: var(--shadow-sm);
        }
      `}</style>
    </div>
  );
}
