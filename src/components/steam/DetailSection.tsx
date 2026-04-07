/**
 * Collapsible card section used in the game detail tab.
 *
 * Renders a header with an icon, title, optional badge, and expand/collapse
 * chevron. Children are shown only when expanded.
 */
import React from "react";
import { RefreshCw, ChevronDown, ChevronUp } from "lucide-react";

interface DetailSectionProps {
  /** Icon element shown in the card header. */
  icon: React.ReactNode;
  /** Section title text. */
  title: string;
  /** Optional badge element shown next to the title (e.g. achievement count). */
  badge?: React.ReactNode;
  /** Called when the header is clicked to toggle expanded state. */
  onToggle: () => void;
  /** Whether the section body is currently shown. */
  expanded: boolean;
  /** When true, shows a spinner instead of the chevron. */
  loading?: boolean;
  /** Content to render inside the card body when expanded. */
  children: React.ReactNode;
}

/**
 * A collapsible section card used in the game detail tab.
 * Shows a loading spinner while data is being fetched on first open.
 */
export default function DetailSection({ icon, title, badge, onToggle, expanded, loading, children }: DetailSectionProps) {
  return (
    <div className="sdt-card">
      <button className="sdt-card-header" onClick={onToggle}>
        <span className="sdt-card-title">
          <span className="sdt-card-icon">{icon}</span>
          {title}
          {badge}
        </span>
        {loading
          ? <RefreshCw size={13} className="sp-spin sdt-card-chevron" />
          : expanded
            ? <ChevronUp size={14} className="sdt-card-chevron" />
            : <ChevronDown size={14} className="sdt-card-chevron" />
        }
      </button>
      {expanded && <div className="sdt-card-body">{children}</div>}
    </div>
  );
}
