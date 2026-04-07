/**
 * Strategy view for a single `file` item.
 *
 * Displays the file path, detected category, size, and a button to open the
 * file with the system default application.
 *
 * @param itemId - The item UUID
 * @param filePath - Absolute path to the file (stored in folder_path column)
 */
import { useState } from "react";
import {
  Image, FileText, Archive, Film, Music, Table, Presentation,
  BookOpen, Type, Database, File, ExternalLink,
} from "lucide-react";
import { shellOpenPath, strategyGetMetadata } from "@/services/tauriCommands";
import { formatFileSize } from "@/utils/formatFileSize";
import { formatDate } from "@/utils/formatDate";
import { FileCategory } from "@/types/strategy";
import { useEffect } from "react";

interface FileItemViewProps {
  /** The item UUID. */
  itemId: string;
  /** Absolute path to the file. */
  filePath: string;
}

/** Returns the appropriate Lucide icon for a file category. */
function CategoryIcon({ category }: { category: FileCategory }) {
  const props = { size: 20 };
  switch (category) {
    case "image":       return <Image {...props} color="#10b981" />;
    case "pdf":         return <FileText {...props} color="#ef4444" />;
    case "document":    return <FileText {...props} color="#3b82f6" />;
    case "spreadsheet": return <Table {...props} color="#22c55e" />;
    case "presentation":return <Presentation {...props} color="#f97316" />;
    case "archive":     return <Archive {...props} color="#a855f7" />;
    case "text":        return <FileText {...props} color="var(--color-text-muted)" />;
    case "markdown":    return <FileText {...props} color="#6366f1" />;
    case "audio":       return <Music {...props} color="#ec4899" />;
    case "video":       return <Film {...props} color="#06b6d4" />;
    case "ebook":       return <BookOpen {...props} color="#f59e0b" />;
    case "font":        return <Type {...props} color="#8b5cf6" />;
    case "data":        return <Database {...props} color="#64748b" />;
    default:            return <File {...props} color="var(--color-text-muted)" />;
  }
}

/** Renders basic file info and an open button for a `file` strategy item. */
export default function FileItemView({ itemId, filePath }: FileItemViewProps) {
  const [meta, setMeta] = useState<Record<string, string>>({});
  const [openError, setOpenError] = useState<string | null>(null);

  useEffect(() => {
    strategyGetMetadata(itemId)
      .then(setMeta)
      .catch(() => setMeta({}));
  }, [itemId]);

  async function handleOpen() {
    setOpenError(null);
    try {
      await shellOpenPath(filePath);
    } catch (e) {
      setOpenError(String(e));
    }
  }

  const category = (meta.category ?? "unknown") as FileCategory;
  const sizeBytes = meta.size_bytes ? parseInt(meta.size_bytes, 10) : null;
  const modifiedAt = meta.modified_at ?? null;

  return (
    <div className="fiv-root">
      {openError && <p className="fiv-error">{openError}</p>}

      <div className="fiv-card">
        <div className="fiv-icon">
          <CategoryIcon category={category} />
        </div>
        <div className="fiv-info">
          <span className="fiv-path">{filePath}</span>
          <div className="fiv-row">
            {sizeBytes !== null && (
              <span className="fiv-meta">{formatFileSize(sizeBytes)}</span>
            )}
            {modifiedAt && (
              <span className="fiv-meta">{formatDate(modifiedAt)}</span>
            )}
          </div>
        </div>
        <button className="fiv-open-btn" onClick={handleOpen} title="Open file">
          <ExternalLink size={14} />
          Open
        </button>
      </div>

      <style>{`
        .fiv-root {
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
        }
        .fiv-error {
          font-size: 12px;
          color: var(--color-danger);
        }
        .fiv-card {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          padding: var(--space-3) var(--space-4);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          background: var(--color-bg-secondary);
        }
        .fiv-icon {
          flex-shrink: 0;
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .fiv-info {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: var(--space-1);
        }
        .fiv-path {
          font-size: 12px;
          font-family: var(--font-mono);
          color: var(--color-text-primary);
          word-break: break-all;
        }
        .fiv-row {
          display: flex;
          align-items: center;
          gap: var(--space-2);
        }
        .fiv-badge {
          font-size: 10px;
          padding: 1px 6px;
          border-radius: 99px;
          background: var(--color-bg-tertiary);
          color: var(--color-text-muted);
          border: 1px solid var(--color-border);
          text-transform: capitalize;
        }
        .fiv-meta {
          font-size: 11px;
          color: var(--color-text-muted);
        }
        .fiv-open-btn {
          display: inline-flex;
          align-items: center;
          gap: var(--space-1);
          padding: var(--space-1) var(--space-3);
          font-size: 12px;
          font-weight: 500;
          color: var(--color-accent);
          border: 1px solid var(--color-accent);
          border-radius: var(--radius-sm);
          flex-shrink: 0;
          transition: background var(--transition-fast), color var(--transition-fast);
        }
        .fiv-open-btn:hover {
          background: var(--color-accent);
          color: #fff;
        }
      `}</style>
    </div>
  );
}
