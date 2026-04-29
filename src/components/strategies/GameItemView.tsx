/**
 * Strategy-specific view component for game items.
 *
 * Displays the executable, mod folder, and screenshot folder paths.
 * Each path row has its own contextual action button:
 *   - Executable → Launch
 *   - Mod Folder → Open Folder
 *   - Screenshots Folder → Open Folder
 *
 * @param itemId - The item UUID
 * @param folderPath - Absolute path to the game folder
 */
import { useState } from "react";
import { Play, FolderOpen, RefreshCw, Terminal, Image, Clock } from "lucide-react";
import { strategyExecuteLaunchTracked, shellOpenPath } from "@/services/tauriCommands";
import { useStrategy } from "@/hooks/useStrategy";
import LoadingSpinner from "@/components/common/LoadingSpinner";

function fmtSeconds(secs: number): string {
  if (secs === 0) return "Never played";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  if (m > 0) return s > 0 ? `${m}m ${s}s` : `${m}m`;
  return `${s}s`;
}

interface GameItemViewProps {
  itemId: string;
  folderPath: string;
}

/** Renders game-specific details with per-path action buttons. */
export default function GameItemView({ itemId, folderPath }: GameItemViewProps) {
  const { metadata, loading, error, rescan } = useStrategy(itemId, folderPath, "game");
  const [launching, setLaunching] = useState(false);
  const [running, setRunning] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const exePath = metadata["exe_path"] ?? "";
  const modFolder = metadata["mod_folder"] ?? "";
  const screenshotFolder = metadata["screenshot_folder"] ?? "";
  const totalSecs = parseInt(metadata["total_playtime_seconds"] ?? "0", 10) || 0;
  const lastLaunched = parseInt(metadata["last_launched"] ?? "0", 10) || 0;

  async function handleLaunch() {
    setActionError(null);
    setLaunching(true);
    try {
      // Brief "Launching…" state, then switch to "Running…" once the process starts.
      await new Promise((r) => setTimeout(r, 300));
      setLaunching(false);
      setRunning(true);
      await strategyExecuteLaunchTracked(itemId, folderPath, "game");
      // Refresh metadata so updated playtime shows without a manual rescan.
      rescan();
    } catch (e) {
      setActionError(String(e));
    } finally {
      setLaunching(false);
      setRunning(false);
    }
  }

  async function handleOpenFolder(path: string) {
    setActionError(null);
    try {
      await shellOpenPath(path);
    } catch (e) {
      setActionError(String(e));
    }
  }

  if (loading) return <LoadingSpinner message="Loading game info…" />;

  return (
    <div className="giv">
      {error && <p className="giv-error">{error}</p>}

      {/* Executable */}
      <div className="giv-row">
        <div className="giv-row-left">
          <Terminal size={13} className="giv-row-icon" />
          <div className="giv-row-content">
            <span className="giv-row-label">Executable</span>
            {exePath
              ? <span className="giv-path">{exePath}</span>
              : <span className="giv-missing">Not set</span>
            }
          </div>
        </div>
        <button
          className="giv-action-btn giv-action-btn--primary"
          onClick={handleLaunch}
          disabled={!exePath || launching || running}
          title={exePath ? "Launch game" : "No executable set"}
        >
          <Play size={12} />
          {launching ? "Launching…" : running ? "Running…" : "Launch"}
        </button>
      </div>

      {/* Playtime */}
      <div className="giv-row">
        <div className="giv-row-left">
          <Clock size={13} className="giv-row-icon" />
          <div className="giv-row-content">
            <span className="giv-row-label">Time Played</span>
            <span className="giv-path">{fmtSeconds(totalSecs)}</span>
            {lastLaunched > 0 && (
              <span className="giv-last-launched">
                Last played {new Date(lastLaunched * 1000).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Mod folder */}
      {modFolder && (
        <div className="giv-row">
          <div className="giv-row-left">
            <FolderOpen size={13} className="giv-row-icon" />
            <div className="giv-row-content">
              <span className="giv-row-label">Mod Folder</span>
              <span className="giv-path">{modFolder}</span>
            </div>
          </div>
          <button
            className="giv-action-btn"
            onClick={() => handleOpenFolder(modFolder)}
            title="Open in Explorer"
          >
            <FolderOpen size={12} />
            Open Folder
          </button>
        </div>
      )}

      {/* Screenshots folder */}
      {screenshotFolder && (
        <div className="giv-row">
          <div className="giv-row-left">
            <Image size={13} className="giv-row-icon" />
            <div className="giv-row-content">
              <span className="giv-row-label">Screenshots Folder</span>
              <span className="giv-path">{screenshotFolder}</span>
            </div>
          </div>
          <button
            className="giv-action-btn"
            onClick={() => handleOpenFolder(screenshotFolder)}
            title="Open in Explorer"
          >
            <FolderOpen size={12} />
            Open Folder
          </button>
        </div>
      )}

      {/* Rescan */}
      <div className="giv-footer">
        <button className="giv-rescan-btn" onClick={rescan} title="Re-scan game folder">
          <RefreshCw size={12} />
          Rescan
        </button>
      </div>

      {actionError && <p className="giv-error">{actionError}</p>}

      <style>{`
        .giv {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }
        .giv-error {
          font-size: 12px;
          color: var(--color-danger);
        }
        .giv-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--space-3);
          padding: var(--space-3);
          background: var(--color-bg-secondary);
          border-radius: var(--radius-sm);
          border: 1px solid var(--color-border-subtle);
        }
        .giv-row-left {
          display: flex;
          align-items: flex-start;
          gap: var(--space-2);
          min-width: 0;
          flex: 1;
        }
        .giv-row-icon {
          color: var(--color-text-muted);
          flex-shrink: 0;
          margin-top: 2px;
        }
        .giv-row-content {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }
        .giv-row-label {
          font-size: 10px;
          font-weight: 600;
          color: var(--color-text-muted);
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .giv-path {
          font-size: 11.5px;
          font-family: var(--font-mono);
          color: var(--color-text-primary);
          word-break: break-all;
        }
        .giv-missing {
          font-size: 12px;
          color: var(--color-text-muted);
          font-style: italic;
        }
        .giv-last-launched {
          font-size: 10.5px;
          color: var(--color-text-muted);
        }
        .giv-action-btn {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 5px 10px;
          color: var(--color-text-secondary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          font-size: 11.5px;
          font-weight: 500;
          white-space: nowrap;
          flex-shrink: 0;
          background: var(--color-bg);
          transition: background var(--transition-fast), color var(--transition-fast);
        }
        .giv-action-btn:hover:not(:disabled) {
          background: var(--color-bg-tertiary);
          color: var(--color-text-primary);
        }
        .giv-action-btn--primary {
          background: linear-gradient(160deg, #818cf8 0%, #6366f1 55%, #4f46e5 100%);
          color: #fff;
          border-color: rgba(129,140,248,.35);
          box-shadow: 0 1px 6px rgba(99,102,241,.35), inset 0 1px 0 rgba(255,255,255,.15);
          transition: background .15s, box-shadow .18s, transform .12s, border-color .15s, opacity .15s;
        }
        .giv-action-btn--primary:hover:not(:disabled) {
          background: linear-gradient(160deg, #a5b4fc 0%, #818cf8 50%, #6366f1 100%);
          border-color: rgba(165,180,252,.45);
          box-shadow: 0 0 0 3px rgba(99,102,241,.18), 0 3px 10px rgba(99,102,241,.45), inset 0 1px 0 rgba(255,255,255,.2);
          transform: translateY(-1px);
          color: #fff;
        }
        .giv-action-btn--primary:active:not(:disabled) {
          transform: translateY(0);
          box-shadow: 0 1px 4px rgba(99,102,241,.3), inset 0 1px 0 rgba(255,255,255,.1);
        }
        .giv-action-btn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }
        .giv-footer {
          display: flex;
          justify-content: flex-end;
          padding-top: var(--space-1);
        }
        .giv-rescan-btn {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 4px 10px;
          color: var(--color-text-muted);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          font-size: 11px;
          background: transparent;
          transition: background var(--transition-fast), color var(--transition-fast);
        }
        .giv-rescan-btn:hover {
          background: var(--color-bg-secondary);
          color: var(--color-text-primary);
        }
      `}</style>
    </div>
  );
}
