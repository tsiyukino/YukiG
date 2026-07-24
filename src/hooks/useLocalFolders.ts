/**
 * Reads a game's user-set local folders (mod / screenshots / saves) from its
 * strategy metadata. These are optional paths a user configures so they can
 * jump into the folder or preview its contents — for Steam games they cover
 * hand-installed mods and local saves that live outside Steam's own dirs.
 */
import { useState, useEffect, useCallback } from "react";
import { strategyGetMetadata } from "@/services/tauriCommands";

export interface LocalFolders {
  modFolder: string;
  screenshotFolder: string;
  saveFolder: string;
}

interface UseLocalFoldersResult extends LocalFolders {
  loading: boolean;
  /** True when at least one folder is set (nothing to show otherwise). */
  hasAny: boolean;
  /** Re-reads the metadata (call after an edit changes the paths). */
  reload: () => void;
}

/**
 * Loads the item's mod / screenshots / saves folder paths.
 */
export function useLocalFolders(itemId: string): UseLocalFoldersResult {
  const [folders, setFolders] = useState<LocalFolders>({ modFolder: "", screenshotFolder: "", saveFolder: "" });
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    strategyGetMetadata(itemId)
      .then((meta) => setFolders({
        modFolder: meta["mod_folder"] ?? "",
        screenshotFolder: meta["screenshot_folder"] ?? "",
        saveFolder: meta["save_folder"] ?? "",
      }))
      .catch(() => setFolders({ modFolder: "", screenshotFolder: "", saveFolder: "" }))
      .finally(() => setLoading(false));
  }, [itemId]);

  useEffect(() => { reload(); }, [reload]);

  const hasAny = folders.modFolder !== "" || folders.screenshotFolder !== "" || folders.saveFolder !== "";
  return { ...folders, loading, hasAny, reload };
}
