/**
 * Root of the tray-menu popup window (the `?window=tray` entry in main.tsx).
 *
 * Marks the document as a tray window (global.css makes the body
 * transparent), re-applies the stored theme on every open so the popup
 * follows theme changes made in the main window, and wires the menu UI
 * to the popup lifecycle.
 */
import { useEffect } from "react";
import TrayMenu from "./TrayMenu";
import { useTrayMenu } from "./useTrayMenu";

/** Tray popup window root — no router, no AppShell. */
export default function TrayMenuApp() {
  const { games, openCount, frameRef, launch, openMain, quit } = useTrayMenu();

  // Only the styled panel should paint; global.css keys off this attribute.
  useEffect(() => {
    document.documentElement.setAttribute("data-window", "tray");
  }, []);

  // Follow the main window's theme (shared localStorage) on every open.
  useEffect(() => {
    const theme = localStorage.getItem("theme") === "dark" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", theme);
  }, [openCount]);

  return (
    <TrayMenu
      // Remount per open so the entrance animation replays.
      key={openCount}
      frameRef={frameRef}
      games={games}
      onLaunch={launch}
      onOpenMain={openMain}
      onQuit={quit}
    />
  );
}
