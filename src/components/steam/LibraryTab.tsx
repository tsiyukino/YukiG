/**
 * Library tab for the Steam hub page.
 *
 * Shows a collapsible sidebar of Steam collections and a main panel
 * displaying games in grid or list view. A slide-in detail drawer appears
 * when a game is selected.
 */
import { useState, useRef, useEffect } from "react";
import {
  RefreshCw, AlertCircle, Gamepad2, Search, LayoutGrid, List, X,
} from "lucide-react";
import {
  steamLaunchGame, steamInstallGame, itemSetFavorite, SteamGameDbInfo,
} from "@/services/tauriCommands";
import { SteamGame, SteamScanResult } from "@/types/steam";
import { CollectionGroup } from "@/utils/steamFormatters";
import GameCard from "./GameCard";
import GameRow from "./GameRow";
import DetailDrawer from "./DetailDrawer";
import LibrarySidebar from "./LibrarySidebar";
import { useSteamRunningApp } from "@/hooks/useSteamRunningApp";

/** View mode for the games panel. */
type ViewMode = "grid" | "list";

interface LibraryTabProps {
  /** Whether the Steam library scan is currently in progress. */
  scanning: boolean;
  /** Grouped games list produced by buildGroups(). */
  groups: CollectionGroup[];
  /** Error message from the last scan attempt, or null. */
  scanError: string | null;
  /** Full scan result, or null if not yet loaded. */
  scanResult: SteamScanResult | null;
  /** DB metadata keyed by app_id, used for favorites. */
  gameDbInfo: Record<number, SteamGameDbInfo>;
  /** Called when the user clicks "See Details" in the drawer. */
  onSeeDetails: (game: SteamGame) => void;
  /** Called after a favorite toggle succeeds so the parent can sync state. */
  onFavoriteChanged: (appId: number, isFavorite: boolean) => void;
  /** item_id of a Steam game to auto-open in the drawer on load. */
  openItemId?: string | null;
}

/** Full-screen status placeholder (scanning / error / empty). */
function StateScreen({ icon, title, sub, spin, error }: {
  icon: React.ReactNode; title: string; sub: string; spin?: boolean; error?: boolean;
}) {
  return (
    <div className="sp-state-screen">
      <div className={`sp-state-icon ${spin ? "sp-state-icon--spin" : ""} ${error ? "sp-state-icon--error" : ""}`}>
        {icon}
      </div>
      <p className="sp-state-title">{title}</p>
      <p className="sp-state-sub">{sub}</p>
    </div>
  );
}

/**
 * Steam library tab with sidebar collections, game grid/list, and detail drawer.
 * Auto-selects the first collection on load and can auto-open a drawer for a
 * specific game when navigated from the home page favorites.
 */
export default function LibraryTab({ scanning, groups, scanError, scanResult, gameDbInfo, onSeeDetails, onFavoriteChanged, openItemId }: LibraryTabProps) {
  const runningAppId = useSteamRunningApp();
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [detail, setDetail] = useState<SteamGame | null>(null);
  const [launching, setLaunching] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const openHandledRef = useRef(false);

  // Auto-select first group once loaded
  useEffect(() => {
    if (groups.length > 0 && selectedGroup === null) {
      setSelectedGroup(groups[0].name);
    }
  }, [groups, selectedGroup]);

  // Auto-open drawer when navigating from a Steam favorite on the home page.
  useEffect(() => {
    if (!openItemId || scanning || !scanResult || openHandledRef.current) return;
    // Find the app_id whose item_id matches the requested item.
    const entry = Object.entries(gameDbInfo).find(([, v]) => v.item_id === openItemId);
    if (!entry) return;
    const appId = Number(entry[0]);
    const game = scanResult.games.find((g) => g.app_id === appId) ?? null;
    if (!game) return;
    openHandledRef.current = true;
    // Switch to the Steam collection that contains this game (first match).
    const group = groups.find((g) => g.games.some((gm) => gm.app_id === appId));
    if (group) setSelectedGroup(group.name);
    setDetail(game);
  }, [openItemId, scanning, scanResult, gameDbInfo, groups]);

  async function handleLaunch(appId: number) {
    setLaunching(true);
    setLaunchError(null);
    try { await steamLaunchGame(appId); }
    catch (e) { setLaunchError(String(e)); }
    finally { setLaunching(false); }
  }

  async function handleInstall(appId: number) {
    try { await steamInstallGame(appId); }
    catch (e) { setLaunchError(String(e)); }
  }

  async function handleToggleFavorite(appId: number) {
    const info = gameDbInfo[appId];
    if (!info) return;
    const newVal = !info.is_favorite;
    try {
      await itemSetFavorite(info.item_id, newVal);
      onFavoriteChanged(appId, newVal);
    } catch (_) {
      // Non-fatal — UI stays unchanged on failure.
    }
  }

  if (scanning) {
    return <StateScreen icon={<RefreshCw size={22} />} spin
      title="Scanning Steam library…" sub="Reading your game data from disk" />;
  }
  if (scanError && !scanResult) {
    return <StateScreen icon={<AlertCircle size={22} />} error
      title="Could not read Steam library" sub="Make sure Steam is installed and has been run at least once." />;
  }
  if (groups.length === 0 && scanResult) {
    return <StateScreen icon={<Gamepad2 size={22} />}
      title="No games found" sub="Make sure Steam is installed and has been run at least once." />;
  }

  const currentGroup = groups.find((g) => g.name === selectedGroup) ?? null;
  const filteredGames = currentGroup
    ? currentGroup.games.filter((g) => g.name.toLowerCase().includes(search.toLowerCase()))
    : [];

  const hasDrawer = detail !== null;

  return (
    <div className="sp-library">
      <LibrarySidebar
        groups={groups}
        selectedGroup={selectedGroup}
        onSelect={(name) => { setSelectedGroup(name); setDetail(null); setSearch(""); }}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((v) => !v)}
        totalInstalled={scanResult?.games.filter((g) => g.is_installed).length ?? 0}
        totalGames={scanResult?.games.length ?? 0}
      />

      {/* Clicking the main panel background (not a game card) closes the drawer */}
      <main className="sp-main" onClick={detail ? () => setDetail(null) : undefined}>
        {launchError && (
          <div className="sp-error-banner">
            <AlertCircle size={13} />
            {launchError}
            <button className="sp-error-dismiss" onClick={() => setLaunchError(null)}>
              <X size={12} />
            </button>
          </div>
        )}

        {currentGroup && (
          <>
            <div className="sp-main-toolbar">
              <div className="sp-main-toolbar-left">
                <h2 className="sp-main-title">{currentGroup.name}</h2>
                <span className="sp-main-subtitle">
                  {filteredGames.length} {filteredGames.length === 1 ? "game" : "games"}
                </span>
              </div>
              <div className="sp-main-toolbar-right">
                <div className="sp-search-wrap">
                  <Search size={13} className="sp-search-icon" />
                  <input
                    className="sp-search"
                    placeholder="Search…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  {search && (
                    <button className="sp-search-clear" onClick={() => setSearch("")}>
                      <X size={11} />
                    </button>
                  )}
                </div>
                <div className="sp-view-toggle">
                  <button
                    className={`sp-view-btn ${viewMode === "grid" ? "sp-view-btn--active" : ""}`}
                    onClick={() => setViewMode("grid")}
                    title="Grid view"
                  >
                    <LayoutGrid size={13} />
                  </button>
                  <button
                    className={`sp-view-btn ${viewMode === "list" ? "sp-view-btn--active" : ""}`}
                    onClick={() => setViewMode("list")}
                    title="List view"
                  >
                    <List size={13} />
                  </button>
                </div>
              </div>
            </div>

            {filteredGames.length === 0 ? (
              <div className="sp-empty">
                <Search size={20} />
                <p>No games match "{search}"</p>
              </div>
            ) : viewMode === "grid" ? (
              <div className={`sp-game-grid ${hasDrawer ? "sp-game-grid--narrow" : ""}`}>
                {filteredGames.map((game, i) => (
                  <GameCard
                    key={game.app_id}
                    game={game}
                    isSelected={detail?.app_id === game.app_id}
                    isFavorite={gameDbInfo[game.app_id]?.is_favorite ?? false}
                    isPlaying={runningAppId === game.app_id}
                    eager={i < 20}
                    onOpen={(e) => { e.stopPropagation(); setDetail(detail?.app_id === game.app_id ? null : game); }}
                  />
                ))}
              </div>
            ) : (
              <div className="sp-game-list">
                {filteredGames.map((game, i) => (
                  <GameRow
                    key={game.app_id}
                    game={game}
                    isSelected={detail?.app_id === game.app_id}
                    isFavorite={gameDbInfo[game.app_id]?.is_favorite ?? false}
                    isPlaying={runningAppId === game.app_id}
                    eager={i < 30}
                    onOpen={(e) => { e.stopPropagation(); setDetail(detail?.app_id === game.app_id ? null : game); }}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {detail && (
        <DetailDrawer
          game={detail}
          onClose={() => setDetail(null)}
          onLaunch={() => handleLaunch(detail.app_id)}
          onInstall={() => handleInstall(detail.app_id)}
          onDetail={() => onSeeDetails(detail)}
          launching={launching}
          isFavorite={gameDbInfo[detail.app_id]?.is_favorite ?? false}
          onToggleFavorite={() => handleToggleFavorite(detail.app_id)}
        />
      )}
    </div>
  );
}
