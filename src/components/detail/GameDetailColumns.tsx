/**
 * Unified two-column detail body for a local game: the Steam-style play row
 * on top, then a left column (Details path rows followed by the page's own
 * sections passed as children) and a right column (Screenshots preview and
 * Mods tree, shown only when their folders are set).
 */
import { ReactNode, useState } from "react";
import { FolderOpen, Image, Play, RefreshCw, Save, SquareTerminal, Terminal } from "lucide-react";
import { shellOpenPath, gameLaunchExtraExe } from "@/services/tauriCommands";
import { useStrategy } from "@/hooks/useStrategy";
import { parseExtraExes } from "@/utils/extraExes";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import PlayActionRow from "./PlayActionRow";
import PathRowsCard, { PathRowSpec } from "./PathRowsCard";
import ScreenshotsCard from "./ScreenshotsCard";
import ModsCard from "./ModsCard";
import styles from "./GameDetailColumns.module.css";
import rowStyles from "./PathRowsCard.module.css";

interface GameDetailColumnsProps {
  itemId: string;
  folderPath: string;
  /** The page's own sections (meta, status, tags, notes), placed in the left
   *  column under the Details card. */
  children: ReactNode;
}

/**
 * Renders the play row and the two-column layout for a local game.
 */
export default function GameDetailColumns({ itemId, folderPath, children }: GameDetailColumnsProps) {
  const { metadata, loading, error, rescan, refresh } = useStrategy(itemId, folderPath, "game");
  const [actionError, setActionError] = useState<string | null>(null);

  if (loading) return <LoadingSpinner message="Loading game info…" />;

  const exePath = metadata["exe_path"] ?? "";
  const modFolder = metadata["mod_folder"] ?? "";
  const screenshotFolder = metadata["screenshot_folder"] ?? "";
  const saveFolder = metadata["save_folder"] ?? "";
  const extraExes = parseExtraExes(metadata["extra_exes"]);
  const totalSecs = parseInt(metadata["total_playtime_seconds"] ?? "0", 10) || 0;
  const lastLaunched = parseInt(metadata["last_launched"] ?? "0", 10) || 0;

  function openFolder(path: string) {
    setActionError(null);
    shellOpenPath(path).catch((e) => setActionError(String(e)));
  }

  function launchExtra(path: string) {
    setActionError(null);
    gameLaunchExtraExe(path).catch((e) => setActionError(String(e)));
  }

  const openBtn = (path: string) => (
    <button className={rowStyles.actionBtn} onClick={() => openFolder(path)} title="Open in Explorer">
      <FolderOpen size={12} />
      Open Folder
    </button>
  );

  const rows: PathRowSpec[] = [
    { key: "exe", icon: <Terminal size={13} />, label: "Executable", path: exePath },
    ...extraExes.map((exe) => ({
      key: `extra-${exe.path}`,
      icon: <SquareTerminal size={13} />,
      label: exe.label || "Executable",
      path: exe.path,
      action: (
        <button className={rowStyles.actionBtn} onClick={() => launchExtra(exe.path)} title={`Launch ${exe.label || "executable"}`}>
          <Play size={12} />
          Launch
        </button>
      ),
    })),
    ...(modFolder ? [{ key: "mods", icon: <FolderOpen size={13} />, label: "Mod Folder", path: modFolder, action: openBtn(modFolder) }] : []),
    ...(screenshotFolder ? [{ key: "shots", icon: <Image size={13} />, label: "Screenshots Folder", path: screenshotFolder, action: openBtn(screenshotFolder) }] : []),
    ...(saveFolder ? [{ key: "saves", icon: <Save size={13} />, label: "Saves Folder", path: saveFolder, action: openBtn(saveFolder) }] : []),
  ];

  return (
    <div className={styles.root}>
      <PlayActionRow
        itemId={itemId}
        exePath={exePath}
        totalSeconds={totalSecs}
        lastLaunched={lastLaunched}
        onSessionEnd={refresh}
        onError={setActionError}
      />
      {(error || actionError) && <p className={styles.error}>{error ?? actionError}</p>}

      <div className={styles.columns}>
        <div className={styles.col}>
          <div className={styles.sectionHeader}>Details</div>
          <PathRowsCard
            rows={rows}
            footer={
              <button className={rowStyles.rescanBtn} onClick={rescan} title="Re-scan game folder">
                <RefreshCw size={12} />
                Rescan
              </button>
            }
          />
          {children}
        </div>
        <div className={styles.col}>
          {screenshotFolder && <ScreenshotsCard folder={screenshotFolder} />}
          {modFolder && <ModsCard folder={modFolder} />}
          {!screenshotFolder && !modFolder && (
            <p className={styles.colEmpty}>
              Set a screenshots or mod folder to preview their contents here.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
