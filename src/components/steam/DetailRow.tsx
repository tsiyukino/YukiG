/**
 * A single labeled key-value row used inside the detail drawer.
 */
import React from "react";

interface DetailRowProps {
  /** Icon element displayed on the left. */
  icon: React.ReactNode;
  /** Short uppercase label shown above the value. */
  label: string;
  /** The value string to display. */
  value: string;
  /** When true, renders the value in a monospace font. */
  mono?: boolean;
}

/**
 * Renders a labeled detail row with an icon, label, and value.
 * Used inside DetailDrawer to show game metadata (location, size, dates, etc.).
 */
export default function DetailRow({ icon, label, value, mono }: DetailRowProps) {
  return (
    <div className="sp-detail-row">
      <span className="sp-detail-icon">{icon}</span>
      <div className="sp-detail-content">
        <span className="sp-detail-label">{label}</span>
        <span className={`sp-detail-val ${mono ? "sp-mono" : ""}`}>{value}</span>
      </div>
    </div>
  );
}
