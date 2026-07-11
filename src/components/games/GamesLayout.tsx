/**
 * Shared shell for the Games area (`/games` and `/collections/:id`): supplies a
 * collapsible "Unfiled" column and the filing operation to any child route via
 * context, so games can be dragged between the content and the column without
 * the underlying data/collapse state being lost on navigation.
 *
 * The panel is rendered by each child *inside* its body region (below the
 * header) via `<UnfiledColumn/>`, so the header stays full width. The panel's
 * data and collapsed state live here, so they persist across navigation.
 */
import { createContext, useContext, useState, useCallback, useRef } from "react";
import { Outlet } from "react-router-dom";
import UnfiledPanel from "./UnfiledPanel";
import { useUngrouped } from "@/hooks/useUngrouped";

interface GamesAreaContext {
  /** Files a game into a collection (or unfiles when collectionId is null). */
  fileGame: (itemId: string, collectionId: string | null) => Promise<void>;
  /** Register a callback invoked after any filing change, to reload content. */
  onReload: (cb: () => void) => () => void;
  /** Whether the unfiled column is collapsed. */
  collapsed: boolean;
  /** Renders the shared unfiled column; place inside the child's body region. */
  UnfiledColumn: () => JSX.Element;
}

const Ctx = createContext<GamesAreaContext | null>(null);

/** Access the shared games-area operations from a child route. */
export function useGamesArea(): GamesAreaContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useGamesArea must be used within GamesLayout");
  return ctx;
}

/**
 * Provides the shared unfiled-column state and filing operation to child routes.
 */
export default function GamesLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const unfiled = useUngrouped();
  const reloadCbs = useRef(new Set<() => void>());

  const onReload = useCallback((cb: () => void) => {
    reloadCbs.current.add(cb);
    return () => reloadCbs.current.delete(cb);
  }, []);

  const fileGame = useCallback(
    async (itemId: string, collectionId: string | null) => {
      await unfiled.fileInto(itemId, collectionId);
      await unfiled.refresh();
      reloadCbs.current.forEach((cb) => cb());
    },
    [unfiled],
  );

  const UnfiledColumn = useCallback(
    () => (
      <UnfiledPanel
        games={unfiled.games}
        loading={unfiled.loading}
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((c) => !c)}
        onFileGame={fileGame}
      />
    ),
    [unfiled.games, unfiled.loading, collapsed, fileGame],
  );

  return (
    <Ctx.Provider value={{ fileGame, onReload, collapsed, UnfiledColumn }}>
      <Outlet />
    </Ctx.Provider>
  );
}
