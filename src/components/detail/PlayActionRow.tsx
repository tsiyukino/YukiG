/**
 * Steam-style play row for a local game's detail page: a large Play button
 * (tracked launch) next to a playtime widget. Mirrors the Steam detail
 * hero's action row so both platforms read the same.
 */
import { useState } from "react";
import { Play } from "lucide-react";
import { strategyExecuteLaunchTracked } from "@/services/tauriCommands";
import { formatPlaySeconds } from "@/utils/formatDuration";
import styles from "./PlayActionRow.module.css";

interface PlayActionRowProps {
  itemId: string;
  /** Configured executable path; empty disables the button. */
  exePath: string;
  /** Total tracked playtime in seconds. */
  totalSeconds: number;
  /** Unix timestamp of the last launch, 0 if never. */
  lastLaunched: number;
  /** Re-reads metadata after the session ends (playtime update). */
  onSessionEnd: () => void;
  onError: (msg: string) => void;
}

/**
 * Renders the play button and playtime widget.
 */
export default function PlayActionRow({
  itemId, exePath, totalSeconds, lastLaunched, onSessionEnd, onError,
}: PlayActionRowProps) {
  const [launching, setLaunching] = useState(false);
  const [running, setRunning] = useState(false);

  async function handleLaunch() {
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
      onSessionEnd();
    } catch (e) {
      onError(String(e));
    } finally {
      setLaunching(false);
      setRunning(false);
    }
  }

  return (
    <div className={styles.row}>
      <button
        className={styles.playBtn}
        onClick={handleLaunch}
        disabled={!exePath || launching || running}
        title={exePath ? "Launch game" : "No executable set"}
      >
        <Play size={16} fill="currentColor" />
        {launching ? "Launching…" : running ? "Running…" : "Play"}
      </button>
      <div className={styles.playtime}>
        <span className={styles.playtimeVal}>{formatPlaySeconds(totalSeconds)}</span>
        {lastLaunched > 0 && (
          <span className={styles.playtimeSub}>
            Last played {new Date(lastLaunched * 1000).toLocaleDateString()}
          </span>
        )}
      </div>
    </div>
  );
}
