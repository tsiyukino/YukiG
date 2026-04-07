/**
 * Settings — About tab.
 *
 * Section: Application name, version, and tech stack.
 */
import { Info } from "lucide-react";
import { SettingsSection, SettingsRow } from "./SettingsControls";

/** About tab panel — app identity and version info. */
export default function AboutTab() {
  return (
    <SettingsSection icon={<Info size={15} />} title="About">
      <SettingsRow label="Application" description="Game library manager for Windows.">
        <span className="sp-value">YukiG</span>
      </SettingsRow>
      <SettingsRow label="Version" description="">
        <span className="sp-value">0.1.0</span>
      </SettingsRow>
      <SettingsRow label="Stack" description="">
        <span className="sp-value">Tauri v2 · React · TypeScript · SQLite</span>
      </SettingsRow>
    </SettingsSection>
  );
}
