/**
 * Settings — Behaviour tab.
 *
 * Sections: Startup (start on startup, start minimized), Window (minimize to tray).
 */
import { useState, useEffect } from "react";
import { SlidersHorizontal } from "lucide-react";
import {
  settingsGetBehaviour,
  settingsSetBehaviour,
  BehaviourSettings,
} from "@/services/tauriCommands";
import { SettingsSection, SettingsRow, Toggle } from "./SettingsControls";
import s from "./settings.module.css";

/** Behaviour tab panel — startup and window settings. */
export default function BehaviourTab() {
  const [behaviour, setBehaviour] = useState<BehaviourSettings>({
    start_on_startup: false,
    minimize_on_start: false,
    minimize_to_tray: true,
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    settingsGetBehaviour().then(setBehaviour).catch(console.error);
  }, []);

  async function handleToggle(key: keyof BehaviourSettings) {
    const next = { ...behaviour, [key]: !behaviour[key] };
    if (key === "start_on_startup" && !next.start_on_startup) {
      next.minimize_on_start = false;
    }
    setError(null);
    try {
      await settingsSetBehaviour(next);
      setBehaviour(next);
    } catch (e) {
      setError(String(e));
    }
  }

  return (
    <>
      <SettingsSection icon={<SlidersHorizontal size={15} />} title="Startup">
        <SettingsRow
          label="Start on startup"
          description="Launch YukiG automatically when you log in to Windows. Writes a Windows registry entry under HKCU\Software\Microsoft\Windows\CurrentVersion\Run. Takes effect immediately."
        >
          <Toggle
            checked={behaviour.start_on_startup}
            onChange={() => handleToggle("start_on_startup")}
          />
        </SettingsRow>
        <SettingsRow
          label="Start minimized"
          description="When starting on login, hide the window immediately (tray only). Requires Start on startup."
        >
          <Toggle
            checked={behaviour.minimize_on_start}
            onChange={() => handleToggle("minimize_on_start")}
            disabled={!behaviour.start_on_startup}
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection icon={<SlidersHorizontal size={15} />} title="Window">
        <SettingsRow
          label="Minimize to tray"
          description="When closing the window, hide it to the system tray instead of exiting the app."
        >
          <Toggle
            checked={behaviour.minimize_to_tray}
            onChange={() => handleToggle("minimize_to_tray")}
          />
        </SettingsRow>
        {error && <span className={s.errorSection}>{error}</span>}
      </SettingsSection>
    </>
  );
}
