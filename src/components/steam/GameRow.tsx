/**
 * Game row for the list view in the Steam library tab.
 */
import React from "react";
import { HardDrive, Heart, Gamepad2 } from "lucide-react";
import { SteamGame } from "@/types/steam";
import { fmtBytes } from "@/utils/steamFormatters";

interface GameRowProps {
  /** The Steam game to display. */
  game: SteamGame;
  /** Whether this row is currently selected (opens the drawer). */
  isSelected: boolean;
  /** Whether this game is in the user's favorites. */
  isFavorite: boolean;
  /** Whether this game is currently running (from Steam or from YukiG). */
  isPlaying?: boolean;
  /** When true, loads the icon image eagerly (use for first ~30 rows). */
  eager?: boolean;
  /** Called when the row is clicked. */
  onOpen: (e: React.MouseEvent) => void;
}

/**
 * List-view row showing a game's icon, name, install status, and size.
 * Falls back to a Gamepad2 icon when no game icon URL is available.
 * Gets a green tint and pulsing dot while running.
 */
export default function GameRow({ game, isSelected, isFavorite, isPlaying, eager, onOpen }: GameRowProps) {
  return (
    <button
      className={`sp-row ${!game.is_installed ? "sp-row--uninstalled" : ""} ${isSelected ? "sp-row--selected" : ""} ${isPlaying ? "sp-row--playing" : ""}`}
      onClick={onOpen}
    >
      <div className="sp-row-icon-wrap">
        {game.icon_url ? (
          <img
            className="sp-row-icon"
            src={game.icon_url}
            alt=""
            loading={eager ? "eager" : "lazy"}
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <Gamepad2 size={14} className="sp-row-icon-fallback" />
        )}
      </div>
      <span className="sp-row-name">
        {isPlaying && <span className="sp-row-playing-dot" aria-label="playing now" />}
        {game.name}
      </span>
      {isFavorite && <Heart size={11} className="sp-row-fav" fill="currentColor" />}
      <div className="sp-row-right">
        {game.is_installed && game.size_on_disk > 0 && (
          <span className="sp-row-size">
            <HardDrive size={10} />
            {fmtBytes(game.size_on_disk)}
          </span>
        )}
        <span className={`sp-row-status ${game.is_installed ? "sp-row-status--on" : "sp-row-status--off"}`}>
          {game.is_installed ? "Installed" : "Not installed"}
        </span>
      </div>
    </button>
  );
}
