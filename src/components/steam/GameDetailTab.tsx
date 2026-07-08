/**
 * Full game detail tab shown when "See Details" is clicked in the drawer.
 *
 * Composition root: hero banner, action row, and the two-column card layout.
 * Each card/section owns its own data (keyed by app_id so state resets when
 * the selected game changes). Styles come from the steam feature stylesheet.
 */
import { useState, useCallback } from "react";
import { AlertCircle, FolderOpen, Store, Monitor, X } from "lucide-react";
import { steamOpenInApp, steamOpenInStore, shellOpenPath, SteamGameDbInfo } from "@/services/tauriCommands";
import { SteamGame } from "@/types/steam";
import DetailHero from "./detail/DetailHero";
import PlayStatsCard from "./detail/PlayStatsCard";
import AboutCard from "./detail/AboutCard";
import NotesCard from "./detail/NotesCard";
import PlayStatusCard from "./detail/PlayStatusCard";
import TagsCard from "./detail/TagsCard";
import AchievementsSection from "./detail/AchievementsSection";
import ScreenshotsSection from "./detail/ScreenshotsSection";
import CloudSavesSection from "./detail/CloudSavesSection";

interface GameDetailTabProps {
  /** The game to show full details for. */
  game: SteamGame;
  /** DB metadata keyed by app_id, used to get the item_id for edits. */
  gameDbInfo: Record<number, SteamGameDbInfo>;
}

/**
 * Full game detail view rendered as the "detail" tab.
 * Achievements, screenshots, and cloud saves load lazily on first expand.
 */
export default function GameDetailTab({ game, gameDbInfo }: GameDetailTabProps) {
  const itemId = gameDbInfo[game.app_id]?.item_id ?? null;
  const [editError, setEditError] = useState<string | null>(null);
  const [achSummary, setAchSummary] = useState<{ unlocked: number; total: number } | null>(null);

  const handleAchSummary = useCallback(
    (summary: { unlocked: number; total: number }) => setAchSummary(summary),
    [],
  );

  return (
    <div className="sdt-root" key={game.app_id}>
      <DetailHero game={game} itemId={itemId} achSummary={achSummary} onError={setEditError} />

      <div className="sdt-page">
        {editError && (
          <div className="sdt-error-banner">
            <AlertCircle size={13} />{editError}
            <button onClick={() => setEditError(null)}><X size={11} /></button>
          </div>
        )}

        <div className="sdt-actions-row">
          <button className="sdt-action-btn sdt-action-btn--primary" onClick={() => steamOpenInApp(game.app_id).catch(() => {})}>
            <Monitor size={14} />Open in Steam
          </button>
          <button className="sdt-action-btn" onClick={() => steamOpenInStore(game.app_id).catch(() => {})}>
            <Store size={14} />Open Store Page
          </button>
          {game.is_installed && game.install_path && (
            <button className="sdt-action-btn" onClick={() => shellOpenPath(game.install_path!).catch(() => {})}>
              <FolderOpen size={14} />Open Folder
            </button>
          )}
        </div>

        <div className="sdt-columns">
          <div className="sdt-col-left">
            <PlayStatsCard game={game} />
            <AboutCard game={game} />
            {itemId && <NotesCard itemId={itemId} onError={setEditError} />}
            {itemId && <PlayStatusCard itemId={itemId} />}
            {itemId && <TagsCard itemId={itemId} />}
          </div>

          <div className="sdt-col-right">
            <AchievementsSection game={game} onSummary={handleAchSummary} />
            <ScreenshotsSection game={game} />
            <CloudSavesSection game={game} />
          </div>
        </div>
      </div>
    </div>
  );
}
