/**
 * Strategy detail view for a disk-backed `folder` item.
 *
 * Shows the folder's disk path, import filter, child count, and a
 * "Sync with disk" button that adds new files and removes deleted ones.
 *
 * @param itemId - The item UUID
 * @param folderPath - Absolute path to the folder
 */
import { useState, useEffect } from "react";
import { FolderOpen, RefreshCw, ExternalLink, Check } from "lucide-react";
import {
  shellOpenPath,
  strategyGetMetadata,
  itemGetByParent,
  folderSync,
  FolderSyncResult,
} from "@/services/tauriCommands";

interface FolderItemViewProps {
  /** The item UUID. */
  itemId: string;
  /** Absolute path to the folder. */
  folderPath: string;
}

/** Detail page content for a disk-backed `folder` strategy item. */
export default function FolderItemView({ itemId, folderPath }: FolderItemViewProps) {
  const [filter, setFilter] = useState<string>("all");
  const [childCount, setChildCount] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<FolderSyncResult | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);

  useEffect(() => {
    strategyGetMetadata(itemId)
      .then((meta) => {
        setFilter(meta["filter"] ?? "all");
      })
      .catch(() => {});

    itemGetByParent(itemId)
      .then((children) => setChildCount(children.length))
      .catch(() => setChildCount(0));
  }, [itemId]);

  async function handleSync() {
    setSyncing(true);
    setSyncResult(null);
    setSyncError(null);
    try {
      const result = await folderSync(itemId, filter);
      setSyncResult(result);
      // Refresh child count after sync.
      const children = await itemGetByParent(itemId);
      setChildCount(children.length);
    } catch (e) {
      setSyncError(String(e));
    } finally {
      setSyncing(false);
    }
  }

  async function handleOpen() {
    setOpenError(null);
    try {
      await shellOpenPath(folderPath);
    } catch (e) {
      setOpenError(String(e));
    }
  }

  const filterLabel = filter === "all" ? "All files" : capitalize(filter) + "s";

  return (
    <div className="fov-root">
      {(syncError || openError) && (
        <p className="fov-error">{syncError || openError}</p>
      )}

      {/* Disk path row */}
      <div className="fov-card">
        <div className="fov-card-icon">
          <FolderOpen size={18} color="var(--color-accent)" />
        </div>
        <div className="fov-card-info">
          <span className="fov-card-label">Disk path</span>
          <span className="fov-card-value fov-path">{folderPath}</span>
        </div>
        <button className="fov-open-btn" onClick={handleOpen} title="Open folder in Explorer">
          <ExternalLink size={13} />
          Open
        </button>
      </div>

      {/* Stats row */}
      <div className="fov-stats">
        <div className="fov-stat">
          <span className="fov-stat-label">Filter</span>
          <span className="fov-stat-value">{filterLabel}</span>
        </div>
        <div className="fov-stat">
          <span className="fov-stat-label">Items</span>
          <span className="fov-stat-value">{childCount ?? "…"}</span>
        </div>
      </div>

      {/* Sync section */}
      <div className="fov-sync-section">
        <div className="fov-sync-header">
          <span className="fov-sync-title">Sync with disk</span>
          <span className="fov-sync-hint">
            Adds new files found on disk and removes items that no longer exist.
          </span>
        </div>

        {syncResult && (
          <div className="fov-sync-result">
            <Check size={13} />
            <span>Done — {syncResult.added} added, {syncResult.removed} removed</span>
          </div>
        )}

        <button
          className={`fov-sync-btn${syncing ? " fov-sync-btn--loading" : ""}`}
          onClick={handleSync}
          disabled={syncing}
        >
          <RefreshCw size={13} className={syncing ? "fov-spin" : ""} />
          {syncing ? "Syncing…" : "Sync now"}
        </button>
      </div>

      <style>{`
        .fov-root {
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
        }
        .fov-error {
          font-size: 12px;
          color: var(--color-danger);
        }
        .fov-card {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          padding: var(--space-3) var(--space-4);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          background: var(--color-bg-secondary);
        }
        .fov-card-icon {
          flex-shrink: 0;
          width: 34px; height: 34px;
          display: flex; align-items: center; justify-content: center;
          background: var(--color-accent-light);
          border-radius: var(--radius-sm);
        }
        .fov-card-info {
          flex: 1; min-width: 0;
          display: flex; flex-direction: column; gap: 2px;
        }
        .fov-card-label {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--color-text-muted);
          font-weight: 600;
        }
        .fov-card-value {
          font-size: 12.5px;
          color: var(--color-text-primary);
        }
        .fov-path {
          font-family: var(--font-mono);
          word-break: break-all;
        }
        .fov-open-btn {
          display: inline-flex; align-items: center; gap: var(--space-1);
          padding: var(--space-1) var(--space-3);
          font-size: 12px; font-weight: 500;
          color: var(--color-accent);
          border: 1px solid var(--color-accent);
          border-radius: var(--radius-sm);
          flex-shrink: 0;
          transition: background var(--transition-fast), color var(--transition-fast);
        }
        .fov-open-btn:hover { background: var(--color-accent); color: #fff; }
        .fov-stats {
          display: flex; gap: var(--space-4);
        }
        .fov-stat {
          display: flex; flex-direction: column; gap: 3px;
          padding: var(--space-3) var(--space-4);
          background: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          flex: 1;
        }
        .fov-stat-label {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--color-text-muted);
          font-weight: 600;
        }
        .fov-stat-value {
          font-size: 15px;
          font-weight: 600;
          color: var(--color-text-primary);
        }
        .fov-sync-section {
          display: flex; flex-direction: column; gap: var(--space-3);
          padding: var(--space-4);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          background: var(--color-bg-secondary);
        }
        .fov-sync-header {
          display: flex; flex-direction: column; gap: 3px;
        }
        .fov-sync-title {
          font-size: 13px; font-weight: 600; color: var(--color-text-primary);
        }
        .fov-sync-hint {
          font-size: 12px; color: var(--color-text-muted);
        }
        .fov-sync-result {
          display: flex; align-items: center; gap: var(--space-2);
          font-size: 12px; color: var(--color-success, #16a34a);
          padding: var(--space-2) var(--space-3);
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          border-radius: var(--radius-sm);
        }
        .fov-sync-btn {
          display: inline-flex; align-items: center; gap: var(--space-2);
          padding: var(--space-2) var(--space-4);
          font-size: 13px; font-weight: 500;
          background: var(--color-accent); color: #fff;
          border-radius: var(--radius-sm);
          align-self: flex-start;
          transition: background var(--transition-fast), opacity var(--transition-fast);
        }
        .fov-sync-btn:hover:not(:disabled) { background: var(--color-accent-hover); }
        .fov-sync-btn--loading { opacity: 0.7; cursor: not-allowed; }
        @keyframes fov-spin { to { transform: rotate(360deg); } }
        .fov-spin { animation: fov-spin 0.8s linear infinite; }
      `}</style>
    </div>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
