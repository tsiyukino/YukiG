/**
 * Read-only play-status section shown for game and steam_game items.
 * Status changes happen on the Play page or via the edit modal.
 */
import { Clock } from "lucide-react";
import { GameStatus } from "@/services/tauriCommands";
import styles from "./GameStatusSection.module.css";

function statusLabel(s: string): string {
  return s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

/**
 * Renders the story/online status grid with the snooze date when present.
 */
export default function GameStatusSection({ gameStatus }: { gameStatus: GameStatus }) {
  return (
    <div className={styles.root}>
      <div className={styles.title}>Play Status</div>
      <div className={styles.grid}>
        <div className={styles.cell}>
          <span className={styles.label}>Story</span>
          <span className={styles.value}>{statusLabel(gameStatus.story_status)}</span>
        </div>
        <div className={styles.cell}>
          <span className={styles.label}>Online</span>
          <span className={styles.value}>{statusLabel(gameStatus.online_status)}</span>
        </div>
        {gameStatus.snooze_until && (
          <div className={styles.cell}>
            <span className={styles.label}>Snoozed until</span>
            <span className={styles.value}>
              {new Date(gameStatus.snooze_until).toLocaleDateString()}
            </span>
          </div>
        )}
      </div>
      <p className={styles.hint}>
        <Clock size={11} style={{ display: "inline", verticalAlign: "middle" }} />
        {" "}Change status from the <strong>Play</strong> page (Edit for manual override).
      </p>
    </div>
  );
}
