/**
 * Lifecycle hook for the tray-menu popup window.
 *
 * Listens for the backend's "tray-menu:open" event, refreshes the recent
 * games list, and — once the new content has been laid out — reports the
 * measured size back so Rust can position and show the window. Also owns
 * the menu actions (launch / open main / quit) and Escape-to-dismiss.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import {
  trayGetRecentGames,
  trayLaunchItem,
  trayMenuHide,
  trayMenuPresent,
  trayOpenMain,
  trayQuit,
  TrayRecentGame,
} from "@/services/tauriCommands";

/** Must match `TRAY_MENU_OPEN_EVENT` in `src-tauri/src/tray.rs`. */
const OPEN_EVENT = "tray-menu:open";

/** Everything the tray-menu UI needs from the popup lifecycle. */
export interface TrayMenuController {
  /** Recent games, refreshed on every open. */
  games: TrayRecentGame[];
  /** Increments on every open; keys the entrance animation replay. */
  openCount: number;
  /** Attach to the menu frame — its measured size is sent to the backend. */
  frameRef: React.RefObject<HTMLDivElement>;
  /** Hides the menu and launches the game (fire-and-forget). */
  launch: (itemId: string) => void;
  /** Hides the menu and opens/focuses the main window. */
  openMain: () => void;
  /** Quits the application. */
  quit: () => void;
}

/**
 * Wires the popup window to the tray: open events in, measurements and
 * actions out.
 */
export function useTrayMenu(): TrayMenuController {
  const [games, setGames] = useState<TrayRecentGame[]>([]);
  const [openCount, setOpenCount] = useState(0);
  const frameRef = useRef<HTMLDivElement>(null);

  // Refresh data on every open request from the tray.
  useEffect(() => {
    const unlisten = listen(OPEN_EVENT, async () => {
      try {
        setGames(await trayGetRecentGames());
      } catch {
        // A degraded menu (Open / Quit only) beats no menu at all.
        setGames([]);
      }
      setOpenCount((c) => c + 1);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  // After the refreshed content is committed (before paint), measure the
  // frame and let the backend size, position, and show the window.
  useLayoutEffect(() => {
    if (openCount === 0) return;
    const el = frameRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    trayMenuPresent(Math.ceil(rect.width), Math.ceil(rect.height)).catch(() => {
      // Window handle missing — nothing sensible to do from inside it.
    });
  }, [openCount]);

  // Escape dismisses, like a native menu.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") trayMenuHide().catch(() => {});
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const launch = useCallback((itemId: string) => {
    trayMenuHide().catch(() => {});
    trayLaunchItem(itemId).catch(() => {});
  }, []);

  const openMain = useCallback(() => {
    trayMenuHide().catch(() => {});
    trayOpenMain().catch(() => {});
  }, []);

  const quit = useCallback(() => {
    trayQuit().catch(() => {});
  }, []);

  return { games, openCount, frameRef, launch, openMain, quit };
}
