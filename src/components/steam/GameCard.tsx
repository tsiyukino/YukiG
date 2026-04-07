/**
 * Game card for the grid view in the Steam library tab.
 */
import React from "react";
import { HardDrive, Heart } from "lucide-react";
import { SteamGame } from "@/types/steam";
import { steamImageSrc } from "@/utils/pathUtils";
import { fmtBytes } from "@/utils/steamFormatters";

interface GameCardProps {
  /** The Steam game to display. */
  game: SteamGame;
  /** Whether this card is currently selected (opens the drawer). */
  isSelected: boolean;
  /** Whether this game is in the user's favorites. */
  isFavorite: boolean;
  /** When true, loads the cover image eagerly (use for first ~20 cards). */
  eager?: boolean;
  /** Called when the card is clicked. */
  onOpen: (e: React.MouseEvent) => void;
}

/**
 * Grid-view card showing a game's cover art, name, size, and favorite status.
 * Dimmed when the game is not installed.
 */
export default function GameCard({ game, isSelected, isFavorite, eager, onOpen }: GameCardProps) {
  return (
    <button
      className={`sp-card ${!game.is_installed ? "sp-card--uninstalled" : ""} ${isSelected ? "sp-card--selected" : ""}`}
      onClick={onOpen}
    >
      <div className="sp-card-art-wrap">
        <img
          className="sp-card-art"
          src={steamImageSrc(game.header_image)}
          alt={game.name}
          loading={eager ? "eager" : "lazy"}
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
        {!game.is_installed && (
          <span className="sp-card-badge">Not installed</span>
        )}
        {isFavorite && (
          <span className="sp-card-fav" title="Favorite">
            <Heart size={9} fill="currentColor" />
          </span>
        )}
      </div>
      <div className="sp-card-info">
        <span className="sp-card-name">{game.name}</span>
        {game.is_installed && game.size_on_disk > 0 && (
          <span className="sp-card-size">
            <HardDrive size={9} />
            {fmtBytes(game.size_on_disk)}
          </span>
        )}
      </div>
    </button>
  );
}
