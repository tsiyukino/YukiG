/**
 * Slide-in detail drawer shown when a game is selected in the library.
 *
 * Shows the game's cover art, play/install/favorite actions, store links,
 * a "See Details" button, and key metadata rows.
 */
import { useRef } from "react";
import {
  X, Play, HardDrive, Clock, Gamepad2, FolderOpen,
  Library, Monitor, Store, Download, Heart,
} from "lucide-react";
import { steamOpenInApp, steamOpenInStore } from "@/services/tauriCommands";
import { SteamGame } from "@/types/steam";
import { steamImageSrc } from "@/utils/pathUtils";
import { fmtBytes, fmtDate } from "@/utils/steamFormatters";
import DetailRow from "./DetailRow";

interface DetailDrawerProps {
  /** The game to display in the drawer. */
  game: SteamGame;
  /** Called when the close button is clicked. */
  onClose: () => void;
  /** Called when the Play button is clicked. */
  onLaunch: () => void;
  /** Called when the Install button is clicked. */
  onInstall: () => void;
  /** Called when the "See Details" button is clicked. */
  onDetail: () => void;
  /** Whether a launch is in progress (disables the Play button). */
  launching: boolean;
  /** Whether this game is in the user's favorites. */
  isFavorite: boolean;
  /** Called when the favorite toggle button is clicked. */
  onToggleFavorite: () => void;
}

/**
 * Detail drawer panel that slides in from the right when a game is selected.
 * Displays hero art, action buttons, and key game metadata.
 */
export default function DetailDrawer({ game, onClose, onLaunch, onInstall, onDetail, launching, isFavorite, onToggleFavorite }: DetailDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);

  return (
    <aside className="sp-drawer" ref={drawerRef}>
      {/* Hero image */}
      <div className="sp-drawer-hero">
        <img
          className="sp-drawer-hero-img"
          src={steamImageSrc(game.library_image || game.header_image)}
          alt={game.name}
          onError={(e) => {
            const img = e.target as HTMLImageElement;
            if (img.src !== steamImageSrc(game.header_image)) img.src = steamImageSrc(game.header_image);
          }}
        />
        <div className="sp-drawer-hero-overlay" />
        <button className="sp-drawer-close" onClick={onClose}>
          <X size={13} />
        </button>
        <div className="sp-drawer-hero-title">
          <h2 className="sp-drawer-name">{game.name}</h2>
        </div>
      </div>

      {/* Body */}
      <div className="sp-drawer-body">
        {/* Play/Install + Favorite on same row */}
        <div className="sp-drawer-primary-row">
          {game.is_installed ? (
            <button
              className="sp-launch-btn"
              onClick={onLaunch}
              disabled={launching}
            >
              <Play size={13} />
              {launching ? "Launching…" : "Play"}
            </button>
          ) : (
            <button
              className="sp-install-btn"
              onClick={onInstall}
            >
              <Download size={13} />
              Install
            </button>
          )}
          <button
            className={`sp-fav-btn ${isFavorite ? "sp-fav-btn--active" : ""}`}
            onClick={onToggleFavorite}
            title={isFavorite ? "Remove from favorites" : "Add to favorites"}
          >
            <Heart size={14} />
          </button>
        </div>

        {/* Store row — Open in Steam app + Open in web store */}
        <div className="sp-drawer-store-row">
          <button
            className="sp-store-btn sp-store-btn--half"
            onClick={() => steamOpenInApp(game.app_id).catch(() => {})}
            title="Open in Steam desktop app"
          >
            <Monitor size={12} />
            Open in Steam
          </button>
          <button
            className="sp-store-btn sp-store-btn--half"
            onClick={() => steamOpenInStore(game.app_id).catch(() => {})}
            title="Open in Steam web store"
          >
            <Store size={12} />
            Open in Store
          </button>
        </div>

        {/* See Details */}
        <button className="sp-detail-link-btn" onClick={onDetail}>
          <Gamepad2 size={12} />
          See Details
        </button>

        {/* Details */}
        <div className="sp-drawer-details">
          {game.is_installed && game.install_path && (
            <DetailRow
              icon={<FolderOpen size={12} />}
              label="Location"
              value={game.install_path}
              mono
            />
          )}
          {game.size_on_disk > 0 && (
            <DetailRow
              icon={<HardDrive size={12} />}
              label="Size on disk"
              value={fmtBytes(game.size_on_disk)}
            />
          )}
          {game.last_played > 0 && (
            <DetailRow
              icon={<Clock size={12} />}
              label="Last played"
              value={fmtDate(game.last_played)}
            />
          )}
          <DetailRow
            icon={<Gamepad2 size={12} />}
            label="App ID"
            value={`#${game.app_id}`}
            mono
          />
          {game.collections.length > 0 && (
            <DetailRow
              icon={<Library size={12} />}
              label="Collections"
              value={game.collections.join(", ")}
            />
          )}
        </div>
      </div>
    </aside>
  );
}
