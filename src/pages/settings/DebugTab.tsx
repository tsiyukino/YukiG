/**
 * Settings — Debug tab.
 *
 * Section: Diagnostics (Steam categories check, DB state check).
 */
import { useState } from "react";
import { Bug, RefreshCw } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { SettingsSection, SettingsRow } from "./SettingsControls";
import s from "./settings.module.css";

/** Debug tab panel — developer diagnostic tools. */
export default function DebugTab() {
  const [output, setOutput] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function run(command: string) {
    setLoading(true);
    setOutput(null);
    try {
      const out = await invoke<string>(command);
      setOutput(out);
    } catch (e) {
      setOutput("ERROR: " + String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SettingsSection icon={<Bug size={15} />} title="Diagnostics">
      <SettingsRow
        label="Steam categories"
        description="Check if category IDs are parsed from appinfo.vdf."
      >
        <button className={s.btn} disabled={loading} onClick={() => run("steam_debug_appinfo")}>
          {loading ? <RefreshCw size={11} className={s.spin} /> : null}
          Run
        </button>
      </SettingsRow>
      <SettingsRow
        label="DB state"
        description="Check tags and game status rows in the database."
      >
        <button className={s.btn} disabled={loading} onClick={() => run("steam_debug_db")}>
          {loading ? <RefreshCw size={11} className={s.spin} /> : null}
          Run
        </button>
      </SettingsRow>
      {output && (
        <div style={{ gridColumn: "1/-1", padding: "var(--space-3) var(--space-4)" }}>
          <pre className={s.debugOut}>{output}</pre>
        </div>
      )}
    </SettingsSection>
  );
}
