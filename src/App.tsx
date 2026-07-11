import { useEffect, useRef } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import AppShell from "./components/layout/AppShell";
import HomePage from "./pages/HomePage";
import GamesPage from "./pages/GamesPage";
import CollectionPage from "./pages/CollectionPage";
import GamesLayout from "./components/games/GamesLayout";
import ItemDetailPage from "./pages/ItemDetailPage";
import SettingsPage from "./pages/SettingsPage";
import SearchPage from "./pages/SearchPage";
import SteamPage from "./pages/SteamPage";
import TagsPage from "./pages/TagsPage";
import StatusPage from "./pages/StatusPage";
import PlayPage from "./pages/PlayPage";
import { useTheme } from "./hooks/useTheme";
import { initSteamStore } from "./store/steamStore";
import { gameStatusBulkInit } from "./services/tauriCommands";
import { applyAccentColor, readAppPrefs } from "./hooks/useAppPrefs";

// Apply accent color before first paint.
applyAccentColor(readAppPrefs().accentColor);

/**
 * Root component. Defines the top-level route structure and applies theme +
 * page transition animation on every route change.
 *
 * Routes:
 * - `/`                                → HomePage (libraries grid)
 * - `/games`                           → GamesPage (all libraries multi-view)
 * - `/play`                            → PlayPage (what should I play?)
 * - `/steam`                           → SteamPage (Steam library import)
 * - `/search`                          → SearchPage (advanced search)
 * - `/tags`                            → TagsPage (tag group management)
 * - `/collections/:id`                 → CollectionPage (games in a library)
 * - `/collections/:id/items/:itemId`   → ItemDetailPage (single game detail)
 * - `/status`                           → StatusPage (library stats)
 * - `/settings`                        → SettingsPage
 */
export default function App() {
  // Apply theme attribute to <html> on mount and when it changes.
  // The setter is only used in SettingsPage; here we just need the side effect.
  useTheme();

  // Kick off Steam library scan and game status init on app start.
  useEffect(() => {
    initSteamStore();
    gameStatusBulkInit().catch(() => {/* non-fatal */});
  }, []);

  return (
    <AppShell>
      <AnimatedRoutes />
    </AppShell>
  );
}

/** Wraps Routes so a fade+slide animation plays on every route change. */
function AnimatedRoutes() {
  const location = useLocation();
  const key = location.pathname;
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.classList.remove("page-enter");
    // Force reflow so the animation restarts on re-render.
    void el.offsetWidth;
    el.classList.add("page-enter");
  }, [key]);

  return (
    <div ref={ref} className="page-padded">
      <Routes location={location}>
        <Route path="/" element={<HomePage />} />
        <Route element={<GamesLayout />}>
          <Route path="/games" element={<GamesPage />} />
          <Route path="/collections/:id" element={<CollectionPage />} />
        </Route>
        <Route path="/play" element={<PlayPage />} />
        <Route path="/steam" element={<SteamPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/tags" element={<TagsPage />} />
        <Route path="/collections/:id/items/:itemId" element={<ItemDetailPage />} />
        <Route path="/items/:itemId" element={<ItemDetailPage />} />
        <Route path="/status" element={<StatusPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </div>
  );
}
