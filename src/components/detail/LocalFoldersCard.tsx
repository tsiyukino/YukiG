/**
 * "Details" card of a game's user-set local folders (mod / screenshots /
 * saves), each with an Open Folder button. Rows only appear for folders the
 * user has configured. Used on the Steam detail so a Steam game can point at
 * hand-installed mods or local saves and jump straight into them; local games
 * get the same rows inside GameDetailColumns.
 */
import { useState } from "react";
import { FolderOpen, Image, Save } from "lucide-react";
import { shellOpenPath } from "@/services/tauriCommands";
import { LocalFolders } from "@/hooks/useLocalFolders";
import PathRowsCard, { PathRowSpec } from "./PathRowsCard";
import rowStyles from "./PathRowsCard.module.css";

interface LocalFoldersCardProps {
  folders: LocalFolders;
}

/**
 * Renders the local-folders Details card, or nothing when no folder is set.
 */
export default function LocalFoldersCard({ folders }: LocalFoldersCardProps) {
  const [error, setError] = useState<string | null>(null);

  function openFolder(path: string) {
    setError(null);
    shellOpenPath(path).catch((e) => setError(String(e)));
  }

  const openBtn = (path: string) => (
    <button className={rowStyles.actionBtn} onClick={() => openFolder(path)} title="Open in Explorer">
      <FolderOpen size={12} />
      Open Folder
    </button>
  );

  const rows: PathRowSpec[] = [
    ...(folders.modFolder ? [{ key: "mods", icon: <FolderOpen size={13} />, label: "Mod Folder", path: folders.modFolder, action: openBtn(folders.modFolder) }] : []),
    ...(folders.screenshotFolder ? [{ key: "shots", icon: <Image size={13} />, label: "Screenshots Folder", path: folders.screenshotFolder, action: openBtn(folders.screenshotFolder) }] : []),
    ...(folders.saveFolder ? [{ key: "saves", icon: <Save size={13} />, label: "Saves Folder", path: folders.saveFolder, action: openBtn(folders.saveFolder) }] : []),
  ];

  if (rows.length === 0) return null;

  return (
    <div className="sdt-card sdt-card--static">
      <div className="sdt-card-header sdt-card-header--static">
        <span className="sdt-card-title"><span className="sdt-card-icon"><FolderOpen size={13} /></span>Details</span>
      </div>
      <div className="sdt-card-body">
        <PathRowsCard rows={rows} />
        {error && <p style={{ color: "var(--color-danger)", fontSize: "var(--text-xs)", margin: "8px 0 0" }}>{error}</p>}
      </div>
    </div>
  );
}
