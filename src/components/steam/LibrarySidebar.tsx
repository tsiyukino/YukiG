/**
 * Collections sidebar for the Steam library tab, patterned on the Steam client:
 * a global search box on top, then collections as expandable (+/−) groups whose
 * rows are icon+name game entries. Clicking a collection header shows its cards
 * in the main panel; clicking a game row opens that game directly.
 * Styles come from the steam feature stylesheet (sp-*).
 */
import { useState } from "react";
import { Gamepad2, Minus, Plus, Search, X } from "lucide-react";
import { SteamLibItem } from "@/types/steam";
import { CollectionGroup } from "@/utils/steamFormatters";

interface LibrarySidebarProps {
  groups: CollectionGroup[];
  /** Name of the collection whose cards are shown in the main panel. */
  selectedGroup: string | null;
  onSelectGroup: (name: string) => void;
  /** Called when a game row is clicked (opens the game's detail). */
  onSelectGame: (game: SteamLibItem) => void;
  /** Global search text — filters the whole library, not just one collection. */
  search: string;
  onSearchChange: (value: string) => void;
  /** App id of the currently running game (0 = none), for the playing dot. */
  runningAppId: number;
  totalInstalled: number;
  totalGames: number;
}

/**
 * Renders the search box, expandable collection groups, and a stats footer.
 */
export default function LibrarySidebar({
  groups, selectedGroup, onSelectGroup, onSelectGame,
  search, onSearchChange, runningAppId, totalInstalled, totalGames,
}: LibrarySidebarProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const searching = search.trim().length > 0;
  const query = search.trim().toLowerCase();

  function toggleExpanded(name: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  // While searching, groups collapse to their matching games and all stay open,
  // so every hit is visible without extra clicks (Steam client behaviour).
  const visibleGroups = searching
    ? groups
        .map((g) => ({ ...g, games: g.games.filter((x) => x.name.toLowerCase().includes(query)) }))
        .filter((g) => g.games.length > 0)
    : groups;

  return (
    <aside className="sp-sidebar">
      <div className="sp-sidebar-search">
        <Search size={12} className="sp-sidebar-search-icon" />
        <input
          className="sp-sidebar-search-input"
          placeholder="Search library…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        {search && (
          <button
            className="sp-sidebar-search-clear"
            onClick={() => onSearchChange("")}
            title="Clear search"
          >
            <X size={11} />
          </button>
        )}
      </div>

      <nav className="sp-sidebar-nav">
        {searching && visibleGroups.length === 0 && (
          <div className="sp-sidebar-empty">No games match "{search.trim()}"</div>
        )}
        {visibleGroups.map((g) => {
          const isOpen = searching || expanded.has(g.name);
          const isActive = !searching && selectedGroup === g.name;
          return (
            <div key={g.name} className="sp-group">
              <div className={`sp-group-header ${isActive ? "sp-group-header--active" : ""}`}>
                <button
                  className="sp-group-toggle"
                  onClick={() => toggleExpanded(g.name)}
                  title={isOpen ? "Collapse" : "Expand"}
                  disabled={searching}
                >
                  {isOpen ? <Minus size={10} /> : <Plus size={10} />}
                </button>
                <button className="sp-group-select" onClick={() => onSelectGroup(g.name)}>
                  <span className="sp-group-name">{g.name}</span>
                  <span className="sp-group-count">{g.games.length}</span>
                </button>
              </div>

              {isOpen && (
                <div className="sp-group-games">
                  {g.games.map((game) => (
                    <button
                      key={game.app_id}
                      className="sp-game-row"
                      onClick={() => onSelectGame(game)}
                      title={game.name}
                    >
                      <span className="sp-game-row-icon">
                        {game.icon_url ? (
                          <img
                            src={game.icon_url}
                            alt=""
                            loading="lazy"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                          />
                        ) : (
                          <Gamepad2 size={11} />
                        )}
                      </span>
                      <span className={`sp-game-row-name ${!game.is_installed ? "sp-game-row-name--off" : ""}`}>
                        {game.name}
                      </span>
                      {runningAppId === game.app_id && (
                        <span className="sp-game-row-dot" title="Playing now" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

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
    </aside>
  );
}
