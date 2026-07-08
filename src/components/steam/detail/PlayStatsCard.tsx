/**
 * Static play-stats card: playtime, last played, size on disk,
 * plus a download progress bar for partially-downloaded games.
 */
import { Timer, Download } from "lucide-react";
import { SteamGame } from "@/types/steam";
import { fmtBytes, fmtDate, fmtPlaytimeHours } from "@/utils/steamFormatters";

/**
 * Renders the Play Stats card.
 */
export default function PlayStatsCard({ game }: { game: SteamGame }) {
  const playtimeHours = fmtPlaytimeHours(game.playtime_minutes);
  const downloadPct = game.size_on_disk > 0
    ? Math.min(100, Math.round((game.bytes_downloaded / game.size_on_disk) * 100))
    : null;

  return (
    <div className="sdt-card sdt-card--static">
      <div className="sdt-card-header sdt-card-header--static">
        <span className="sdt-card-title"><span className="sdt-card-icon"><Timer size={13} /></span>Play Stats</span>
      </div>
      <div className="sdt-card-body">
        <div className="sdt-stats-grid">
          <div className="sdt-stat">
            <span className="sdt-stat-val">{playtimeHours ?? "—"}</span>
            <span className="sdt-stat-label">Playtime</span>
          </div>
          <div className="sdt-stat">
            <span className="sdt-stat-val">{game.last_played > 0 ? fmtDate(game.last_played) : "—"}</span>
            <span className="sdt-stat-label">Last Played</span>
          </div>
          <div className="sdt-stat">
            <span className="sdt-stat-val">{game.is_installed && game.size_on_disk > 0 ? fmtBytes(game.size_on_disk) : "—"}</span>
            <span className="sdt-stat-label">Size on Disk</span>
          </div>
        </div>
        {!game.is_installed && game.bytes_downloaded > 0 && downloadPct !== null && (
          <div className="sdt-dl-wrap">
            <div className="sdt-dl-row">
              <span className="sdt-dl-label"><Download size={11} />Downloaded {fmtBytes(game.bytes_downloaded)} / {fmtBytes(game.size_on_disk)}</span>
              <span className="sdt-dl-pct">{downloadPct}%</span>
            </div>
            <div className="sdt-dl-track"><div className="sdt-dl-bar" style={{ width: `${downloadPct}%` }} /></div>
          </div>
        )}
      </div>
    </div>
  );
}
