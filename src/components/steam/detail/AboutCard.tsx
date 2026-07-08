/**
 * Static about card: developer, publisher, release date, app id,
 * install path, and Steam collections. Renders nothing when there is
 * no info worth showing.
 */
import { Globe } from "lucide-react";
import { SteamGame } from "@/types/steam";
import { fmtDate } from "@/utils/steamFormatters";

/**
 * Renders the About card.
 */
export default function AboutCard({ game }: { game: SteamGame }) {
  const hasInfo = game.developer || game.publisher || game.release_date > 0 || game.collections.length > 0;
  if (!hasInfo) return null;

  return (
    <div className="sdt-card sdt-card--static">
      <div className="sdt-card-header sdt-card-header--static">
        <span className="sdt-card-title"><span className="sdt-card-icon"><Globe size={13} /></span>About</span>
      </div>
      <div className="sdt-card-body sdt-card-body--rows">
        {game.developer && <div className="sdt-row"><span className="sdt-row-label">Developer</span><span className="sdt-row-val">{game.developer}</span></div>}
        {game.publisher && game.publisher !== game.developer && <div className="sdt-row"><span className="sdt-row-label">Publisher</span><span className="sdt-row-val">{game.publisher}</span></div>}
        {game.release_date > 0 && <div className="sdt-row"><span className="sdt-row-label">Released</span><span className="sdt-row-val">{fmtDate(game.release_date)}</span></div>}
        <div className="sdt-row"><span className="sdt-row-label">App ID</span><span className="sdt-row-val sdt-mono">#{game.app_id}</span></div>
        {game.is_installed && game.install_path && <div className="sdt-row"><span className="sdt-row-label">Install path</span><span className="sdt-row-val sdt-mono sdt-row-val--truncate">{game.install_path}</span></div>}
        {game.collections.length > 0 && <div className="sdt-row"><span className="sdt-row-label">Collections</span><span className="sdt-row-val">{game.collections.join(", ")}</span></div>}
      </div>
    </div>
  );
}
