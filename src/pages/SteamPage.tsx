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
// Feature-wide stylesheet for all steam/ components (sp-* and sdt-* classes).
// Global by design for now — see docs/decisions/2026-07-06_steam-css-exception.md.
import "@/components/steam/steam.css";

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

    </div>
  );
}
