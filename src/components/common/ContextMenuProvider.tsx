/**
 * Owns the single open context menu for the app: which entries it shows
 * and where. Also suppresses the native (WebView2) context menu globally,
 * so right-click is exclusively the custom menu system.
 */
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import ContextMenu, { MenuContent } from "./ContextMenu";

/** What consumers get: an opener to call from onContextMenu handlers. */
export interface ContextMenuApi {
  /** Opens the menu at the event's cursor position with the given entries. */
  open: (e: React.MouseEvent, entries: MenuContent) => void;
}

const ContextMenuContext = createContext<ContextMenuApi | null>(null);

interface OpenMenu {
  x: number;
  y: number;
  entries: MenuContent;
}

/**
 * Mounts once around the app shell. Renders the currently open menu (if
 * any) and provides `useContextMenu` to every component below it.
 */
export function ContextMenuProvider({ children }: { children: ReactNode }) {
  const [menu, setMenu] = useState<OpenMenu | null>(null);

  // Kill the native context menu everywhere. Elements with a custom menu
  // call `open`, which stops propagation — this stays the fallback for
  // everything that doesn't.
  useEffect(() => {
    const suppress = (e: Event) => e.preventDefault();
    document.addEventListener("contextmenu", suppress);
    return () => document.removeEventListener("contextmenu", suppress);
  }, []);

  const open = useCallback((e: React.MouseEvent, entries: MenuContent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenu({ x: e.clientX, y: e.clientY, entries });
  }, []);

  const close = useCallback(() => setMenu(null), []);

  const api = useMemo(() => ({ open }), [open]);

  return (
    <ContextMenuContext.Provider value={api}>
      {children}
      {menu && (
        <ContextMenu x={menu.x} y={menu.y} entries={menu.entries} onClose={close} />
      )}
    </ContextMenuContext.Provider>
  );
}

/**
 * Returns the context-menu opener for attaching per-element menus.
 *
 * @throws {Error} If called outside a ContextMenuProvider.
 */
export function useContextMenu(): ContextMenuApi {
  const api = useContext(ContextMenuContext);
  if (!api) {
    throw new Error("useContextMenu must be used within ContextMenuProvider");
  }
  return api;
}
