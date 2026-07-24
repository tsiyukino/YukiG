/**
 * Hero banner + below-hero strip for the game detail view: background art,
 * logo overlay, the game name with its icon actions (favourite / edit /
 * delete), the Steam-style play button, playtime widget, and pills.
 * Renaming lives in the Edit modal, not inline here.
 * Styles come from the steam feature stylesheet (sdt-*).
 */
import { useState } from "react";
import { Play, Download, Trophy, Heart, Pencil, Trash2 } from "lucide-react";
import { steamLaunchGame, steamInstallGame } from "@/services/tauriCommands";
import { SteamGame, SteamLibItem } from "@/types/steam";
import { steamImageSrc } from "@/utils/pathUtils";
import { fmtDate, fmtPlaytimeHours } from "@/utils/steamFormatters";
import OsIcon from "../OsIcon";

interface DetailHeroProps {
  /** Scan-side game data (art, playtime, OS flags). */
  game: SteamGame;
  /** The library item backing this game (name, favourite state, id). */
  item: SteamLibItem;
  /** Achievement summary from the achievements section, if loaded. */
  achSummary: { unlocked: number; total: number } | null;
  onFavoriteToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

/**
 * Renders the detail view's hero area.
 */
export default function DetailHero({ game, item, achSummary, onFavoriteToggle, onEdit, onDelete }: DetailHeroProps) {
  // Fades the hero art in once it has decoded, instead of popping.
  const [heroLoaded, setHeroLoaded] = useState(false);
  const playtimeHours = fmtPlaytimeHours(game.playtime_minutes);

  return (
    <>
      <div className="sdt-hero">
        <img
          className={`sdt-hero-img ${heroLoaded ? "sdt-hero-img--loaded" : ""}`}
          src={steamImageSrc(game.library_hero || game.header_image)}
          alt=""
          onLoad={() => setHeroLoaded(true)}
          onError={(e) => {
            const img = e.target as HTMLImageElement;
            if (game.library_hero && img.src === steamImageSrc(game.library_hero)) img.src = steamImageSrc(game.header_image);
          }}
        />
        <div className="sdt-hero-overlay" />
        <div className="sdt-hero-logo-wrap">
          <img
            className="sdt-hero-logo"
            src={steamImageSrc(game.library_logo)}
            alt={item.name}
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        </div>
      </div>

      <div className="sdt-hero-below">
        <div className="sdt-hero-name-row">
          <h1 className="sdt-hero-name">{item.name}</h1>
          <div className="sdt-name-actions">
            <button
              className={`sdt-icon-action ${item.is_favorite ? "sdt-icon-action--fav-on" : ""}`}
              onClick={onFavoriteToggle}
              title={item.is_favorite ? "Remove from favorites" : "Add to favorites"}
            >
              <Heart size={14} />
            </button>
            <button className="sdt-icon-action" onClick={onEdit} title="Edit">
              <Pencil size={14} />
            </button>
            <button className="sdt-icon-action sdt-icon-action--danger" onClick={onDelete} title="Delete from library">
              <Trash2 size={14} />
            </button>
          </div>
        </div>
        {game.developer && (
          <div className="sdt-hero-meta">
            <span className="sdt-hero-dev">{game.developer}</span>
          </div>
        )}
        <div className="sdt-hero-action-row">
          <button
            className={game.is_installed ? "sdt-play-btn" : "sdt-install-btn"}
            onClick={() => {
              if (game.is_installed) steamLaunchGame(game.app_id).catch(() => {});
              else steamInstallGame(game.app_id).catch(() => {});
            }}
          >
            {game.is_installed ? <Play size={16} fill="currentColor" /> : <Download size={16} />}
            {game.is_installed ? "Play" : "Install"}
          </button>
          <div className="sdt-playtime-widget">
            <span className="sdt-playtime-val">{playtimeHours ?? "No playtime"}</span>
            {game.last_played > 0 && (
              <span className="sdt-playtime-sub">Last played {fmtDate(game.last_played)}</span>
            )}
          </div>
          {achSummary && achSummary.total > 0 && (
            <span className="sdt-playtime-pill"><Trophy size={10} />{achSummary.unlocked}/{achSummary.total}</span>
          )}
          {game.os_list > 0 && (
            <span className="sdt-os-pill">
              {(game.os_list & 1) !== 0 && <OsIcon os="windows" />}
              {(game.os_list & 2) !== 0 && <OsIcon os="macos" />}
              {(game.os_list & 4) !== 0 && <OsIcon os="linux" />}
            </span>
          )}
        </div>
      </div>
    </>
  );
}
