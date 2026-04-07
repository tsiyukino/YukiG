/**
 * Hook that registers an item folder for file watching and fires a callback
 * whenever the backend detects a change.
 *
 * On mount, calls `watcher_add` to begin watching `folderPath`. On unmount,
 * calls `watcher_remove` and unsubscribes from the Tauri event listener.
 *
 * @param itemId      - UUID of the item whose folder is being watched
 * @param folderPath  - Absolute path to the folder to watch
 * @param onChanged   - Callback invoked when a change is detected; receives the
 *                      change kind string ("create" | "modify" | "remove" | "rename" | "other")
 */
import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { watcherAdd, watcherRemove } from "@/services/tauriCommands";

/** Payload emitted by the backend `file-changed` event. */
interface FileChangedPayload {
  item_id: string;
  folder_path: string;
  kind: string;
}

/**
 * Watches an item folder and fires `onChanged` on any filesystem change.
 *
 * Registers the watcher on mount and cleans up on unmount. Safe to use in
 * multiple components — each hook instance manages its own watcher and listener.
 *
 * @param itemId     - UUID of the item to watch
 * @param folderPath - Absolute path of the folder to monitor
 * @param onChanged  - Called with the change kind when a change is detected
 */
export function useFileWatcher(
  itemId: string,
  folderPath: string,
  onChanged: (kind: string) => void
): void {
  useEffect(() => {
    if (!itemId || !folderPath) return;

    let unlisten: (() => void) | undefined;

    // Start watching and subscribe to events.
    watcherAdd(itemId, folderPath).catch(console.error);

    listen<FileChangedPayload>("file-changed", (event) => {
      if (event.payload.item_id === itemId) {
        onChanged(event.payload.kind);
      }
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      watcherRemove(itemId).catch(console.error);
      unlisten?.();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId, folderPath]);
}
