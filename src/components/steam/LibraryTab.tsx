/**
 * Library tab for the Steam hub page.
 *
 * A Steam-client-style sidebar (global search on top, collections as
 * expandable groups of icon+name game rows) next to a main panel showing the
 * selected collection's games in grid or list view. While the sidebar search
 * is active the main panel shows matches from the whole library. A slide-in
 * detail drawer appears when a game is selected.
 */
import { useState, useRef, useEffect } from "react";
import {
  RefreshCw, AlertCircle, ArrowLeft, Download, Gamepad2, Heart, Info,
  LayoutGrid, List, Monitor, Play, Search, Trash2,
} from "lucide-react";
import {
  itemSetFavorite, itemDelete, steamLaunchGame, steamInstallGame, steamOpenInApp,
} from "@/services/tauriCommands";
import { SteamLibItem, SteamScanResult } from "@/types/steam";
import { CollectionGroup } from "@/utils/steamFormatters";
import { useContextMenu } from "@/components/common/ContextMenuProvider";
import { MenuContent } from "@/components/common/ContextMenu";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import GameCard from "./GameCard";
import GameRow from "./GameRow";
import GameDetailTab from "./GameDetailTab";
import LibrarySidebar from "./LibrarySidebar";
import { useSteamRunningApp } from "@/hooks/useSteamRunningApp";

/** View mode for the games panel. */
type ViewMode = "grid" | "list";

interface LibraryTabProps {
  /** Whether the library is still loading (initial DB read or a scan). */
  loading: boolean;
  /** Grouped games list produced by buildGroups() from the library. */
  groups: CollectionGroup[];
  /** The flat library game list, for sidebar stats and favourite state. */
  libGames: SteamLibItem[];
  /** Error message from the last load, or null. */
  error: string | null;
  /** Full scan result — the detail view still renders from the scanned game
   *  (unified in a later slice), resolved by app id. */
  scanResult: SteamScanResult | null;
  /** Re-reads the library from the DB after a favourite toggle. */
  onReload: () => void;
  /** item_id of a Steam game to auto-open in detail on load. */
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
export default function LibraryTab({ loading, groups, libGames, error, scanResult, onReload, openItemId }: LibraryTabProps) {
  const runningAppId = useSteamRunningApp();
  const menu = useContextMenu();
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [detailGame, setDetailGame] = useState<SteamLibItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SteamLibItem | null>(null);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const openHandledRef = useRef(false);

  // Auto-select first group once loaded
  useEffect(() => {
    if (groups.length > 0 && selectedGroup === null) {
      setSelectedGroup(groups[0].name);
    }
  }, [groups, selectedGroup]);

  // Re-resolve the open game from the fresh library list so favourite toggles
  // (which reload the list) are reflected without reopening the detail.
  const detailLive = detailGame
    ? libGames.find((g) => g.id === detailGame.id) ?? detailGame
    : null;

  function closeDetail() {
    setDetailGame(null);
  }

  // Esc returns from the detail view to the collection cards.
  useEffect(() => {
    if (!detailGame) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDetailGame(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detailGame]);

  // Auto-open a game's detail when navigating from the home page favorites.
  useEffect(() => {
    if (!openItemId || loading || openHandledRef.current) return;
    const libGame = libGames.find((g) => g.id === openItemId);
    if (!libGame) return;
    openHandledRef.current = true;
    // Switch to the collection that contains this game (first match).
    const group = groups.find((g) => g.games.some((gm) => gm.id === openItemId));
    if (group) setSelectedGroup(group.name);
    setDetailGame(libGame);
  }, [openItemId, loading, libGames, groups]);

  async function handleToggleFavorite(game: SteamLibItem) {
    try {
      await itemSetFavorite(game.id, !game.is_favorite);
      onReload();
    } catch (_) {
      // Non-fatal — UI stays unchanged on failure.
    }
  }

  async function handleDelete(game: SteamLibItem) {
    setDeleteTarget(null);
    try {
      await itemDelete(game.id);
      if (detailGame?.id === game.id) setDetailGame(null);
      onReload();
    } catch (_) {
      // Non-fatal — UI stays unchanged on failure.
    }
  }

  /** Right-click menu for a game card/row — launch first, like the Steam client. */
  function gameMenu(game: SteamLibItem): MenuContent {
    return [
      game.is_installed
        ? { id: "play", label: "Play", icon: Play, onSelect: () => steamLaunchGame(game.app_id).catch(() => {}) }
        : { id: "install", label: "Install", icon: Download, onSelect: () => steamInstallGame(game.app_id).catch(() => {}) },
      { id: "steam", label: "Open in Steam", icon: Monitor, onSelect: () => steamOpenInApp(game.app_id).catch(() => {}) },
      "separator",
      { id: "detail", label: "View Details", icon: Info, onSelect: () => setDetailGame(game) },
      {
        id: "fav",
        label: game.is_favorite ? "Remove from Favorites" : "Add to Favorites",
        icon: Heart,
        onSelect: () => handleToggleFavorite(game),
      },
      "separator",
      { id: "delete", label: "Delete from library", icon: Trash2, danger: true, onSelect: () => setDeleteTarget(game) },
    ];
  }

  if (loading && libGames.length === 0) {
    return <StateScreen icon={<RefreshCw size={22} />} spin
      title="Loading Steam library…" sub="Reading your games" />;
  }
  if (error && libGames.length === 0) {
    return <StateScreen icon={<AlertCircle size={22} />} error
      title="Could not read Steam library" sub="Make sure Steam is installed and has been synced at least once." />;
  }
  if (groups.length === 0) {
    return <StateScreen icon={<Gamepad2 size={22} />}
      title="No games found" sub="Sync your Steam library to see your games here." />;
  }

  // Sidebar search is global: while active, the main panel shows matches from
  // the whole library instead of the selected collection.
  const searching = search.trim().length > 0;
  const query = search.trim().toLowerCase();
  const currentGroup = groups.find((g) => g.name === selectedGroup) ?? null;
  const shownGames = searching
    ? libGames.filter((g) => g.name.toLowerCase().includes(query))
    : currentGroup?.games ?? [];
  const panelTitle = searching ? "Search Results" : currentGroup?.name ?? "";

  return (
    <div className="sp-library">
      <LibrarySidebar
        groups={groups}
        selectedGroup={selectedGroup}
        onSelectGroup={(name) => { setSelectedGroup(name); closeDetail(); setSearch(""); }}
        onSelectGame={(game) => setDetailGame(game)}
        activeAppId={detailLive?.app_id ?? null}
        search={search}
        onSearchChange={setSearch}
        runningAppId={runningAppId}
        totalInstalled={libGames.filter((g) => g.is_installed).length}
        totalGames={libGames.length}
      />

      <main className="sp-main">
        {detailLive ? (
          <DetailPane
            game={detailLive}
            scanResult={scanResult}
            onBack={closeDetail}
            onChanged={onReload}
          />
        ) : (
        <>
        {(currentGroup || searching) && (
          <>
            <div className="sp-main-toolbar">
              <div className="sp-main-toolbar-left">
                <h2 className="sp-main-title">{panelTitle}</h2>
                <span className="sp-main-subtitle">
                  {shownGames.length} {shownGames.length === 1 ? "game" : "games"}
                </span>
              </div>
              <div className="sp-main-toolbar-right">
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

            {shownGames.length === 0 ? (
              <div className="sp-empty">
                <Search size={20} />
                <p>No games match "{search}"</p>
              </div>
            ) : viewMode === "grid" ? (
              <div className="sp-game-grid">
                {shownGames.map((game, i) => (
                  <GameCard
                    key={game.app_id}
                    game={game}
                    isFavorite={game.is_favorite}
                    isPlaying={runningAppId === game.app_id}
                    eager={i < 20}
                    onOpen={() => setDetailGame(game)}
                    onContextMenu={(e) => menu.open(e, gameMenu(game))}
                  />
                ))}
              </div>
            ) : (
              <div className="sp-game-list">
                {shownGames.map((game, i) => (
                  <GameRow
                    key={game.app_id}
                    game={game}
                    isFavorite={game.is_favorite}
                    isPlaying={runningAppId === game.app_id}
                    eager={i < 30}
                    onOpen={() => setDetailGame(game)}
                    onContextMenu={(e) => menu.open(e, gameMenu(game))}
                  />
                ))}
              </div>
            )}
          </>
        )}
        </>
        )}
      </main>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete from library?"
        message={deleteTarget ? `"${deleteTarget.name}" will be removed from YukiG. The game itself stays in your Steam library and will come back on the next sync unless it is gone from Steam.` : ""}
        onConfirm={() => { if (deleteTarget) handleDelete(deleteTarget); }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

/**
 * The in-page detail view: a floating Back button over the scrolling detail
 * content. The content still renders from the scanned SteamGame (resolved by
 * app id) until the detail layout is unified.
 */
function DetailPane({ game, scanResult, onBack, onChanged }: {
  game: SteamLibItem;
  scanResult: SteamScanResult | null;
  onBack: () => void;
  onChanged: () => void;
}) {
  const scanned = scanResult?.games.find((g) => g.app_id === game.app_id) ?? null;

  return (
    <div className="sp-detail-pane">
      <button className="sp-detail-back" onClick={onBack} title="Back to collection (Esc)">
        <ArrowLeft size={14} />
        Back
      </button>

      {scanned ? (
        <GameDetailTab
          game={scanned}
          item={game}
          onChanged={onChanged}
          onDeleted={() => { onBack(); onChanged(); }}
        />
      ) : (
        <StateScreen
          icon={<AlertCircle size={22} />}
          title="Details unavailable"
          sub="Run a sync so the Steam scan can provide this game's full data."
        />
      )}
    </div>
  );
}
