/**
 * Settings — Data tab.
 *
 * Section: Storage (data directory path, database file, thumbnail cache).
 */
import { useState, useEffect } from "react";
import { FolderOpen, RefreshCw } from "lucide-react";
import { open as openFolderDialog } from "@tauri-apps/plugin-dialog";
import {
  settingsGetDataDir,
  settingsSetDataDir,
  shellOpenPath,
} from "@/services/tauriCommands";
import { SettingsSection, SettingsRow } from "./SettingsControls";

/** Data tab panel — data directory management. */
export default function DataTab() {
  const [dataDir, setDataDir] = useState<string | null>(null);
  const [migrating, setMigrating] = useState(false);
  const [migrateError, setMigrateError] = useState<string | null>(null);
  const [migrateSuccess, setMigrateSuccess] = useState(false);
  const [openDirError, setOpenDirError] = useState<string | null>(null);

  useEffect(() => {
    settingsGetDataDir().then(setDataDir).catch(console.error);
  }, []);

  async function handleOpenDataDir() {
    if (!dataDir) return;
    setOpenDirError(null);
    try {
      await shellOpenPath(dataDir);
    } catch (e) {
      setOpenDirError(String(e));
    }
  }

  async function handleChangeDataDir() {
    setMigrateError(null);
    setMigrateSuccess(false);
    const selected = await openFolderDialog({ directory: true, multiple: false });
    if (!selected || typeof selected !== "string") return;
    setMigrating(true);
    try {
      await settingsSetDataDir(selected);
      setDataDir(selected);
      setMigrateSuccess(true);
    } catch (e) {
      setMigrateError(String(e));
    } finally {
      setMigrating(false);
    }
  }

  return (
    <SettingsSection icon={<FolderOpen size={15} />} title="Storage">
      <SettingsRow
        label="Data directory"
        description="YukiG stores its database and thumbnail cache here. Changing this location copies all existing data to the new folder. A restart is required after changing."
      >
        <div className="sp-data-dir-block">
          <div className="sp-data-dir">
            <span className="sp-data-dir-path">{dataDir ?? "…"}</span>
            <button
              className="sp-btn"
              onClick={handleOpenDataDir}
              disabled={!dataDir}
              title="Open in Explorer"
            >
              <FolderOpen size={13} />
              Open
            </button>
            <button
              className="sp-btn"
              onClick={handleChangeDataDir}
              disabled={!dataDir || migrating}
              title="Change data directory"
            >
              {migrating ? <RefreshCw size={13} className="sp-spin" /> : <FolderOpen size={13} />}
              {migrating ? "Migrating…" : "Change"}
            </button>
          </div>
          {migrateSuccess && (
            <span className="sp-success">
              Data copied successfully. Please restart YukiG for the change to take effect.
            </span>
          )}
          {migrateError && <span className="sp-error">{migrateError}</span>}
          {openDirError  && <span className="sp-error">{openDirError}</span>}
        </div>
      </SettingsRow>
      <SettingsRow
        label="Database file"
        description="SQLite database containing all collections, items, tags, and metadata."
      >
        <span className="sp-mono">{dataDir ? `${dataDir}\\filevault.db` : "…"}</span>
      </SettingsRow>
      <SettingsRow
        label="Thumbnail cache"
        description="Cached image thumbnails generated from item folders."
      >
        <span className="sp-mono">{dataDir ? `${dataDir}\\thumbnails\\` : "…"}</span>
      </SettingsRow>
    </SettingsSection>
  );
}
