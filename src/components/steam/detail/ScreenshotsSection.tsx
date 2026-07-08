/**
 * Collapsible screenshots section: lazy-loaded local screenshot grid
 * with an "open in Steam" shortcut.
 */
import { convertFileSrc } from "@tauri-apps/api/core";
import { Camera } from "lucide-react";
import { steamGetScreenshots, shellOpenPath } from "@/services/tauriCommands";
import { SteamGame, SteamScreenshot } from "@/types/steam";
import { fmtDate } from "@/utils/steamFormatters";
import { useLazySection } from "@/hooks/useLazySection";
import DetailSection from "../DetailSection";

/**
 * Renders the screenshots DetailSection.
 */
export default function ScreenshotsSection({ game }: { game: SteamGame }) {
  const section = useLazySection<SteamScreenshot>(() => steamGetScreenshots(game.app_id));

  return (
    <DetailSection
      icon={<Camera size={13} />}
      title="Screenshots"
      badge={section.loaded && section.items.length > 0
        ? <span className="sdt-badge">{section.items.length}</span>
        : undefined}
      onToggle={section.toggle}
      expanded={section.expanded}
      loading={section.loading}
    >
      {section.loaded && section.items.length === 0 ? (
        <div className="sdt-empty"><Camera size={18} /><span>No screenshots found.</span></div>
      ) : (
        <>
          <div className="sdt-ss-toolbar">
            <button className="sdt-ss-open-btn" onClick={() => shellOpenPath(`steam://open/screenshots/${game.app_id}`).catch(() => {})}>
              <Camera size={11} />View in Steam
            </button>
          </div>
          <div className="sdt-screenshots-grid">
            {section.items.map((ss) => (
              <button key={ss.path} className="sdt-screenshot-item"
                onClick={() => shellOpenPath(ss.path).catch(() => {})} title={ss.filename}>
                <img src={convertFileSrc(ss.path)} alt={ss.filename} className="sdt-screenshot-img"
                  loading="lazy" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                <div className="sdt-screenshot-overlay">
                  <span className="sdt-screenshot-date">{fmtDate(ss.timestamp)}</span>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </DetailSection>
  );
}
