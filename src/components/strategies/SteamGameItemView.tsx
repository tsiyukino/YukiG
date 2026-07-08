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
import { formatFileSize } from "@/utils/formatFileSize";
import styles from "./SteamGameItemView.module.css";

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
    <div className={styles.sgv}>
      {meta.header_image && (
        <img
          className={styles.art}
          src={steamImageSrc(meta.header_image)}
          alt="Game artwork"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
      )}

      {(appId || gameStatus) && (
        <div className={styles.statusRow}>
          {appId && <span className={styles.appId}>App #{appId}</span>}
          {gameStatus && (
            <span className={styles.playStatus}>
              {gameStatus.story_status.replace(/_/g, " ")}
              {gameStatus.online_status === "active" && " · online active"}
            </span>
          )}
        </div>
      )}

      {sizeBytes > 0 && (
        <div className={styles.row}>
          <HardDrive size={13} className={styles.icon} />
          <div className={styles.rowContent}>
            <span className={styles.label}>Size on disk</span>
            <span className={styles.val}>{formatFileSize(sizeBytes)}</span>
          </div>
        </div>
      )}

      {isInstalled && (meta.install_path || folderPath) && (
        <div className={styles.row}>
          <FolderOpen size={13} className={styles.icon} />
          <div className={styles.rowContent}>
            <span className={styles.label}>Install location</span>
            <span className={`${styles.val} ${styles.mono}`}>{meta.install_path || folderPath}</span>
          </div>
          <button className={styles.actionBtn} onClick={handleOpenFolder} title="Open in Explorer">
            <FolderOpen size={12} /> Open
          </button>
        </div>
      )}

      <div className={styles.primaryRow}>
        {isInstalled ? (
          <button className={styles.launchBtn} onClick={handleLaunch} disabled={launching || !appId}>
            <Play size={14} />
            {launching ? "Launching…" : "Play"}
          </button>
        ) : (
          <button className={styles.installBtn} onClick={handleInstall} disabled={!appId}>
            <Download size={14} />
            Install
          </button>
        )}
        <button
          className={favoriteState ? `${styles.favBtn} ${styles.favActive}` : styles.favBtn}
          onClick={handleToggleFavorite}
          title={favoriteState ? "Remove from favorites" : "Add to favorites"}
        >
          <Heart size={14} />
        </button>
      </div>

      {appId && (
        <div className={styles.storeRow}>
          <button className={styles.storeBtn} onClick={() => steamOpenInApp(Number(appId)).catch(() => {})}>
            <Monitor size={12} />
            Open in Steam
          </button>
          <button className={styles.storeBtn} onClick={() => steamOpenInStore(Number(appId)).catch(() => {})}>
            <Store size={12} />
            Open in Store
          </button>
        </div>
      )}

      {actionError && <p className={styles.error}>{actionError}</p>}
    </div>
  );
}
