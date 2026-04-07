/**
 * Strategy view for Steam-imported games.
 *
 * Shows: CDN artwork, install status, size on disk, launch button,
 * install path, and a link to the Steam store page.
 *
 * @param itemId - The YukiG item UUID
 * @param folderPath - Install directory (may be empty if not installed)
 */
import { useState, useEffect } from "react";
import { Play, Download, HardDrive, FolderOpen, Monitor, Store, Heart } from "lucide-react";
import { strategyGetMetadata, shellOpenPath, steamLaunchGame, steamInstallGame, steamOpenInApp, steamOpenInStore, itemSetFavorite, gameStatusGet, GameStatus } from "@/services/tauriCommands";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import { steamImageSrc } from "@/utils/pathUtils";

interface SteamGameItemViewProps {
  itemId: string;
  folderPath: string;
  isFavorite?: boolean;
  onFavoriteChanged?: (isFavorite: boolean) => void;
}

interface SteamMeta {
  steam_app_id: string;
  steam_launch_url: string;
  is_installed: string;
  install_path: string;
  icon_url: string;
  header_image: string;
  library_image: string;
  library_hero: string;
  library_logo: string;
  size_on_disk: string;
}

/** Renders Steam-specific game details with artwork and launch controls. */
export default function SteamGameItemView({ itemId, folderPath, isFavorite = false, onFavoriteChanged }: SteamGameItemViewProps) {
  const [meta, setMeta] = useState<Partial<SteamMeta>>({});
  const [loading, setLoading] = useState(true);
  const [launching, setLaunching] = useState(false);
  const [favoriteState, setFavoriteState] = useState(isFavorite);
  const [actionError, setActionError] = useState<string | null>(null);
  const [gameStatus, setGameStatus] = useState<GameStatus | null>(null);

  useEffect(() => { setFavoriteState(isFavorite); }, [isFavorite]);

  useEffect(() => {
    strategyGetMetadata(itemId)
      .then((m) => setMeta(m as Partial<SteamMeta>))
      .catch(() => {})
      .finally(() => setLoading(false));
    gameStatusGet(itemId).then(setGameStatus).catch(() => {});
  }, [itemId]);

  async function handleLaunch() {
    const appId = Number(meta.steam_app_id);
    if (!appId) return;
    setActionError(null);
    setLaunching(true);
    try {
      await steamLaunchGame(appId);
    } catch (e) {
      setActionError(String(e));
    } finally {
      setLaunching(false);
    }
  }

  async function handleInstall() {
    const appId = Number(meta.steam_app_id);
    if (!appId) return;
    try {
      await steamInstallGame(appId);
    } catch (e) {
      setActionError(String(e));
    }
  }

  async function handleOpenFolder() {
    const path = meta.install_path || folderPath;
    if (!path) return;
    try { await shellOpenPath(path); }
    catch (e) { setActionError(String(e)); }
  }

  async function handleToggleFavorite() {
    const newVal = !favoriteState;
    try {
      await itemSetFavorite(itemId, newVal);
      setFavoriteState(newVal);
      onFavoriteChanged?.(newVal);
    } catch (e) { setActionError(String(e)); }
  }

  if (loading) return <LoadingSpinner message="Loading Steam info…" />;

  const appId = meta.steam_app_id ?? "";
  const isInstalled = meta.is_installed === "true";
  const sizeBytes = Number(meta.size_on_disk ?? 0);

  return (
    <div className="sgv">
      {/* Artwork */}
      {meta.header_image && (
        <img
          className="sgv-art"
          src={steamImageSrc(meta.header_image)}
          alt="Game artwork"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
      )}

      {/* App ID + play status row */}
      {(appId || gameStatus) && (
        <div className="sgv-status-row">
          {appId && <span className="sgv-appid">App #{appId}</span>}
          {gameStatus && (
            <span className="sgv-play-status">
              {gameStatus.story_status.replace(/_/g, " ")}
              {gameStatus.online_status === "active" && " · online active"}
            </span>
          )}
        </div>
      )}

      {/* Size */}
      {sizeBytes > 0 && (
        <div className="sgv-row">
          <HardDrive size={13} className="sgv-icon" />
          <div className="sgv-row-content">
            <span className="sgv-label">Size on disk</span>
            <span className="sgv-val">{fmtBytes(sizeBytes)}</span>
          </div>
        </div>
      )}

      {/* Install path */}
      {isInstalled && (meta.install_path || folderPath) && (
        <div className="sgv-row">
          <FolderOpen size={13} className="sgv-icon" />
          <div className="sgv-row-content">
            <span className="sgv-label">Install location</span>
            <span className="sgv-val sgv-mono">{meta.install_path || folderPath}</span>
          </div>
          <button className="sgv-action-btn" onClick={handleOpenFolder} title="Open in Explorer">
            <FolderOpen size={12} /> Open
          </button>
        </div>
      )}

      {/* Play/Install + Favorite row */}
      <div className="sgv-primary-row">
        {isInstalled ? (
          <button className="sgv-launch-btn" onClick={handleLaunch} disabled={launching || !appId}>
            <Play size={14} />
            {launching ? "Launching…" : "Play"}
          </button>
        ) : (
          <button className="sgv-install-btn" onClick={handleInstall} disabled={!appId}>
            <Download size={14} />
            Install
          </button>
        )}
        <button
          className={`sgv-fav-btn ${favoriteState ? "sgv-fav-btn--active" : ""}`}
          onClick={handleToggleFavorite}
          title={favoriteState ? "Remove from favorites" : "Add to favorites"}
        >
          <Heart size={14} />
        </button>
      </div>

      {/* Store row — two equal buttons */}
      {appId && (
        <div className="sgv-store-row">
          <button className="sgv-store-btn" onClick={() => steamOpenInApp(Number(appId)).catch(() => {})}>
            <Monitor size={12} />
            Open in Steam
          </button>
          <button className="sgv-store-btn" onClick={() => steamOpenInStore(Number(appId)).catch(() => {})}>
            <Store size={12} />
            Open in Store
          </button>
        </div>
      )}

      {actionError && <p className="sgv-error">{actionError}</p>}

      <style>{`
        .sgv { display:flex; flex-direction:column; gap:var(--space-3); }
        .sgv-art {
          width:100%; border-radius:var(--radius-sm); display:block;
          aspect-ratio:920/430; object-fit:cover;
          background:var(--color-bg-tertiary);
        }
        .sgv-status-row { display:flex; align-items:center; gap:var(--space-2); }
        .sgv-badge {
          font-size:10px; font-weight:700; padding:2px 8px; border-radius:10px;
        }
        .sgv-badge--installed { background:#dcfce7; color:#166534; }
        .sgv-badge--missing { background:var(--color-bg-tertiary); color:var(--color-text-muted); }
        .sgv-appid { font-size:11px; color:var(--color-text-muted); font-family:var(--font-mono); }
        .sgv-play-status {
          font-size:11px; font-weight:600; padding:2px 8px; border-radius:10px;
          background:var(--color-accent-light); color:var(--color-accent);
          text-transform:capitalize;
        }
        .sgv-row {
          display:flex; align-items:flex-start; gap:var(--space-2);
          padding:var(--space-3); border-radius:var(--radius-sm);
          background:var(--color-bg-secondary); border:1px solid var(--color-border-subtle);
        }
        .sgv-icon { color:var(--color-text-muted); flex-shrink:0; margin-top:2px; }
        .sgv-row-content { flex:1; display:flex; flex-direction:column; gap:2px; min-width:0; }
        .sgv-label { font-size:10px; font-weight:600; text-transform:uppercase; letter-spacing:.05em; color:var(--color-text-muted); }
        .sgv-val { font-size:12px; color:var(--color-text-primary); word-break:break-all; }
        .sgv-mono { font-family:var(--font-mono); font-size:11px; }
        .sgv-action-btn {
          display:inline-flex; align-items:center; gap:4px;
          padding:4px 9px; border-radius:var(--radius-sm);
          font-size:11px; font-weight:500; white-space:nowrap; flex-shrink:0;
          border:1px solid var(--color-border); background:var(--color-bg);
          color:var(--color-text-secondary); cursor:pointer;
          transition:background var(--transition-fast);
        }
        .sgv-action-btn:hover { background:var(--color-bg-tertiary); color:var(--color-text-primary); }
        .sgv-primary-row {
          display:flex; gap:var(--space-2); align-items:stretch;
        }
        .sgv-launch-btn {
          display:flex; align-items:center; justify-content:center; gap:var(--space-2);
          padding:9px 14px; border-radius:var(--radius-sm);
          background:var(--color-accent); color:#fff; border:none; cursor:pointer;
          font-size:13px; font-weight:600; flex:1;
          transition:opacity var(--transition-fast);
        }
        .sgv-launch-btn:hover:not(:disabled) { opacity:.88; }
        .sgv-launch-btn:disabled { opacity:.45; cursor:not-allowed; }
        .sgv-install-btn {
          display:flex; align-items:center; justify-content:center; gap:var(--space-2);
          padding:9px 14px; border-radius:var(--radius-sm);
          background:var(--color-bg-secondary); color:var(--color-text-primary);
          border:1px solid var(--color-border); cursor:pointer;
          font-size:13px; font-weight:600; flex:1;
          transition:background var(--transition-fast), border-color var(--transition-fast), color var(--transition-fast);
        }
        .sgv-install-btn:hover:not(:disabled) { background:var(--color-bg-tertiary); border-color:var(--color-accent); color:var(--color-accent); }
        .sgv-install-btn:disabled { opacity:.45; cursor:not-allowed; }
        .sgv-fav-btn {
          display:flex; align-items:center; justify-content:center;
          padding:8px 10px; border-radius:var(--radius-sm);
          border:1px solid var(--color-border); background:var(--color-bg-secondary);
          color:var(--color-text-muted); cursor:pointer; flex-shrink:0;
          transition:background var(--transition-fast), color var(--transition-fast), border-color var(--transition-fast);
        }
        .sgv-fav-btn:hover { background:var(--color-bg-tertiary); color:#f43f5e; border-color:#f43f5e; }
        .sgv-fav-btn--active { color:#f43f5e; border-color:#f43f5e; background:rgba(244,63,94,0.08); }
        .sgv-store-row {
          display:flex; gap:var(--space-2);
        }
        .sgv-store-btn {
          display:flex; align-items:center; justify-content:center; gap:5px;
          padding:7px 10px; border-radius:var(--radius-sm);
          border:1px solid var(--color-border); background:var(--color-bg-secondary);
          color:var(--color-text-secondary); font-size:11.5px; font-weight:500;
          cursor:pointer; flex:1; white-space:nowrap;
          transition:background var(--transition-fast), color var(--transition-fast);
        }
        .sgv-store-btn:hover { background:var(--color-bg-tertiary); color:var(--color-text-primary); }
        .sgv-error { font-size:12px; color:var(--color-danger); margin:0; }
      `}</style>
    </div>
  );
}

function fmtBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}
