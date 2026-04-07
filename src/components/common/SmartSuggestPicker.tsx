/**
 * Compact smart-suggest picker used in the game metadata step.
 *
 * Shows a ranked list of path candidates (executables, mod folders,
 * screenshot folders). The top N items are shown immediately; a
 * "Show more" toggle reveals the rest. The user can also click
 * "Browse…" to pick manually via the OS dialog.
 */
import { useState } from "react";
import { ChevronDown, ChevronUp, FolderOpen, FileText, Check } from "lucide-react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { PathSuggestion } from "@/services/tauriCommands";

/** How many suggestions to show before the expand button. */
const INITIAL_VISIBLE = 3;

interface SmartSuggestPickerProps {
  /** Label shown above the picker (e.g. "Executable (.exe)"). */
  label: string;
  /** Whether a selection is required. */
  required: boolean;
  /** Field type: "file_path" or "folder_path". */
  fieldType: "file_path" | "folder_path";
  /** Sorted suggestion list from the backend. */
  suggestions: PathSuggestion[];
  /** Currently selected path (empty string = none). */
  value: string;
  /** Base path passed to the OS dialog as the starting directory. */
  basePath?: string;
  onChange: (path: string) => void;
  /** Called to scan one layer deeper. If absent, no load-more button is shown. */
  onLoadMore?: () => void;
  /** True while the deeper scan is in progress. */
  loadingMore?: boolean;
  /** True when the maximum scan depth has been reached. */
  noMore?: boolean;
}

/**
 * Renders a compact suggestion list with an expand toggle and a manual browse fallback.
 */
export default function SmartSuggestPicker({
  label, required, fieldType, suggestions, value, basePath, onChange,
  onLoadMore, loadingMore, noMore,
}: SmartSuggestPickerProps) {
  const [expanded, setExpanded] = useState(false);
  const [picking, setPicking] = useState(false);

  const visible = expanded ? suggestions : suggestions.slice(0, INITIAL_VISIBLE);
  const hasMore = suggestions.length > INITIAL_VISIBLE;
  const isFile = fieldType === "file_path";

  async function handleBrowse() {
    setPicking(true);
    try {
      const selected = await openDialog({
        directory: !isFile,
        multiple: false,
        defaultPath: basePath || undefined,
        filters: isFile ? [{ name: "Executable", extensions: ["exe"] }] : undefined,
      });
      if (typeof selected === "string" && selected) onChange(selected);
    } catch { /* cancelled */ } finally { setPicking(false); }
  }

  /** Formats the display path: strip the base path prefix for brevity. */
  function shortPath(p: string): string {
    if (basePath && p.startsWith(basePath)) {
      return "." + p.slice(basePath.length).replace(/\\/g, "/");
    }
    return p;
  }

  return (
    <div className="ssp-root">
      <div className="ssp-label-row">
        <span className="aim-label">
          {label}
          {required && <span style={{ color: "var(--color-danger)", marginLeft: 3 }}>*</span>}
        </span>
        <button type="button" className="ssp-browse-btn" onClick={handleBrowse} disabled={picking}>
          {isFile
            ? <><FileText size={11} /> Browse…</>
            : <><FolderOpen size={11} /> Browse…</>}
        </button>
      </div>

      {suggestions.length === 0 ? (
        <div className="ssp-empty">
          No {isFile ? "executables" : "folders"} found automatically.
          {value && <span className="ssp-manual-val">{shortPath(value)}</span>}
        </div>
      ) : (
        <div className="ssp-list">
          {visible.map((s) => {
            const selected = value === s.path;
            return (
              <button
                key={s.path}
                type="button"
                className={`ssp-item${selected ? " ssp-item--selected" : ""}`}
                onClick={() => onChange(selected ? "" : s.path)}
                title={s.path}
              >
                <div className="ssp-check">{selected && <Check size={10} strokeWidth={3} />}</div>
                <span className="ssp-name">{s.name}</span>
                <span className="ssp-meta">
                  {s.depth === 0 ? "root" : `depth ${s.depth}`}
                  {s.size_bytes > 0 && <> · {formatSize(s.size_bytes)}</>}
                </span>
              </button>
            );
          })}

          {/* If value was set manually (not in suggestions list) show it */}
          {value && !suggestions.some((s) => s.path === value) && (
            <button
              type="button"
              className="ssp-item ssp-item--selected"
              onClick={() => onChange("")}
              title={value}
            >
              <div className="ssp-check"><Check size={10} strokeWidth={3} /></div>
              <span className="ssp-name" style={{ fontStyle: "italic" }}>
                {value.split(/[/\\]/).pop() ?? value}
              </span>
              <span className="ssp-meta">manual</span>
            </button>
          )}

          {hasMore && (
            <button type="button" className="ssp-expand" onClick={() => setExpanded((v) => !v)}>
              {expanded
                ? <><ChevronUp size={11} /> Show less</>
                : <><ChevronDown size={11} /> Show {suggestions.length - INITIAL_VISIBLE} more</>}
            </button>
          )}

          {onLoadMore && !noMore && (
            <button
              type="button"
              className="ssp-expand ssp-load-deeper"
              onClick={onLoadMore}
              disabled={loadingMore}
            >
              {loadingMore
                ? <><span className="ssp-spinner" /> Scanning…</>
                : <><ChevronDown size={11} /> Search deeper</>}
            </button>
          )}
          {onLoadMore && noMore && (
            <span className="ssp-no-more">All layers scanned</span>
          )}
        </div>
      )}

      <style>{`
        .ssp-root { display: flex; flex-direction: column; gap: 5px; }

        .ssp-label-row {
          display: flex; align-items: center; justify-content: space-between;
        }

        .ssp-browse-btn {
          display: inline-flex; align-items: center; gap: 3px;
          font-size: 11px; color: var(--color-accent);
          padding: 2px 6px; border-radius: var(--radius-sm);
          transition: background var(--transition-fast);
        }
        .ssp-browse-btn:hover:not(:disabled) { background: var(--color-accent-light); }
        .ssp-browse-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .ssp-empty {
          font-size: 11.5px; color: var(--color-text-muted);
          padding: 8px 10px;
          border: 1px dashed var(--color-border); border-radius: var(--radius-sm);
          background: var(--color-bg-secondary);
        }
        .ssp-manual-val {
          display: block; margin-top: 3px;
          font-size: 10.5px; font-family: var(--font-mono);
          color: var(--color-accent); word-break: break-all;
        }

        .ssp-list {
          display: flex; flex-direction: column; gap: 2px;
        }

        .ssp-item {
          display: flex; align-items: center; gap: 8px;
          padding: 6px 8px; border-radius: var(--radius-sm);
          border: 1px solid var(--color-border); background: var(--color-bg);
          cursor: pointer; text-align: left; width: 100%;
          transition: border-color var(--transition-fast), background var(--transition-fast);
        }
        .ssp-item:hover { border-color: var(--color-accent); background: var(--color-accent-light); }
        .ssp-item--selected {
          border-color: var(--color-accent); background: var(--color-accent-light);
        }

        .ssp-check {
          width: 14px; height: 14px; flex-shrink: 0;
          border-radius: 3px; border: 1.5px solid var(--color-border);
          display: flex; align-items: center; justify-content: center;
          background: var(--color-bg-secondary);
          transition: all var(--transition-fast);
        }
        .ssp-item--selected .ssp-check {
          background: var(--color-accent); border-color: var(--color-accent); color: #fff;
        }

        .ssp-name {
          flex: 1; min-width: 0;
          font-size: 12.5px; font-weight: 500; color: var(--color-text-primary);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }

        .ssp-meta {
          font-size: 10.5px; color: var(--color-text-muted);
          white-space: nowrap; flex-shrink: 0;
        }

        .ssp-expand {
          display: inline-flex; align-items: center; gap: 3px;
          font-size: 11px; color: var(--color-text-muted);
          padding: 4px 8px; border-radius: var(--radius-sm);
          align-self: flex-start;
          transition: color var(--transition-fast), background var(--transition-fast);
        }
        .ssp-expand:hover:not(:disabled) { color: var(--color-text-primary); background: var(--color-bg-secondary); }
        .ssp-expand:disabled { opacity: 0.5; cursor: not-allowed; }
        .ssp-load-deeper { color: var(--color-accent); }
        .ssp-load-deeper:hover:not(:disabled) { background: var(--color-accent-light); }
        .ssp-no-more {
          font-size: 10.5px; color: var(--color-text-muted);
          padding: 3px 8px; align-self: flex-start;
        }
        .ssp-spinner {
          width: 10px; height: 10px; flex-shrink: 0;
          border: 1.5px solid var(--color-border);
          border-top-color: var(--color-accent);
          border-radius: 50%;
          animation: ssp-spin 0.6s linear infinite;
        }
        @keyframes ssp-spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

/** Formats bytes into human-readable string. */
function formatSize(bytes: number): string {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(0)} KB`;
  return `${bytes} B`;
}
