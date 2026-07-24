/**
 * Full game detail view shown in the library's main panel when a game is
 * opened from a card or a sidebar row.
 *
 * Composition root: hero banner, action row, and the two-column card layout.
 * Each card/section owns its own data (keyed by app_id so state resets when
 * the selected game changes). Owns the Edit modal and the delete
 * confirmation for the header's icon actions.
 * Styles come from the steam feature stylesheet.
 */
import { useState, useCallback } from "react";
import { AlertCircle, FolderOpen, Store, Monitor, X } from "lucide-react";
import {
  steamOpenInApp, steamOpenInStore, shellOpenPath, itemSetFavorite, itemDelete,
} from "@/services/tauriCommands";
import { SteamGame, SteamLibItem } from "@/types/steam";
import EditItemModal from "@/pages/EditItemModal";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { useLocalFolders } from "@/hooks/useLocalFolders";
import LocalFoldersCard from "@/components/detail/LocalFoldersCard";
import ScreenshotsCard from "@/components/detail/ScreenshotsCard";
import ModsCard from "@/components/detail/ModsCard";
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
  /** The game to show full details for (scan-side data). */
  game: SteamGame;
  /** The library item backing this game. */
  item: SteamLibItem;
  /** Called after an edit/favourite change so the library list refreshes. */
  onChanged: () => void;
  /** Called after the item is deleted (closes the detail and refreshes). */
  onDeleted: () => void;
}

/**
 * Full game detail view rendered inside the library main panel.
 * Achievements, screenshots, and cloud saves load lazily on first expand.
 */
export default function GameDetailTab({ game, item, onChanged, onDeleted }: GameDetailTabProps) {
  const [editError, setEditError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [achSummary, setAchSummary] = useState<{ unlocked: number; total: number } | null>(null);
  // User-set local folders (hand-installed mods, local saves) — optional, and
  // separate from Steam's own screenshot/cloud dirs shown in the right column.
  const localFolders = useLocalFolders(item.id);

  const handleAchSummary = useCallback(
    (summary: { unlocked: number; total: number }) => setAchSummary(summary),
    [],
  );

  async function handleFavoriteToggle() {
    try {
      await itemSetFavorite(item.id, !item.is_favorite);
      onChanged();
    } catch (e) {
      setEditError(String(e));
    }
  }

  async function handleDelete() {
    setConfirmDelete(false);
    try {
      await itemDelete(item.id);
      onDeleted();
    } catch (e) {
      setEditError(String(e));
    }
  }

  return (
    <div className="sdt-root" key={game.app_id}>
      <DetailHero
        game={game}
        item={item}
        achSummary={achSummary}
        onFavoriteToggle={handleFavoriteToggle}
        onEdit={() => setEditOpen(true)}
        onDelete={() => setConfirmDelete(true)}
      />

      <div className="sdt-page">
        {editError && (
          <div className="sdt-error-banner">
            <AlertCircle size={13} />{editError}
            <button onClick={() => setEditError(null)}><X size={11} /></button>
          </div>
        )}

        <div className="sdt-actions-row">
          <button className="sdt-action-btn" onClick={() => steamOpenInApp(game.app_id).catch(() => {})}>
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
            {!localFolders.loading && localFolders.hasAny && <LocalFoldersCard folders={localFolders} />}
            <NotesCard itemId={item.id} onError={setEditError} />
            <PlayStatusCard itemId={item.id} />
            <TagsCard itemId={item.id} />
          </div>

          <div className="sdt-col-right">
            <AchievementsSection game={game} onSummary={handleAchSummary} />
            <ScreenshotsSection game={game} />
            {localFolders.screenshotFolder && <ScreenshotsCard folder={localFolders.screenshotFolder} />}
            {localFolders.modFolder && <ModsCard folder={localFolders.modFolder} />}
            <CloudSavesSection game={game} />
          </div>
        </div>
      </div>

      {editOpen && (
        <EditItemModal
          item={item}
          onSave={() => { setEditOpen(false); localFolders.reload(); onChanged(); }}
          onClose={() => setEditOpen(false)}
        />
      )}
      <ConfirmDialog
        open={confirmDelete}
        title="Delete from library?"
        message={`"${item.name}" will be removed from YukiG. The game itself stays in your Steam library and will come back on the next sync unless it is gone from Steam.`}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
