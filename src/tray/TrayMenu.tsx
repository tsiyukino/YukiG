/**
 * Presentational tray popup menu: recent games, separator, Open / Quit.
 *
 * Styled entirely with design tokens so it matches the app in both themes.
 * The frame carries transparent padding around the panel — room for the
 * CSS shadow inside the transparent window — and is what gets measured
 * for the window size.
 */
import { AppWindow, Gamepad2, Power } from "lucide-react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { TrayRecentGame } from "@/services/tauriCommands";
import { useExeIcon } from "@/hooks/useExeIcon";
import { usePlaySessions } from "@/hooks/usePlaySessions";
import { steamImageSrc } from "@/utils/pathUtils";
import styles from "./TrayMenu.module.css";

interface TrayMenuProps {
  /** Measured by useTrayMenu to size the popup window. */
  frameRef: React.RefObject<HTMLDivElement>;
  /** Recent games, most recently played first. */
  games: TrayRecentGame[];
  /** Called with the item id when a game row is clicked. */
  onLaunch: (itemId: string) => void;
  /** Called when the "Open YukiG" row is clicked. */
  onOpenMain: () => void;
  /** Called when the "Quit" row is clicked. */
  onQuit: () => void;
}

/**
 * The tray menu panel. Pure rendering — lifecycle lives in useTrayMenu.
 */
export default function TrayMenu({ frameRef, games, onLaunch, onOpenMain, onQuit }: TrayMenuProps) {
  const playing = usePlaySessions();
  return (
    <div ref={frameRef} className={styles.frame}>
      <div className={styles.panel}>
        {games.length > 0 ? (
          games.map((game) => (
            <GameRow
              key={game.id}
              game={game}
              onLaunch={onLaunch}
              isPlaying={playing.has(game.id)}
            />
          ))
        ) : (
          <div className={styles.empty}>No recently played games</div>
        )}

        <div className={styles.separator} role="separator" />

        <button type="button" className={styles.row} onClick={onOpenMain}>
          <AppWindow size={15} className={styles.rowIcon} />
          <span className={styles.name}>Open YukiG</span>
        </button>
        <button type="button" className={`${styles.row} ${styles.quit}`} onClick={onQuit}>
          <Power size={15} className={styles.rowIcon} />
          <span className={styles.name}>Quit</span>
        </button>
      </div>
    </div>
  );
}

/**
 * One recent-game row. Icon preference: Steam community icon, then the
 * item thumbnail, then the extracted exe icon, then a gamepad fallback.
 *
 * A running game (`isPlaying`) gets a green-tinted row and a pulsing dot,
 * Steam-style — the green + dot + text together signal the state without
 * relying on color alone.
 */
function GameRow({
  game,
  onLaunch,
  isPlaying,
}: {
  game: TrayRecentGame;
  onLaunch: (itemId: string) => void;
  isPlaying: boolean;
}) {
  const exeIcon = useExeIcon(game.id, game.strategy_type);
  const src =
    (game.icon_url ? steamImageSrc(game.icon_url) : null) ??
    (game.thumbnail_path ? convertFileSrc(game.thumbnail_path) : null) ??
    exeIcon;

  return (
    <button
      type="button"
      className={isPlaying ? `${styles.row} ${styles.rowPlaying}` : styles.row}
      onClick={() => onLaunch(game.id)}
      title={isPlaying ? `${game.name} — playing now` : game.name}
    >
      {src ? (
        <img src={src} alt="" className={styles.gameIcon} />
      ) : (
        <Gamepad2 size={15} className={styles.rowIcon} />
      )}
      <span className={styles.name}>{game.name}</span>
      {isPlaying && <span className={styles.playingDot} aria-label="playing now" />}
    </button>
  );
}
