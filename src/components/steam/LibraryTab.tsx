/**
 * Library tab for the Steam hub page.
 *
 * Shows a collapsible sidebar of Steam collections and a main panel
 * displaying games in grid or list view. A slide-in detail drawer appears
 * when a game is selected.
 */
import { useState, useRef, useEffect } from "react";
import {
  RefreshCw, AlertCircle, Gamepad2, Search, LayoutGrid, List,
  PanelLeftClose, PanelLeftOpen, X,
} from "lucide-react";
import {
  steamLaunchGame, steamInstallGame, itemSetFavorite, SteamGameDbInfo,
} from "@/services/tauriCommands";
import { SteamGame, SteamScanResult } from "@/types/steam";
import { CollectionGroup } from "@/utils/steamFormatters";
import GameCard from "./GameCard";
import GameRow from "./GameRow";
import DetailDrawer from "./DetailDrawer";

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

/**
 * Steam library tab with sidebar collections, game grid/list, and detail drawer.
 * Auto-selects the first collection on load and can auto-open a drawer for a
 * specific game when navigated from the home page favorites.
 */
export default function LibraryTab({ scanning, groups, scanError, scanResult, gameDbInfo, onSeeDetails, onFavoriteChanged, openItemId }: LibraryTabProps) {
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
    return (
      <div className="sp-state-screen">
        <div className="sp-state-icon sp-state-icon--spin">
          <RefreshCw size={22} />
        </div>
        <p className="sp-state-title">Scanning Steam library…</p>
        <p className="sp-state-sub">Reading your game data from disk</p>
      </div>
    );
  }

  if (scanError && !scanResult) {
    return (
      <div className="sp-state-screen">
        <div className="sp-state-icon sp-state-icon--error">
          <AlertCircle size={22} />
        </div>
        <p className="sp-state-title">Could not read Steam library</p>
        <p className="sp-state-sub">Make sure Steam is installed and has been run at least once.</p>
      </div>
    );
  }

  if (groups.length === 0 && scanResult) {
    return (
      <div className="sp-state-screen">
        <div className="sp-state-icon">
          <Gamepad2 size={22} />
        </div>
        <p className="sp-state-title">No games found</p>
        <p className="sp-state-sub">Make sure Steam is installed and has been run at least once.</p>
      </div>
    );
  }

  const currentGroup = groups.find((g) => g.name === selectedGroup) ?? null;
  const filteredGames = currentGroup
    ? currentGroup.games.filter((g) =>
        g.name.toLowerCase().includes(search.toLowerCase())
      )
    : [];

  const totalInstalled = scanResult?.games.filter((g) => g.is_installed).length ?? 0;
  const totalGames = scanResult?.games.length ?? 0;
  const hasDrawer = detail !== null;

  return (
    <div className="sp-library">
      {/* ── Sidebar ── */}
      <aside className={`sp-sidebar ${sidebarCollapsed ? "sp-sidebar--collapsed" : ""}`}>
        <div className="sp-sidebar-header">
          {!sidebarCollapsed && (
            <>
              <span className="sp-sidebar-label">Collections</span>
              <span className="sp-sidebar-count">{groups.length}</span>
            </>
          )}
          <button
            className="sp-sidebar-toggle"
            onClick={() => setSidebarCollapsed((v) => !v)}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed
              ? <PanelLeftOpen size={14} />
              : <PanelLeftClose size={14} />
            }
          </button>
        </div>
        <nav className="sp-sidebar-nav">
          {groups.map((g) => {
            const installedCount = g.games.filter((x) => x.is_installed).length;
            const firstLogoImg = g.games.find((x) => x.icon_url)?.icon_url ?? null;
            const isActive = selectedGroup === g.name;
            return (
              <button
                key={g.name}
                className={`sp-sidebar-item ${isActive ? "sp-sidebar-item--active" : ""}`}
                onClick={() => { setSelectedGroup(g.name); setDetail(null); setSearch(""); }}
                title={sidebarCollapsed ? g.name : undefined}
              >
                {/* Collapsed: small square with logo; expanded: logo on dark background */}
                {sidebarCollapsed ? (
                  <div className="sp-sidebar-mosaic sp-sidebar-mosaic--icon">
                    {firstLogoImg ? (
                      <img
                        src={firstLogoImg}
                        alt=""
                        className="sp-sidebar-mosaic-img-logo"
                        loading="lazy"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    ) : (
                      <Gamepad2 size={12} />
                    )}
                  </div>
                ) : (
                  <div className="sp-sidebar-item-inner">
                    <div className="sp-sidebar-logo-thumb">
                      {firstLogoImg ? (
                        <img
                          src={firstLogoImg}
                          alt=""
                          className="sp-sidebar-logo-thumb-img"
                          loading="lazy"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                      ) : (
                        <Gamepad2 size={12} />
                      )}
                    </div>
                    <div className="sp-sidebar-item-info">
                      <span className="sp-sidebar-item-name">{g.name}</span>
                      <span className="sp-sidebar-item-meta">{installedCount}/{g.games.length}</span>
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </nav>

        {/* Stats footer */}
        {!sidebarCollapsed && (
          <div className="sp-sidebar-footer">
            <div className="sp-sidebar-stat">
              <span className="sp-sidebar-stat-val">{totalInstalled}</span>
              <span className="sp-sidebar-stat-label">installed</span>
            </div>
            <div className="sp-sidebar-stat-divider" />
            <div className="sp-sidebar-stat">
              <span className="sp-sidebar-stat-val">{totalGames}</span>
              <span className="sp-sidebar-stat-label">total</span>
            </div>
          </div>
        )}
      </aside>

      {/* ── Main panel ── */}
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
            {/* Main panel toolbar */}
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

            {/* Games */}
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
                    eager={i < 30}
                    onOpen={(e) => { e.stopPropagation(); setDetail(detail?.app_id === game.app_id ? null : game); }}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {/* ── Detail drawer ── */}
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
