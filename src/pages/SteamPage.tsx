/**
 * Steam hub page — Library, Detail, and Accounts tabs.
 *
 * Library tab:
 * - Reads from the shared steamStore (scan starts on app launch).
 * - Shows Steam collections in a collapsible sidebar; selected collection shows games in main panel.
 * - Sync button in the topbar re-runs the scan + DB sync at any time.
 * - Hidden games ("已隐藏" / uc-hidden-games) are excluded by the backend scanner.
 *
 * Detail tab:
 * - Shown only when a game is selected via "See Details" in the drawer.
 * - Displays full game detail with hero image, metadata, and placeholder for future content.
 *
 * Accounts tab:
 * - Lists all Steam accounts from loginusers.vdf.
 * - "Switch" button rewrites loginusers.vdf + registry then restarts Steam.
 */
import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { RefreshCw, Users, Library, Gamepad2, CheckCircle2 } from "lucide-react";
import { steamSync, steamGetGameDbInfo, SteamGameDbInfo, gameStatusBulkInit } from "@/services/tauriCommands";
import { SteamGame, SyncResult } from "@/types/steam";
import SteamIcon from "@/components/common/SteamIcon";
import { useSteamStore, steamStoreScan } from "@/store/steamStore";
import { buildGroups } from "@/utils/steamFormatters";
import LibraryTab from "@/components/steam/LibraryTab";
import GameDetailTab from "@/components/steam/GameDetailTab";
import AccountsTab from "@/components/steam/AccountsTab";

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = "library" | "detail" | "accounts";

// ─── Root page ────────────────────────────────────────────────────────────────

/**
 * Steam hub. Reads from the shared steamStore which is pre-loaded on app start.
 * Sync button re-scans and syncs to DB on demand.
 */
export default function SteamPage() {
  const location = useLocation();
  const openItemId: string | null = (location.state as { openItemId?: string } | null)?.openItemId ?? null;
  const [tab, setTab] = useState<Tab>("library");
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [detailGame, setDetailGame] = useState<SteamGame | null>(null);
  const [gameDbInfo, setGameDbInfo] = useState<Record<number, SteamGameDbInfo>>({});

  // Read from shared store — populated on app start
  const { result: scanResult, loading: scanning, error: scanError } = useSteamStore();
  const groups = scanResult ? buildGroups(scanResult.games, scanResult.collection_names) : [];

  // Load DB info on mount and after syncs
  useEffect(() => {
    steamGetGameDbInfo().then(setGameDbInfo).catch(() => {});
  }, []);

  async function runScan() {
    await steamStoreScan();
  }

  /** Sync button: re-scan + sync, always fresh. */
  async function handleLoad() {
    await runScan();
    handleSync();
  }

  async function handleSync() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const result = await steamSync();
      setSyncResult(result);
      // Refresh DB info after sync in case items were added/removed.
      steamGetGameDbInfo().then(setGameDbInfo).catch(() => {});
      // Re-run status auto-detection so playtime/categories from this sync are applied.
      gameStatusBulkInit().catch(() => {});
    } catch (_) {
      // Sync errors are non-fatal — library view still works.
    } finally {
      setSyncing(false);
    }
  }

  function handleFavoriteChanged(appId: number, isFavorite: boolean) {
    setGameDbInfo((prev) => {
      const entry = prev[appId];
      if (!entry) return prev;
      return { ...prev, [appId]: { ...entry, is_favorite: isFavorite } };
    });
  }

  function handleSeeDetails(game: SteamGame) {
    setDetailGame(game);
    setTab("detail");
  }

  const isLoading = scanning || syncing;

  return (
    <div className="sp-root">
      {/* ── Top bar ── */}
      <div className="sp-topbar">
        <div className="sp-topbar-left">
          <div className="sp-logo">
            <SteamIcon size={16} />
            <span className="sp-logo-text">Steam</span>
          </div>
          <nav className="sp-tabs">
            <button
              className={`sp-tab ${tab === "library" ? "sp-tab--active" : ""}`}
              onClick={() => setTab("library")}
            >
              <Library size={13} />
              Library
            </button>
            {detailGame !== null && (
              <button
                className={`sp-tab ${tab === "detail" ? "sp-tab--active" : ""}`}
                onClick={() => setTab("detail")}
              >
                <Gamepad2 size={13} />
                {detailGame.name}
              </button>
            )}
            <button
              className={`sp-tab ${tab === "accounts" ? "sp-tab--active" : ""}`}
              onClick={() => setTab("accounts")}
            >
              <Users size={13} />
              Accounts
            </button>
          </nav>
        </div>

        <div className="sp-topbar-right">
          {syncResult && !syncing && (
            <span className="sp-sync-badge">
              <CheckCircle2 size={11} />
              +{syncResult.added} ↑{syncResult.updated} −{syncResult.removed}
            </span>
          )}
          <button
            className="sp-btn sp-btn--secondary"
            onClick={handleLoad}
            disabled={isLoading}
          >
            <RefreshCw size={12} className={isLoading ? "sp-spin" : ""} />
            {scanning ? "Scanning…" : syncing ? "Syncing…" : "Sync"}
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="sp-content">
        {tab === "library" && (
          <LibraryTab
            scanning={scanning}
            groups={groups}
            scanError={scanError}
            scanResult={scanResult}
            gameDbInfo={gameDbInfo}
            onSeeDetails={handleSeeDetails}
            onFavoriteChanged={handleFavoriteChanged}
            openItemId={openItemId}
          />
        )}
        {tab === "detail" && detailGame !== null && (
          <GameDetailTab game={detailGame} gameDbInfo={gameDbInfo} />
        )}
        {tab === "accounts" && <AccountsTab />}
      </div>

      <style>{STYLES}</style>
    </div>
  );
}


const STYLES = `
/* ── Root layout ── */
.sp-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

/* ── Top bar ── */
.sp-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--space-5);
  height: 48px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg-secondary);
  flex-shrink: 0;
}
.sp-topbar-left {
  display: flex;
  align-items: center;
  gap: var(--space-5);
}
.sp-topbar-right {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.sp-logo {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--color-text-primary);
}
.sp-logo-text {
  font-size: 14px;
  font-weight: 700;
  letter-spacing: -0.02em;
}
.sp-tabs {
  display: flex;
  gap: 2px;
}
.sp-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 11px;
  border-radius: var(--radius-sm);
  font-size: 12.5px;
  font-weight: 500;
  color: var(--color-text-secondary);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: background var(--transition-fast), color var(--transition-fast);
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sp-tab:hover { background: var(--color-bg-tertiary); color: var(--color-text-primary); }
.sp-tab--active { background: var(--color-accent-light); color: var(--color-accent); }

/* ── Shared buttons ── */
.sp-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 11px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: opacity var(--transition-fast), background var(--transition-fast);
}
.sp-btn:disabled { opacity: .45; cursor: not-allowed; }
.sp-btn--secondary {
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
}
.sp-btn--secondary:hover:not(:disabled) { background: var(--color-bg-secondary); }
.sp-btn--ghost { background: transparent; color: var(--color-text-secondary); }
.sp-btn--ghost:hover:not(:disabled) { background: var(--color-bg-tertiary); color: var(--color-text-primary); }

@keyframes sp-spin { to { transform: rotate(360deg); } }
.sp-spin { animation: sp-spin 1s linear infinite; }

/* ── Sync badge ── */
.sp-sync-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--color-success);
  background: rgba(34,197,94,0.1);
  padding: 3px 8px;
  border-radius: var(--radius-full);
  font-weight: 500;
}

/* ── Content area ── */
.sp-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* ── State screens ── */
.sp-state-screen {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  flex: 1;
  padding: var(--space-12);
  text-align: center;
  color: var(--color-text-muted);
}
.sp-state-screen--inline {
  justify-content: flex-start;
  padding: var(--space-10) 0;
}
.sp-state-icon {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-md);
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted);
}
.sp-state-icon--spin svg { animation: sp-spin 1.5s linear infinite; }
.sp-state-icon--error { background: var(--color-danger-light); border-color: var(--color-danger); color: var(--color-danger); }
.sp-state-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0;
}
.sp-state-sub {
  font-size: 12.5px;
  color: var(--color-text-muted);
  margin: 0;
  max-width: 320px;
}

/* ── Error / success banners ── */
.sp-error-banner {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  background: var(--color-danger-light);
  color: var(--color-danger);
  font-size: 12.5px;
  flex-shrink: 0;
}
.sp-error-dismiss {
  margin-left: auto;
  color: var(--color-danger);
  opacity: 0.7;
  display: flex;
  align-items: center;
}
.sp-error-dismiss:hover { opacity: 1; }
.sp-success-banner {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  background: rgba(34,197,94,0.1);
  color: var(--color-success);
  font-size: 12.5px;
  flex-shrink: 0;
}
.sp-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  padding: var(--space-12);
  color: var(--color-text-muted);
  font-size: 13px;
  text-align: center;
}

/* ── Library layout (sidebar + main) ── */
.sp-library {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* ── Sidebar ── */
.sp-sidebar {
  width: 220px;
  flex-shrink: 0;
  border-right: 1px solid var(--color-border);
  background: var(--color-bg-secondary);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: width 200ms ease;
}
.sp-sidebar--collapsed {
  width: 52px;
}
.sp-sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4) var(--space-3) var(--space-2);
  gap: var(--space-2);
  flex-shrink: 0;
}
.sp-sidebar-label {
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--color-text-muted);
  flex: 1;
  min-width: 0;
  overflow: hidden;
}
.sp-sidebar-count {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-muted);
  background: var(--color-bg-tertiary);
  padding: 1px 6px;
  border-radius: var(--radius-full);
}
.sp-sidebar-toggle {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background var(--transition-fast), color var(--transition-fast);
}
.sp-sidebar-toggle:hover { background: var(--color-bg-tertiary); color: var(--color-text-primary); }
.sp-sidebar--collapsed .sp-sidebar-header {
  justify-content: center;
  padding: var(--space-3) var(--space-2);
}
.sp-sidebar-nav {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-1) var(--space-2) var(--space-2);
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.sp-sidebar--collapsed .sp-sidebar-nav {
  padding: var(--space-1) var(--space-1) var(--space-2);
  align-items: center;
}
.sp-sidebar-item {
  display: flex;
  align-items: center;
  padding: 0;
  border-radius: var(--radius-sm);
  border: none;
  background: transparent;
  cursor: pointer;
  text-align: left;
  width: 100%;
  transition: background var(--transition-fast);
  color: var(--color-text-primary);
}
.sp-sidebar-item:hover { background: var(--color-bg-tertiary); }
.sp-sidebar-item--active {
  background: var(--color-accent-light);
  color: var(--color-accent);
}
/* Collapsed item: just the icon centered */
.sp-sidebar--collapsed .sp-sidebar-item {
  width: 36px;
  height: 36px;
  justify-content: center;
}
/* Small square icon for collapsed mode */
.sp-sidebar-mosaic--icon {
  width: 28px;
  height: 28px;
  border-radius: 5px;
  overflow: hidden;
  background: var(--color-bg-tertiary);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted);
}
/* Collapsed icon: community icon square */
.sp-sidebar-mosaic-img-logo {
  width: 22px;
  height: 22px;
  object-fit: cover;
  display: block;
  border-radius: 3px;
}
/* Expanded item: horizontal row with logo + text */
.sp-sidebar-item-inner {
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: 5px var(--space-2);
  gap: var(--space-2);
  width: 100%;
}
/* Expanded item: community icon (square) container */
.sp-sidebar-logo-thumb {
  width: 26px;
  height: 26px;
  flex-shrink: 0;
  border-radius: 4px;
  overflow: hidden;
  background: var(--color-bg-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted);
}
.sp-sidebar-logo-thumb-img {
  width: 26px;
  height: 26px;
  object-fit: cover;
  display: block;
}
.sp-sidebar-item-info {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
  flex: 1;
}
.sp-sidebar-item-name {
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.3;
}
.sp-sidebar-item-meta {
  font-size: 10px;
  color: var(--color-text-muted);
}
.sp-sidebar-item--active .sp-sidebar-item-meta { color: var(--color-accent); opacity: 0.7; }
.sp-sidebar-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-4);
  padding: var(--space-3) var(--space-4);
  border-top: 1px solid var(--color-border);
  flex-shrink: 0;
}
.sp-sidebar-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
}
.sp-sidebar-stat-val {
  font-size: 15px;
  font-weight: 700;
  color: var(--color-text-primary);
  letter-spacing: -0.02em;
  line-height: 1;
}
.sp-sidebar-stat-label {
  font-size: 10px;
  color: var(--color-text-muted);
  font-weight: 500;
}
.sp-sidebar-stat-divider {
  width: 1px;
  height: 24px;
  background: var(--color-border);
}

/* ── Main panel ── */
.sp-main {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.sp-main-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg);
  position: sticky;
  top: 0;
  z-index: 2;
  flex-shrink: 0;
}
.sp-main-toolbar-left {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
}
.sp-main-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0;
  letter-spacing: -0.02em;
}
.sp-main-subtitle {
  font-size: 12px;
  color: var(--color-text-muted);
  font-weight: 500;
}
.sp-main-toolbar-right {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.sp-search-wrap {
  position: relative;
  display: flex;
  align-items: center;
}
.sp-search-icon {
  position: absolute;
  left: 9px;
  color: var(--color-text-muted);
  pointer-events: none;
}
.sp-search {
  padding: 6px 28px 6px 30px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background: var(--color-bg-secondary);
  font-size: 12.5px;
  color: var(--color-text-primary);
  width: 180px;
  transition: border-color var(--transition-fast), width var(--transition-normal);
}
.sp-search:focus {
  outline: none;
  border-color: var(--color-accent);
  width: 220px;
}
.sp-search-clear {
  position: absolute;
  right: 7px;
  color: var(--color-text-muted);
  display: flex;
  align-items: center;
}
.sp-search-clear:hover { color: var(--color-text-primary); }
.sp-view-toggle {
  display: flex;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}
.sp-view-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px 9px;
  background: transparent;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: background var(--transition-fast), color var(--transition-fast);
}
.sp-view-btn:hover { background: var(--color-bg-tertiary); color: var(--color-text-primary); }
.sp-view-btn--active { background: var(--color-bg-tertiary); color: var(--color-accent); }
.sp-view-btn + .sp-view-btn { border-left: 1px solid var(--color-border); }

/* ── Game grid — fixed card width so drawer open/close never resizes cards ── */
.sp-game-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, 160px);
  justify-content: center;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-5);
  align-content: start;
}
.sp-card {
  width: 160px;
  flex-shrink: 0;
  border-radius: var(--radius-md);
  overflow: hidden;
  cursor: pointer;
  border: 1.5px solid var(--color-border);
  background: var(--color-bg-secondary);
  transition: transform var(--transition-fast), box-shadow var(--transition-fast), border-color var(--transition-fast);
  text-align: left;
  display: flex;
  flex-direction: column;
}
.sp-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
  border-color: var(--color-accent);
}
.sp-card--selected {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 2px var(--color-accent-light);
}
.sp-card--uninstalled { opacity: 0.65; }
.sp-card-art-wrap {
  position: relative;
  aspect-ratio: 920 / 430;
  background: var(--color-bg-tertiary);
  overflow: hidden;
}
.sp-card-art { width: 100%; height: 100%; object-fit: cover; display: block; }
.sp-card-badge {
  position: absolute;
  bottom: 5px;
  right: 5px;
  font-size: 9px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(0,0,0,0.65);
  color: #ccc;
  letter-spacing: 0.02em;
}
.sp-card-fav {
  position: absolute;
  top: 5px;
  left: 5px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: rgba(0,0,0,0.55);
  color: #ec4899;
}
.sp-card-info {
  padding: 7px 9px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
}
.sp-card-name {
  font-size: 11.5px;
  font-weight: 500;
  color: var(--color-text-primary);
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.sp-card-size {
  font-size: 10px;
  color: var(--color-text-muted);
  display: flex;
  align-items: center;
  gap: 3px;
}

/* ── Game list ── */
.sp-game-list {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: var(--space-3) var(--space-5);
}
.sp-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  border: 1px solid transparent;
  background: transparent;
  cursor: pointer;
  text-align: left;
  transition: background var(--transition-fast), border-color var(--transition-fast);
  width: 100%;
}
.sp-row:hover { background: var(--color-bg-secondary); border-color: var(--color-border); }
.sp-row--selected { background: var(--color-accent-light); border-color: var(--color-accent); }
.sp-row--uninstalled { opacity: 0.65; }
.sp-row-icon-wrap {
  width: 28px;
  height: 28px;
  border-radius: 4px;
  background: var(--color-bg-tertiary);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.sp-row-icon {
  width: 28px;
  height: 28px;
  object-fit: cover;
  display: block;
}
.sp-row-icon-fallback {
  color: var(--color-text-muted);
}
.sp-row-name {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sp-row-right {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-shrink: 0;
}
.sp-row-size {
  font-size: 11px;
  color: var(--color-text-muted);
  display: flex;
  align-items: center;
  gap: 4px;
}
.sp-row-status {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: var(--radius-full);
}
.sp-row-status--on { background: rgba(34,197,94,0.12); color: #16a34a; }
.sp-row-status--off { background: var(--color-bg-tertiary); color: var(--color-text-muted); }
[data-theme="dark"] .sp-row-status--on { color: var(--color-success); }
.sp-row-fav { color: #ec4899; flex-shrink: 0; margin-left: 4px; }

/* ── Detail drawer ── */
.sp-drawer {
  width: 280px;
  flex-shrink: 0;
  border-left: 1px solid var(--color-border);
  background: var(--color-bg);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  animation: sp-drawer-in 180ms ease;
}
@keyframes sp-drawer-in {
  from { opacity: 0; transform: translateX(12px); }
  to   { opacity: 1; transform: translateX(0); }
}
.sp-drawer-hero {
  position: relative;
  background: var(--color-bg-tertiary);
  flex-shrink: 0;
}
.sp-drawer-hero-img {
  width: 100%;
  aspect-ratio: 600 / 900;
  object-fit: cover;
  display: block;
}
.sp-drawer-hero-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 50%);
}
.sp-drawer-close {
  position: absolute;
  top: 9px;
  right: 9px;
  background: rgba(0,0,0,0.5);
  border: none;
  border-radius: 5px;
  color: #fff;
  padding: 5px;
  cursor: pointer;
  display: flex;
  align-items: center;
  transition: background var(--transition-fast);
  z-index: 2;
}
.sp-drawer-close:hover { background: rgba(0,0,0,0.75); }
.sp-drawer-hero-title {
  position: absolute;
  bottom: var(--space-4);
  left: var(--space-4);
  right: var(--space-4);
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}
.sp-drawer-name {
  font-size: 15px;
  font-weight: 700;
  color: #fff;
  margin: 0;
  line-height: 1.3;
  letter-spacing: -0.02em;
  text-shadow: 0 1px 3px rgba(0,0,0,0.4);
}
.sp-status-pill {
  display: inline-flex;
  align-items: center;
  font-size: 10px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: var(--radius-full);
  width: fit-content;
}
.sp-status-pill--on { background: rgba(34,197,94,0.2); color: #bbf7d0; }
.sp-status-pill--off { background: rgba(255,255,255,0.15); color: rgba(255,255,255,0.7); }
.sp-drawer-body {
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  flex: 1;
}
/* Play + Favorite on same row */
.sp-drawer-primary-row {
  display: flex;
  gap: var(--space-2);
  align-items: stretch;
}
/* Store row — two equal buttons */
.sp-drawer-store-row {
  display: flex;
  gap: var(--space-2);
}
.sp-launch-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: 9px 14px;
  border-radius: var(--radius-sm);
  background: linear-gradient(160deg, #818cf8 0%, #6366f1 55%, #4f46e5 100%);
  color: #fff;
  border: 1px solid rgba(129,140,248,.35);
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  flex: 1;
  box-shadow: 0 2px 8px rgba(99,102,241,.4), inset 0 1px 0 rgba(255,255,255,.15);
  transition: background var(--transition-fast), box-shadow var(--transition-fast), transform var(--transition-fast), border-color var(--transition-fast);
}
.sp-launch-btn:hover:not(:disabled) {
  background: linear-gradient(160deg, #a5b4fc 0%, #818cf8 50%, #6366f1 100%);
  border-color: rgba(165,180,252,.45);
  box-shadow: 0 0 0 3px rgba(99,102,241,.2), 0 4px 14px rgba(99,102,241,.5), inset 0 1px 0 rgba(255,255,255,.2);
  transform: translateY(-1px);
}
.sp-launch-btn:active:not(:disabled) {
  transform: translateY(0);
  box-shadow: 0 1px 4px rgba(99,102,241,.35), inset 0 1px 0 rgba(255,255,255,.1);
}
.sp-launch-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.sp-install-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: 9px 14px;
  border-radius: var(--radius-sm);
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  flex: 1;
  transition: background var(--transition-fast), border-color var(--transition-fast);
}
.sp-install-btn:hover { background: var(--color-bg-tertiary); border-color: var(--color-accent); color: var(--color-accent); }
.sp-fav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background: var(--color-bg-secondary);
  color: var(--color-text-muted);
  cursor: pointer;
  flex-shrink: 0;
  transition: background var(--transition-fast), color var(--transition-fast), border-color var(--transition-fast);
}
.sp-fav-btn:hover { background: var(--color-bg-tertiary); color: #f43f5e; border-color: #f43f5e; }
.sp-fav-btn--active { color: #f43f5e; border-color: #f43f5e; background: rgba(244,63,94,0.08); }
.sp-store-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 7px 10px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background: var(--color-bg-secondary);
  color: var(--color-text-secondary);
  font-size: 11.5px;
  font-weight: 500;
  cursor: pointer;
  transition: background var(--transition-fast), color var(--transition-fast);
  white-space: nowrap;
  flex: 1;
}
.sp-store-btn--half { flex: 1; }
.sp-store-btn:hover { background: var(--color-bg-tertiary); color: var(--color-text-primary); }
.sp-detail-link-btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 7px var(--space-3);
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background: var(--color-bg-secondary);
  color: var(--color-text-secondary);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  width: 100%;
  transition: background var(--transition-fast), color var(--transition-fast);
}
.sp-detail-link-btn:hover { background: var(--color-bg-tertiary); color: var(--color-text-primary); }
.sp-drawer-details {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
}
.sp-detail-row {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  padding: var(--space-3);
  background: var(--color-bg-secondary);
  border-bottom: 1px solid var(--color-border-subtle);
}
.sp-detail-row:last-child { border-bottom: none; }
.sp-detail-icon {
  flex-shrink: 0;
  color: var(--color-text-muted);
  margin-top: 1px;
}
.sp-detail-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}
.sp-detail-label {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-muted);
}
.sp-detail-val {
  font-size: 12px;
  color: var(--color-text-primary);
  word-break: break-all;
  line-height: 1.4;
}
.sp-mono { font-family: var(--font-mono); font-size: 11px; }

/* ── Game detail tab ── */
.sp-detail-tab {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}
/* ── Game Detail Tab (sdt-*) ── */
.sdt-root {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}
.sdt-hero {
  position: relative;
  background: #0a0a0a;
  flex-shrink: 0;
}
.sdt-hero-img {
  width: 100%;
  max-height: 260px;
  object-fit: cover;
  display: block;
}
.sdt-hero-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.55) 100%);
}
/* Logo overlay: centered at bottom of hero, transparent PNG */
.sdt-hero-logo-wrap {
  position: absolute;
  bottom: var(--space-5);
  left: 0;
  right: 0;
  z-index: 2;
  display: flex;
  justify-content: center;
  align-items: flex-end;
  padding: 0 var(--space-6);
  pointer-events: none;
}
.sdt-hero-logo {
  max-width: 320px;
  max-height: 130px;
  object-fit: contain;
  display: block;
  filter: drop-shadow(0 2px 12px rgba(0,0,0,0.8));
}
/* Below-hero strip: name, meta, pills */
.sdt-hero-below {
  padding: var(--space-4) var(--space-6) var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  border-bottom: 1px solid var(--color-border-subtle);
  flex-shrink: 0;
}
.sdt-hero-name-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.sdt-hero-name {
  font-size: 20px;
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0;
  letter-spacing: -0.02em;
}
.sdt-edit-icon-btn {
  display: flex;
  align-items: center;
  padding: 4px;
  border: none;
  background: var(--color-bg-secondary);
  color: var(--color-text-muted);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background var(--transition-fast), color var(--transition-fast);
  flex-shrink: 0;
}
.sdt-edit-icon-btn:hover { background: var(--color-bg-tertiary); color: var(--color-text-primary); }
.sdt-name-edit {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}
.sdt-name-input {
  font-size: 18px;
  font-weight: 600;
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
  outline: none;
  min-width: 280px;
}
.sdt-name-save, .sdt-name-cancel {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  border: none;
  cursor: pointer;
  font-size: 12px;
}
.sdt-name-save {
  background: var(--color-accent);
  color: #fff;
}
.sdt-name-cancel {
  background: var(--color-bg-secondary);
  color: var(--color-text-muted);
  border: 1px solid var(--color-border);
}
.sdt-hero-meta {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  flex-wrap: wrap;
}
.sdt-hero-dev {
  font-size: 12px;
  color: var(--color-text-muted);
}
.sdt-hero-sep {
  font-size: 12px;
  color: var(--color-text-muted);
  opacity: 0.4;
}
.sdt-hero-pills {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}
.sdt-hero-action-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
  margin-top: var(--space-1);
}
.sdt-play-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 24px;
  border-radius: var(--radius-sm);
  background: linear-gradient(160deg, #818cf8 0%, #6366f1 55%, #4f46e5 100%);
  border: 1px solid rgba(129,140,248,.35);
  color: #fff;
  cursor: pointer;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.01em;
  box-shadow: 0 2px 8px rgba(99,102,241,.4), inset 0 1px 0 rgba(255,255,255,.15);
  transition: background .15s, box-shadow .18s, transform .12s, border-color .15s;
}
.sdt-play-btn:hover {
  background: linear-gradient(160deg, #a5b4fc 0%, #818cf8 50%, #6366f1 100%);
  border-color: rgba(165,180,252,.45);
  box-shadow: 0 0 0 3px rgba(99,102,241,.2), 0 4px 14px rgba(99,102,241,.5), inset 0 1px 0 rgba(255,255,255,.2);
  transform: translateY(-1px);
}
.sdt-play-btn:active {
  transform: translateY(0);
  box-shadow: 0 1px 4px rgba(99,102,241,.35), inset 0 1px 0 rgba(255,255,255,.1);
}
.sdt-install-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: 9px 22px;
  border-radius: var(--radius-sm);
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
  cursor: pointer;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.01em;
  transition: background var(--transition-fast), border-color var(--transition-fast), color var(--transition-fast);
}
.sdt-install-btn:hover { background: var(--color-bg-tertiary); border-color: var(--color-accent); color: var(--color-accent); }
.sdt-playtime-widget {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 6px 14px;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-sm);
}
.sdt-playtime-val {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text-primary);
  line-height: 1.2;
}
.sdt-playtime-sub {
  font-size: 10px;
  color: var(--color-text-muted);
  line-height: 1.2;
}
.sdt-appid-pill {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-muted);
  font-family: var(--font-mono);
}
.sdt-playtime-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-secondary);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-subtle);
  padding: 2px 8px;
  border-radius: var(--radius-full);
}
.sdt-body {
  padding: var(--space-6) var(--space-8);
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  max-width: 820px;
}
.sdt-error-banner {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  background: var(--color-danger-light);
  color: var(--color-danger);
  border-radius: var(--radius-sm);
  font-size: 12.5px;
}
.sdt-error-banner button {
  margin-left: auto;
  background: none;
  border: none;
  color: var(--color-danger);
  cursor: pointer;
  display: flex;
  align-items: center;
}
.sdt-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}
.sdt-section-title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 11.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-muted);
  margin: 0;
}
.sdt-section-header-btn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  color: inherit;
  width: 100%;
  text-align: left;
}
.sdt-section-header-btn .sdt-section-title { pointer-events: none; }
.sdt-section-header-btn:hover .sdt-section-title { color: var(--color-text-primary); }
.sdt-ach-summary {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-accent);
  background: var(--color-accent-light);
  padding: 1px 7px;
  border-radius: var(--radius-full);
  text-transform: none;
  letter-spacing: 0;
}
.sdt-ach-progress-wrap {
  height: 4px;
  background: var(--color-bg-tertiary);
  border-radius: 2px;
  overflow: hidden;
}
.sdt-ach-progress-bar {
  height: 100%;
  background: var(--color-accent);
  border-radius: 2px;
  transition: width 400ms ease;
}
.sdt-ach-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 320px;
  overflow-y: auto;
}
.sdt-ach-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-6);
  color: var(--color-text-muted);
  font-size: 12.5px;
  text-align: center;
}
.sdt-ach-empty-hint {
  font-size: 11.5px;
  color: var(--color-text-muted);
  max-width: 340px;
}
.sdt-ach-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 7px var(--space-3);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
  border: 1px solid var(--color-border-subtle);
}
.sdt-ach-item--unlocked { background: rgba(34,197,94,0.05); border-color: rgba(34,197,94,0.2); }
.sdt-ach-icon {
  width: 22px;
  height: 22px;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 10px;
}
.sdt-ach-icon--on { background: rgba(34,197,94,0.15); color: #16a34a; }
.sdt-ach-icon--off { background: var(--color-bg-tertiary); color: var(--color-text-muted); }
.sdt-ach-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.sdt-ach-name {
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-primary);
  font-family: var(--font-mono);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sdt-ach-date {
  font-size: 10.5px;
  color: var(--color-text-muted);
}
.sdt-ach-check { color: #16a34a; flex-shrink: 0; }
.sdt-stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-3);
}
.sdt-stat-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: var(--space-3);
  background: var(--color-bg);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-sm);
}
.sdt-stat-val {
  font-size: 15px;
  font-weight: 700;
  color: var(--color-text-primary);
}
.sdt-stat-label {
  font-size: 10.5px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-muted);
}
.sdt-detail-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.sdt-field-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.sdt-field-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-muted);
}
.sdt-field-edit-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 500;
  color: var(--color-accent);
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
}
.sdt-field-edit-btn:hover { background: var(--color-accent-light); }
.sdt-field-value { font-size: 13px; color: var(--color-text-primary); line-height: 1.5; }
.sdt-field-placeholder { font-style: italic; color: var(--color-text-muted); }
.sdt-desc-edit { display: flex; flex-direction: column; gap: var(--space-2); }
.sdt-desc-textarea {
  width: 100%;
  padding: var(--space-3);
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background: var(--color-bg);
  color: var(--color-text-primary);
  font-size: 13px;
  line-height: 1.5;
  resize: vertical;
  font-family: inherit;
  outline: none;
  box-sizing: border-box;
}
.sdt-desc-textarea:focus { border-color: var(--color-accent); }
.sdt-desc-actions { display: flex; gap: var(--space-2); }
.sdt-desc-save, .sdt-desc-cancel {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 12px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  border: none;
}
.sdt-desc-save { background: var(--color-accent); color: #fff; }
.sdt-desc-save:disabled { opacity: .6; cursor: not-allowed; }
.sdt-desc-cancel { background: var(--color-bg-tertiary); color: var(--color-text-secondary); }
.sdt-info-rows {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-sm);
  overflow: hidden;
}
.sdt-store-actions {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}
.sdt-store-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 13px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background: var(--color-bg);
  color: var(--color-text-secondary);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background var(--transition-fast), color var(--transition-fast);
  white-space: nowrap;
}
.sdt-store-btn:hover { background: var(--color-bg-tertiary); color: var(--color-text-primary); }

/* ── OS pill ── */
.sdt-os-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(255,255,255,0.12);
  border-radius: var(--radius-full);
  padding: 3px 9px;
}
.sdt-os-icon {
  display: block;
  flex-shrink: 0;
  opacity: 0.85;
}

/* ── Download progress ── */
.sdt-download-wrap {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  margin-top: var(--space-2);
}
.sdt-download-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.sdt-download-label {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11.5px;
  color: var(--color-text-muted);
}
.sdt-download-pct {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--color-text-secondary);
}
.sdt-download-track {
  height: 5px;
  background: var(--color-bg-tertiary);
  border-radius: var(--radius-full);
  overflow: hidden;
}
.sdt-download-bar {
  height: 100%;
  background: var(--color-accent);
  border-radius: var(--radius-full);
  transition: width 300ms ease;
}

/* ── Screenshots grid ── */
.sdt-screenshots-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: var(--space-2);
}
.sdt-screenshot-item {
  position: relative;
  border-radius: var(--radius-sm);
  overflow: hidden;
  aspect-ratio: 16/9;
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border-subtle);
  cursor: pointer;
  display: block;
  padding: 0;
}
.sdt-screenshot-item:hover .sdt-screenshot-overlay { opacity: 1; }
.sdt-screenshot-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.sdt-screenshot-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: var(--space-2);
  background: linear-gradient(transparent, rgba(0,0,0,0.65));
  opacity: 0;
  transition: opacity var(--transition-fast);
  display: flex;
  align-items: flex-end;
}
.sdt-screenshot-date {
  font-size: 10px;
  color: rgba(255,255,255,0.85);
  font-weight: 500;
}

/* ── Cloud saves list ── */
.sdt-cloud-list {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-sm);
  overflow: hidden;
}
.sdt-cloud-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: 8px var(--space-3);
  border-bottom: 1px solid var(--color-border-subtle);
  background: var(--color-bg);
}
.sdt-cloud-item:last-child { border-bottom: none; }
.sdt-cloud-item:nth-child(even) { background: var(--color-bg-secondary); }
.sdt-cloud-name-wrap {
  flex: 1;
  min-width: 0;
}
.sdt-cloud-name {
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-primary);
  font-family: var(--font-mono);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
}
.sdt-cloud-size {
  font-size: 11px;
  color: var(--color-text-muted);
  white-space: nowrap;
  flex-shrink: 0;
}
.sdt-cloud-date {
  font-size: 11px;
  color: var(--color-text-muted);
  white-space: nowrap;
  flex-shrink: 0;
  min-width: 90px;
  text-align: right;
}

/* ── Accounts ── */
.sp-accounts {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  padding: var(--space-6) var(--space-8);
  max-width: 680px;
  width: 100%;
  overflow-y: auto;
  flex: 1;
}
.sp-accounts-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
}
.sp-accounts-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0;
  letter-spacing: -0.03em;
}
.sp-accounts-sub {
  font-size: 13px;
  color: var(--color-text-muted);
  margin: var(--space-1) 0 0;
}
.sp-user-grid {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.sp-user-card {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-4);
  border-radius: var(--radius-md);
  border: 1.5px solid var(--color-border);
  background: var(--color-bg-secondary);
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}
.sp-user-card:hover { box-shadow: var(--shadow-sm); }
.sp-user-card--active {
  border-color: var(--color-accent);
  background: var(--color-accent-light);
}
.sp-user-avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  overflow: hidden;
  background: var(--color-bg-tertiary);
  flex-shrink: 0;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}
.sp-user-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  position: absolute;
  inset: 0;
}
.sp-user-initial {
  font-size: 17px;
  font-weight: 700;
  color: var(--color-text-muted);
}
.sp-user-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.sp-user-head {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.sp-user-persona {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
}
.sp-active-pill {
  font-size: 9.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-accent);
  background: rgba(99,102,241,0.12);
  padding: 1px 7px;
  border-radius: var(--radius-full);
}
.sp-user-account {
  font-size: 12px;
  color: var(--color-text-muted);
}
.sp-user-last {
  font-size: 11px;
  color: var(--color-text-muted);
  display: flex;
  align-items: center;
  gap: 4px;
}
.sp-switch-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 7px 16px;
  border-radius: var(--radius-sm);
  font-size: 12.5px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid var(--color-border);
  background: var(--color-bg);
  color: var(--color-text-secondary);
  transition: background var(--transition-fast), color var(--transition-fast);
  flex-shrink: 0;
}
.sp-switch-btn:hover:not(:disabled) { background: var(--color-bg-tertiary); color: var(--color-text-primary); }
.sp-switch-btn:disabled { opacity: .55; cursor: default; }
.sp-switch-btn--current {
  border-color: var(--color-accent);
  color: var(--color-accent);
  background: var(--color-accent-light);
}

/* ── Detail page ── */
.sdt-page {
  padding: var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  flex: 1;
  min-width: 0;
}

/* ── Action row ── */
.sdt-actions-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}
.sdt-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background: var(--color-bg-secondary);
  color: var(--color-text-secondary);
  font-size: 12.5px;
  font-weight: 500;
  cursor: pointer;
  transition: background var(--transition-fast), color var(--transition-fast), border-color var(--transition-fast);
  white-space: nowrap;
}
.sdt-action-btn:hover { background: var(--color-bg-tertiary); color: var(--color-text-primary); }
.sdt-action-btn--primary {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: #fff;
}
.sdt-action-btn--primary:hover { opacity: 0.88; background: var(--color-accent); color: #fff; }

/* ── Two-column layout ── */
.sdt-columns {
  display: grid;
  grid-template-columns: 1fr 1.3fr;
  gap: var(--space-4);
  align-items: start;
}
.sdt-col-left, .sdt-col-right {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  min-width: 0;
}

/* ── Card (collapsible and static) ── */
.sdt-card {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-secondary);
  overflow: hidden;
}
.sdt-card--static {}
.sdt-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px var(--space-4);
  gap: var(--space-2);
  cursor: pointer;
  user-select: none;
  transition: background var(--transition-fast);
  border-bottom: 1px solid transparent;
}
.sdt-card-header:hover { background: var(--color-bg-tertiary); }
.sdt-card-header--static { cursor: default; border-bottom: 1px solid var(--color-border-subtle); }
.sdt-card-header--static:hover { background: transparent; }
.sdt-card-header--open { border-bottom-color: var(--color-border-subtle); }
.sdt-card-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-primary);
  flex: 1;
  min-width: 0;
}
.sdt-card-icon {
  display: flex;
  align-items: center;
  color: var(--color-text-muted);
  flex-shrink: 0;
}
.sdt-card-chevron {
  color: var(--color-text-muted);
  flex-shrink: 0;
  transition: transform 200ms ease;
}
.sdt-card-chevron--open { transform: rotate(180deg); }
.sdt-card-edit-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 500;
  color: var(--color-text-muted);
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  flex-shrink: 0;
  transition: color var(--transition-fast), background var(--transition-fast);
}
.sdt-card-edit-btn:hover { color: var(--color-accent); background: var(--color-accent-light); }
.sdt-card-body {
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.sdt-card-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-5);
  color: var(--color-text-muted);
  font-size: 12.5px;
}

/* ── Badge (inside card header) ── */
.sdt-badge {
  font-size: 10.5px;
  font-weight: 600;
  color: var(--color-accent);
  background: var(--color-accent-light);
  padding: 1px 7px;
  border-radius: var(--radius-full);
  white-space: nowrap;
}

/* ── Stats grid (new layout) ── */
.sdt-stat {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: var(--space-3);
  background: var(--color-bg);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-sm);
  align-items: center;
}

/* ── Download progress ── */
.sdt-dl-wrap {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  margin-top: var(--space-1);
}
.sdt-dl-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.sdt-dl-label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11.5px;
  color: var(--color-text-muted);
}
.sdt-dl-pct {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--color-text-secondary);
}
.sdt-dl-track {
  height: 5px;
  background: var(--color-bg-tertiary);
  border-radius: var(--radius-full);
  overflow: hidden;
}
.sdt-dl-bar {
  height: 100%;
  background: var(--color-accent);
  border-radius: var(--radius-full);
  transition: width 300ms ease;
}

/* ── Info rows ── */
.sdt-card-body--rows { padding: 0; gap: 0; }
.sdt-row {
  display: flex;
  align-items: baseline;
  gap: var(--space-3);
  padding: 8px var(--space-4);
  border-bottom: 1px solid var(--color-border-subtle);
}
.sdt-row:last-child { border-bottom: none; }
.sdt-row-label {
  font-size: 10.5px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-muted);
  flex-shrink: 0;
  min-width: 80px;
}
.sdt-row-val {
  font-size: 12.5px;
  color: var(--color-text-primary);
  flex: 1;
  min-width: 0;
  word-break: break-word;
}
.sdt-row-val--truncate {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  word-break: normal;
}
.sdt-mono { font-family: var(--font-mono); font-size: 11.5px; }

/* ── Play Status chips ── */
.sdt-saving-indicator { font-size: 11px; color: var(--color-text-muted); font-style: italic; }
.sdt-status-chips { display: flex; flex-wrap: wrap; gap: 5px; }
.sdt-status-chip {
  padding: 3px 10px;
  border-radius: var(--radius-full);
  border: 1px solid var(--color-border);
  background: var(--color-bg);
  color: var(--color-text-secondary);
  font-size: 11.5px;
  font-weight: 500;
  cursor: pointer;
  text-transform: capitalize;
  transition: background var(--transition-fast), color var(--transition-fast), border-color var(--transition-fast);
}
.sdt-status-chip:hover:not(:disabled) { background: var(--color-bg-tertiary); color: var(--color-text-primary); }
.sdt-status-chip--active {
  background: var(--color-accent-light);
  color: var(--color-accent);
  border-color: var(--color-accent-light);
}
.sdt-status-chip:disabled { opacity: 0.5; cursor: default; }

/* ── Tag chips ── */
.sdt-tag-chips { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 2px; }
.sdt-tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 9px;
  border-radius: var(--radius-full);
  border: 1px solid;
  font-size: 11.5px;
  font-weight: 500;
}
.sdt-tag-mood-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}
.sdt-tag-remove {
  margin-left: 2px;
  font-size: 13px;
  line-height: 1;
  background: none;
  border: none;
  cursor: pointer;
  color: inherit;
  opacity: 0.6;
  padding: 0 1px;
}
.sdt-tag-remove:hover { opacity: 1; }
.sdt-tag-picker {
  margin-top: var(--space-3);
  border-top: 1px solid var(--color-border-subtle);
  padding-top: var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.sdt-tag-picker-list {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  max-height: 120px;
  overflow-y: auto;
}
.sdt-tag-picker-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: var(--radius-full);
  border: 1px solid var(--color-border);
  background: var(--color-bg-secondary);
  font-size: 11.5px;
  font-weight: 500;
  cursor: pointer;
  transition: background var(--transition-fast);
}
.sdt-tag-picker-item:hover { background: var(--color-bg-tertiary); }
.sdt-tag-new { display: flex; gap: var(--space-2); }
.sdt-tag-new-input {
  flex: 1;
  padding: 5px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 12px;
  background: var(--color-bg);
  color: var(--color-text-primary);
  outline: none;
}
.sdt-tag-new-input:focus { border-color: var(--color-accent); }
.sdt-tag-new-btn {
  padding: 5px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background: var(--color-bg-secondary);
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: background var(--transition-fast);
}
.sdt-tag-new-btn:hover:not(:disabled) { background: var(--color-bg-tertiary); color: var(--color-text-primary); }
.sdt-tag-new-btn:disabled { opacity: 0.4; cursor: default; }

/* ── Achievement items (new layout) ── */
.sdt-ach-img-wrap {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: var(--color-bg-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
}
.sdt-ach-img {
  width: 32px;
  height: 32px;
  object-fit: cover;
  display: block;
}
.sdt-ach-icon-fb {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted);
  background: var(--color-bg-tertiary);
}
.sdt-ach-icon-fb--on {
  background: rgba(34,197,94,0.12);
  color: #16a34a;
}
.sdt-ach-item--on {
  background: rgba(34,197,94,0.04);
  border-color: rgba(34,197,94,0.18) !important;
}
.sdt-ach-desc {
  font-size: 11px;
  color: var(--color-text-muted);
  line-height: 1.35;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sdt-ach-sub {
  font-size: 10.5px;
  color: var(--color-text-muted);
}

/* ── Screenshots toolbar ── */
.sdt-ss-toolbar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  margin-bottom: var(--space-1);
}
.sdt-ss-open-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11.5px;
  font-weight: 500;
  color: var(--color-text-muted);
  background: none;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 4px 10px;
  cursor: pointer;
  transition: color var(--transition-fast), background var(--transition-fast);
}
.sdt-ss-open-btn:hover { color: var(--color-text-primary); background: var(--color-bg-tertiary); }

/* ── Empty state ── */
.sdt-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-8);
  color: var(--color-text-muted);
  font-size: 12.5px;
  text-align: center;
}

/* ── Cloud saves (new layout) ── */
.sdt-cloud-meta {
  font-size: 11px;
  color: var(--color-text-muted);
  white-space: nowrap;
  flex-shrink: 0;
}

/* ── Achievement toolbar (hidden toggle + edit mode) ── */
.sdt-ach-toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-1);
}
.sdt-ach-tool-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 500;
  padding: 3px 9px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background: var(--color-bg);
  color: var(--color-text-muted);
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transition: color var(--transition-fast), background var(--transition-fast), border-color var(--transition-fast);
}
.sdt-ach-tool-btn:hover { color: var(--color-text-primary); background: var(--color-bg-tertiary); }
.sdt-ach-tool-btn--on {
  color: var(--color-accent);
  border-color: var(--color-accent);
  background: var(--color-accent-light);
}
.sdt-ach-tool-btn--edit {
  color: #f59e0b;
  border-color: #f59e0b;
  background: rgba(245,158,11,0.08);
}

/* ── Achievement save bar ── */
.sdt-ach-save-bar {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: rgba(245,158,11,0.06);
  border: 1px solid rgba(245,158,11,0.25);
  border-radius: var(--radius-sm);
  margin-bottom: var(--space-1);
}
.sdt-ach-save-error {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11.5px;
  color: var(--color-danger);
  flex: 1;
  min-width: 0;
}
.sdt-ach-save-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  font-weight: 500;
  padding: 5px 12px;
  border-radius: var(--radius-sm);
  border: none;
  background: var(--color-accent);
  color: #fff;
  cursor: pointer;
  flex-shrink: 0;
  margin-left: auto;
  transition: opacity var(--transition-fast);
}
.sdt-ach-save-btn:disabled { opacity: .55; cursor: not-allowed; }
.sdt-ach-save-btn:not(:disabled):hover { opacity: 0.88; }

/* ── Achievement item — editable state ── */
.sdt-ach-item--editable {
  cursor: pointer;
}
.sdt-ach-item--editable:hover {
  border-color: #f59e0b !important;
  background: rgba(245,158,11,0.06) !important;
}
.sdt-ach-img--locked { opacity: 0.4; filter: grayscale(1); }
.sdt-ach-icon-fb--hidden {
  background: var(--color-bg-tertiary);
  color: var(--color-text-muted);
  opacity: 0.5;
}

/* ── Achievement edit toggle checkbox ── */
.sdt-ach-edit-check {
  width: 20px;
  height: 20px;
  border-radius: var(--radius-sm);
  border: 1.5px solid var(--color-border);
  background: var(--color-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted);
  flex-shrink: 0;
  transition: background var(--transition-fast), border-color var(--transition-fast), color var(--transition-fast);
}
.sdt-ach-edit-check--on {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: #fff;
}

`;
