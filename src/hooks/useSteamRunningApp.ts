/**
 * Hook exposing the Steam app id currently running (0 when none).
 *
 * Keyed by app id — independent of whether the game is imported as a library
 * item — so the Steam page can mark a running game whether it was launched
 * from Steam or from YukiG. Seeds from `steamGetRunningAppId()` on mount, then
 * stays live via the backend's `steam-running-changed` event.
 */
import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { steamGetRunningAppId } from "@/services/tauriCommands";

/**
 * Returns the running Steam app id (0 = nothing running), kept live via the
 * `steam-running-changed` event.
 */
export function useSteamRunningApp(): number {
  const [appId, setAppId] = useState(0);

  useEffect(() => {
    let active = true;
    let unlisten: (() => void) | undefined;

    steamGetRunningAppId()
      .then((id) => {
        if (active) setAppId(id);
      })
      .catch(console.error);

    listen<number>("steam-running-changed", (event) => {
      setAppId(event.payload);
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      active = false;
      unlisten?.();
    };
  }, []);

  return appId;
}
