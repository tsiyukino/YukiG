/**
 * Collapsible cloud-saves section: lazy-loaded list of remote save files.
 */
import { Cloud } from "lucide-react";
import { steamGetCloudSaves } from "@/services/tauriCommands";
import { SteamGame, SteamCloudFile } from "@/types/steam";
import { fmtBytes, fmtDate } from "@/utils/steamFormatters";
import { useLazySection } from "@/hooks/useLazySection";
import DetailSection from "../DetailSection";

/**
 * Renders the cloud saves DetailSection.
 */
export default function CloudSavesSection({ game }: { game: SteamGame }) {
  const section = useLazySection<SteamCloudFile>(() => steamGetCloudSaves(game.app_id));

  return (
    <DetailSection
      icon={<Cloud size={13} />}
      title="Cloud Saves"
      badge={section.loaded && section.items.length > 0
        ? <span className="sdt-badge">{section.items.length}</span>
        : undefined}
      onToggle={section.toggle}
      expanded={section.expanded}
      loading={section.loading}
    >
      {section.loaded && section.items.length === 0 ? (
        <div className="sdt-empty"><Cloud size={18} /><span>No cloud save files found.</span></div>
      ) : (
        <div className="sdt-cloud-list">
          {section.items.map((f) => (
            <div key={f.name} className="sdt-cloud-item">
              <span className="sdt-cloud-name">{f.name}</span>
              <span className="sdt-cloud-meta">{fmtBytes(f.size)}</span>
              <span className="sdt-cloud-meta">{fmtDate(f.timestamp)}</span>
            </div>
          ))}
        </div>
      )}
    </DetailSection>
  );
}
