/**
 * Generic card container with hover effects.
 *
 * Used as the base for collection cards and item cards throughout the app.
 */
import { ReactNode, CSSProperties } from "react";
import styles from "./Card.module.css";

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
      className={`${styles.card} ${onClick ? styles.clickable : ""} ${className}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === "Enter" && onClick() : undefined}
      style={style}
    >
      {children}
    </div>
  );
}
