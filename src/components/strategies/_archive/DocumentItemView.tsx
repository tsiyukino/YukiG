/**
 * Strategy-specific view component for document collection items.
 *
 * Renders a file tree of all files and folders under the item's folder,
 * up to MAX_SCAN_DEPTH levels. Each file is clickable and opens with the
 * system default application via the opener plugin.
 *
 * @param itemId - The item UUID
 * @param folderPath - Absolute path to the document folder
 */
import { useState } from "react";
import { File, FolderOpen, ExternalLink, Eye, EyeOff, RefreshCw } from "lucide-react";
import { shellOpenPath } from "@/services/tauriCommands";
import { useStrategy } from "@/hooks/useStrategy";
import { formatFileSize } from "@/utils/formatFileSize";
import { formatDate } from "@/utils/formatDate";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import FilePreview from "@/components/common/FilePreview";
import { useFileWatcher } from "@/hooks/useFileWatcher";
import { DisplayItem } from "@/types/strategy";

interface DocumentItemViewProps {
  itemId: string;
  /** Absolute path to the root folder — used to compute relative indent depth. */
  folderPath: string;
}

/** Renders a browsable file tree for a document collection item. */
export default function DocumentItemView({ itemId, folderPath }: DocumentItemViewProps) {
  const { displayItems, loading, error, rescan } = useStrategy(itemId, folderPath, "document");
  const [openError, setOpenError] = useState<string | null>(null);
  const [previewPath, setPreviewPath] = useState<string | null>(null);

  // Auto-refresh the file list when external changes are detected.
  useFileWatcher(itemId, folderPath, () => rescan());

  function handleTogglePreview(path: string) {
    setPreviewPath((prev) => (prev === path ? null : path));
  }

  async function handleOpen(path: string) {
    setOpenError(null);
    try {
      await shellOpenPath(path);
    } catch (e) {
      setOpenError(String(e));
    }
  }

  if (loading) return <LoadingSpinner message="Loading files…" />;

  return (
    <div className="div-root">
      {error && <p className="div-error">{error}</p>}
      {openError && <p className="div-error">{openError}</p>}

      <div className="div-toolbar">
        <span className="div-count">
          {displayItems.filter((i) => !i.is_dir).length} file(s)
        </span>
        <button className="div-rescan-btn" onClick={rescan} title="Refresh file list">
          <RefreshCw size={12} />
          Refresh
        </button>
      </div>

      {displayItems.length === 0 ? (
        <p className="div-empty">No files found in this folder.</p>
      ) : (
        <div className="div-tree">
          {displayItems.map((item) => (
            <div key={item.path}>
              <FileRow
                item={item}
                rootPath={folderPath}
                onOpen={handleOpen}
                onTogglePreview={item.is_dir ? undefined : handleTogglePreview}
                previewActive={!item.is_dir && previewPath === item.path}
              />
              {!item.is_dir && previewPath === item.path && (
                <div className="div-preview-panel">
                  <FilePreview filePath={item.path} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <style>{`
        .div-root {
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
        }
        .div-error {
          font-size: 12px;
          color: var(--color-danger);
        }
        .div-toolbar {
          display: flex;
          align-items: center;
          gap: var(--space-2);
        }
        .div-count {
          font-size: 12px;
          color: var(--color-text-muted);
          flex: 1;
        }
        .div-rescan-btn {
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
        .div-rescan-btn:hover {
          background: var(--color-bg-secondary);
          color: var(--color-text-primary);
        }
        .div-tree {
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          overflow: hidden;
        }
        .div-empty {
          font-size: 13px;
          color: var(--color-text-muted);
          text-align: center;
          padding: var(--space-6);
        }
        .div-preview-panel {
          padding: var(--space-3) var(--space-4);
          border-bottom: 1px solid var(--color-border-subtle);
          background: var(--color-bg-secondary);
        }
      `}</style>
    </div>
  );
}

// ─── FileRow sub-component ────────────────────────────────────────────────────

interface FileRowProps {
  item: DisplayItem;
  /** The root folder path — used to compute depth relative to the collection root. */
  rootPath: string;
  onOpen: (path: string) => void;
  onTogglePreview?: (path: string) => void;
  previewActive?: boolean;
}

/** A single row in the file tree. Clickable for files. */
function FileRow({ item, rootPath, onOpen, onTogglePreview, previewActive }: FileRowProps) {
  // Strip the root prefix and count remaining separators to get relative depth.
  // Normalize slashes so Windows backslashes and forward slashes both work.
  const normalRoot = rootPath.replace(/\\/g, "/").replace(/\/$/, "");
  const normalPath = item.path.replace(/\\/g, "/");
  const relative = normalPath.startsWith(normalRoot)
    ? normalPath.slice(normalRoot.length).replace(/^\//, "")
    : normalPath;
  const depth = relative === "" ? 0 : (relative.match(/\//g)?.length ?? 0);
  const indent = depth * 16;

  return (
    <div
      className={`fr ${item.is_dir ? "fr--dir" : "fr--file"}`}
      onClick={item.is_dir ? undefined : () => onOpen(item.path)}
      style={{ paddingLeft: `calc(var(--space-3) + ${indent}px)` }}
      title={item.is_dir ? item.path : `Open ${item.name}`}
    >
      <span className="fr-icon">
        {item.is_dir ? (
          <FolderOpen size={13} color="var(--color-accent)" />
        ) : (
          <File size={13} color="var(--color-text-muted)" />
        )}
      </span>
      <span className="fr-name">{item.name}</span>
      <span className="fr-meta">
        {!item.is_dir && item.size_bytes != null && (
          <span>{formatFileSize(item.size_bytes)}</span>
        )}
        {item.modified_at && (
          <span>{formatDate(item.modified_at)}</span>
        )}
      </span>
      {!item.is_dir && onTogglePreview && (
        <button
          className={`fr-preview-btn ${previewActive ? "fr-preview-btn--active" : ""}`}
          onClick={(e) => { e.stopPropagation(); onTogglePreview(item.path); }}
          title={previewActive ? "Hide preview" : "Preview file"}
        >
          {previewActive ? <EyeOff size={11} /> : <Eye size={11} />}
        </button>
      )}
      {!item.is_dir && (
        <ExternalLink size={11} className="fr-open-icon" />
      )}
      <style>{`
        .fr {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-2) var(--space-3);
          border-bottom: 1px solid var(--color-border-subtle);
          min-height: 36px;
        }
        .fr:last-child {
          border-bottom: none;
        }
        .fr--file {
          cursor: pointer;
          transition: background var(--transition-fast);
        }
        .fr--file:hover {
          background: var(--color-bg-secondary);
        }
        .fr--file:hover .fr-open-icon {
          opacity: 1;
        }
        .fr-icon {
          flex-shrink: 0;
        }
        .fr-name {
          flex: 1;
          font-size: 12px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .fr-meta {
          display: flex;
          gap: var(--space-3);
          font-size: 11px;
          color: var(--color-text-muted);
          flex-shrink: 0;
        }
        .fr-open-icon {
          color: var(--color-text-muted);
          opacity: 0;
          flex-shrink: 0;
          transition: opacity var(--transition-fast);
        }
        .fr-preview-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 2px 4px;
          border-radius: var(--radius-sm);
          color: var(--color-text-muted);
          flex-shrink: 0;
          opacity: 0;
          transition: opacity var(--transition-fast), color var(--transition-fast), background var(--transition-fast);
        }
        .fr-preview-btn--active {
          opacity: 1;
          color: var(--color-accent);
        }
        .fr--file:hover .fr-preview-btn {
          opacity: 1;
        }
        .fr-preview-btn:hover {
          background: var(--color-border);
        }
      `}</style>
    </div>
  );
}
