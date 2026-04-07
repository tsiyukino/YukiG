/**
 * Strategy-specific view component for the `code` (Code Project) strategy.
 *
 * Placeholder UI. Displays the detected primary language, per-language file
 * counts from scan metadata, and a flat/tree file listing. Extended features
 * (editor integration, build commands, dependency graph) will be added later.
 *
 * @param itemId - The item UUID
 * @param folderPath - Absolute path to the project root folder
 */
import { useState } from "react";
import { RefreshCw, FolderOpen, File, ExternalLink, Code } from "lucide-react";
import { shellOpenPath } from "@/services/tauriCommands";
import { useStrategy } from "@/hooks/useStrategy";
import { useFileWatcher } from "@/hooks/useFileWatcher";
import { formatFileSize } from "@/utils/formatFileSize";
import { formatDate } from "@/utils/formatDate";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import { DisplayItem } from "@/types/strategy";

interface CodeItemViewProps {
  itemId: string;
  /** Absolute path to the code project root. */
  folderPath: string;
}

/** Placeholder view for a code project item. */
export default function CodeItemView({ itemId, folderPath }: CodeItemViewProps) {
  const { displayItems, metadata, loading, error, rescan } = useStrategy(
    itemId,
    folderPath,
    "code",
  );
  const [openError, setOpenError] = useState<string | null>(null);

  useFileWatcher(itemId, folderPath, () => rescan());

  async function handleOpen(path: string) {
    setOpenError(null);
    try {
      await shellOpenPath(path);
    } catch (e) {
      setOpenError(String(e));
    }
  }

  if (loading) return <LoadingSpinner message="Scanning project…" />;

  const primaryLanguage = metadata?.primary_language ?? "Unknown";
  const fileCount = Number(metadata?.file_count ?? 0);

  // Extract per-language counts from metadata keys prefixed with "lang_".
  const langEntries = Object.entries(metadata ?? {})
    .filter(([k]) => k.startsWith("lang_"))
    .map(([k, v]) => ({
      lang: k.replace(/^lang_/, "").replace(/_/g, " "),
      count: Number(v),
    }))
    .sort((a, b) => b.count - a.count);

  return (
    <div className="civ-root">
      {error && <p className="civ-error">{error}</p>}
      {openError && <p className="civ-error">{openError}</p>}

      {/* Project summary header */}
      <div className="civ-header">
        <div className="civ-lang-primary">
          <Code size={14} color="var(--color-accent)" />
          <span className="civ-lang-label">{primaryLanguage}</span>
          <span className="civ-file-count">{fileCount} source file(s)</span>
        </div>
        <button className="civ-rescan-btn" onClick={rescan} title="Rescan project">
          <RefreshCw size={12} />
          Rescan
        </button>
      </div>

      {/* Language breakdown */}
      {langEntries.length > 0 && (
        <div className="civ-lang-breakdown">
          {langEntries.map(({ lang, count }) => (
            <span key={lang} className="civ-lang-chip">
              {lang}
              <span className="civ-lang-chip-count">{count}</span>
            </span>
          ))}
        </div>
      )}

      {/* Placeholder notice */}
      <div className="civ-placeholder-notice">
        Code project features (editor integration, build commands, dependency graph) are planned
        for a future release. For now, files are listed below.
      </div>

      {/* File listing */}
      {displayItems.length === 0 ? (
        <p className="civ-empty">No source files found.</p>
      ) : (
        <div className="civ-tree">
          {displayItems.map((item) => (
            <CodeRow
              key={item.path}
              item={item}
              rootPath={folderPath}
              onOpen={handleOpen}
            />
          ))}
        </div>
      )}

      <style>{`
        .civ-root {
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
        }
        .civ-error {
          font-size: 12px;
          color: var(--color-danger);
        }
        .civ-header {
          display: flex;
          align-items: center;
          gap: var(--space-2);
        }
        .civ-lang-primary {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          flex: 1;
        }
        .civ-lang-label {
          font-size: 13px;
          font-weight: 600;
          color: var(--color-text-primary);
        }
        .civ-file-count {
          font-size: 12px;
          color: var(--color-text-muted);
        }
        .civ-rescan-btn {
          display: inline-flex;
          align-items: center;
          gap: var(--space-1);
          padding: var(--space-1) var(--space-2);
          font-size: 11px;
          color: var(--color-text-muted);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          transition: background var(--transition-fast), color var(--transition-fast);
        }
        .civ-rescan-btn:hover {
          background: var(--color-bg-secondary);
          color: var(--color-text-primary);
        }
        .civ-lang-breakdown {
          display: flex;
          flex-wrap: wrap;
          gap: var(--space-1);
        }
        .civ-lang-chip {
          display: inline-flex;
          align-items: center;
          gap: var(--space-1);
          padding: 2px 8px;
          border-radius: 99px;
          border: 1px solid var(--color-border);
          background: var(--color-bg-secondary);
          font-size: 11px;
          color: var(--color-text-secondary);
        }
        .civ-lang-chip-count {
          background: var(--color-bg-tertiary);
          border-radius: 99px;
          padding: 0 4px;
          font-size: 10px;
          color: var(--color-text-muted);
        }
        .civ-placeholder-notice {
          font-size: 11px;
          color: var(--color-text-muted);
          background: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          padding: var(--space-2) var(--space-3);
          font-style: italic;
        }
        .civ-tree {
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          overflow: hidden;
        }
        .civ-empty {
          font-size: 13px;
          color: var(--color-text-muted);
          text-align: center;
          padding: var(--space-6);
        }
      `}</style>
    </div>
  );
}

// ─── CodeRow sub-component ───────────────────────────────────────────────────

interface CodeRowProps {
  item: DisplayItem;
  rootPath: string;
  onOpen: (path: string) => void;
}

/** Single row in the code project file tree. */
function CodeRow({ item, rootPath, onOpen }: CodeRowProps) {
  const normalRoot = rootPath.replace(/\\/g, "/").replace(/\/$/, "");
  const normalPath = item.path.replace(/\\/g, "/");
  const relative = normalPath.startsWith(normalRoot)
    ? normalPath.slice(normalRoot.length).replace(/^\//, "")
    : normalPath;
  const depth = relative === "" ? 0 : (relative.match(/\//g)?.length ?? 0);
  const indent = depth * 16;

  const ext = item.name.includes(".") ? item.name.split(".").pop() ?? "" : "";

  return (
    <div
      className={`cr ${item.is_dir ? "cr--dir" : "cr--file"}`}
      onClick={item.is_dir ? undefined : () => onOpen(item.path)}
      style={{ paddingLeft: `calc(var(--space-3) + ${indent}px)` }}
      title={item.is_dir ? item.path : `Open ${item.name}`}
    >
      <span className="cr-icon">
        {item.is_dir ? (
          <FolderOpen size={13} color="var(--color-accent)" />
        ) : (
          <File size={13} color="var(--color-text-muted)" />
        )}
      </span>
      <span className="cr-name">{item.name}</span>
      {!item.is_dir && ext && <span className="cr-ext">.{ext}</span>}
      <span className="cr-meta">
        {!item.is_dir && item.size_bytes != null && (
          <span>{formatFileSize(item.size_bytes)}</span>
        )}
        {item.modified_at && <span>{formatDate(item.modified_at)}</span>}
      </span>
      {!item.is_dir && <ExternalLink size={11} className="cr-open-icon" />}

      <style>{`
        .cr {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-2) var(--space-3);
          border-bottom: 1px solid var(--color-border-subtle);
          min-height: 34px;
        }
        .cr:last-child { border-bottom: none; }
        .cr--file {
          cursor: pointer;
          transition: background var(--transition-fast);
        }
        .cr--file:hover { background: var(--color-bg-secondary); }
        .cr--file:hover .cr-open-icon { opacity: 1; }
        .cr-icon { flex-shrink: 0; }
        .cr-name {
          flex: 1;
          font-size: 12px;
          font-family: var(--font-mono, monospace);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .cr-ext {
          font-size: 10px;
          color: var(--color-text-muted);
          font-family: var(--font-mono, monospace);
          flex-shrink: 0;
        }
        .cr-meta {
          display: flex;
          gap: var(--space-3);
          font-size: 11px;
          color: var(--color-text-muted);
          flex-shrink: 0;
        }
        .cr-open-icon {
          color: var(--color-text-muted);
          opacity: 0;
          flex-shrink: 0;
          transition: opacity var(--transition-fast);
        }
      `}</style>
    </div>
  );
}
