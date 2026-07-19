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
import { useState, ReactNode } from "react";
import { Play, FolderOpen, RefreshCw, Terminal, Image, Clock, SquareTerminal } from "lucide-react";
import { strategyExecuteLaunchTracked, shellOpenPath, gameLaunchExtraExe } from "@/services/tauriCommands";
import { useStrategy } from "@/hooks/useStrategy";
import { parseExtraExes } from "@/utils/extraExes";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import styles from "./GameItemView.module.css";

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
  const { metadata, loading, error, rescan, refresh } = useStrategy(itemId, folderPath, "game");
  const [launching, setLaunching] = useState(false);
  const [running, setRunning] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const exePath = metadata["exe_path"] ?? "";
  const modFolder = metadata["mod_folder"] ?? "";
  const screenshotFolder = metadata["screenshot_folder"] ?? "";
  const extraExes = parseExtraExes(metadata["extra_exes"]);
  const totalSecs = parseInt(metadata["total_playtime_seconds"] ?? "0", 10) || 0;
  const lastLaunched = parseInt(metadata["last_launched"] ?? "0", 10) || 0;

  async function handleLaunchExtra(path: string) {
    setActionError(null);
    try {
      await gameLaunchExtraExe(path);
    } catch (e) {
      setActionError(String(e));
    }
  }

  async function handleLaunch() {
    setActionError(null);
    setLaunching(true);
    try {
      // Brief "Launching…" state, then switch to "Running…" once the process starts.
      await new Promise((r) => setTimeout(r, 300));
      setLaunching(false);
      setRunning(true);
      await strategyExecuteLaunchTracked(itemId);
      // Refresh metadata to show updated playtime. Must NOT rescan: a rescan
      // re-detects exe_path from the folder and would clobber a user-set exe
      // (e.g. ModOrganizer.exe → helper.exe once MO2 drops its helper on disk).
      refresh();
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
    <div className={styles.giv}>
      {error && <p className={styles.error}>{error}</p>}

      <Row icon={<Terminal size={13} className={styles.rowIcon} />} label="Executable"
        action={
          <button
            className={`${styles.actionBtn} ${styles.primary}`}
            onClick={handleLaunch}
            disabled={!exePath || launching || running}
            title={exePath ? "Launch game" : "No executable set"}
          >
            <Play size={12} />
            {launching ? "Launching…" : running ? "Running…" : "Launch"}
          </button>
        }>
        {exePath
          ? <span className={styles.path}>{exePath}</span>
          : <span className={styles.missing}>Not set</span>}
      </Row>

      {extraExes.map((exe) => (
        <Row
          key={exe.path}
          icon={<SquareTerminal size={13} className={styles.rowIcon} />}
          label={exe.label || "Executable"}
          action={
            <button
              className={styles.actionBtn}
              onClick={() => handleLaunchExtra(exe.path)}
              title={`Launch ${exe.label || "executable"}`}
            >
              <Play size={12} />
              Launch
            </button>
          }
        >
          <span className={styles.path}>{exe.path}</span>
        </Row>
      ))}

      <Row icon={<Clock size={13} className={styles.rowIcon} />} label="Time Played">
        <span className={styles.path}>{fmtSeconds(totalSecs)}</span>
        {lastLaunched > 0 && (
          <span className={styles.lastLaunched}>
            Last played {new Date(lastLaunched * 1000).toLocaleDateString()}
          </span>
        )}
      </Row>

      {modFolder && (
        <Row icon={<FolderOpen size={13} className={styles.rowIcon} />} label="Mod Folder"
          action={<OpenFolderButton onClick={() => handleOpenFolder(modFolder)} />}>
          <span className={styles.path}>{modFolder}</span>
        </Row>
      )}

      {screenshotFolder && (
        <Row icon={<Image size={13} className={styles.rowIcon} />} label="Screenshots Folder"
          action={<OpenFolderButton onClick={() => handleOpenFolder(screenshotFolder)} />}>
          <span className={styles.path}>{screenshotFolder}</span>
        </Row>
      )}

      <div className={styles.footer}>
        <button className={styles.rescanBtn} onClick={rescan} title="Re-scan game folder">
          <RefreshCw size={12} />
          Rescan
        </button>
      </div>

      {actionError && <p className={styles.error}>{actionError}</p>}
    </div>
  );
}

function Row({ icon, label, action, children }: {
  icon: ReactNode; label: string; action?: ReactNode; children: ReactNode;
}) {
  return (
    <div className={styles.row}>
      <div className={styles.rowLeft}>
        {icon}
        <div className={styles.rowContent}>
          <span className={styles.rowLabel}>{label}</span>
          {children}
        </div>
      </div>
      {action}
    </div>
  );
}

function OpenFolderButton({ onClick }: { onClick: () => void }) {
  return (
    <button className={styles.actionBtn} onClick={onClick} title="Open in Explorer">
      <FolderOpen size={12} />
      Open Folder
    </button>
  );
}
