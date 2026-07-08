/**
 * Hook exposing the set of items currently being played.
 *
 * Seeds from `sessionGetActive()` on mount (the backend is the source of truth,
 * and the tray flow destroys the webview so React state cannot persist), then
 * stays live by listening to the backend's `play-session-started` and
 * `play-session-ended` events. Covers both local games launched via YukiG and
 * Steam games detected through Steam's registry — the backend emits the same
 * events for both.
 */
import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { sessionGetActive } from "@/services/tauriCommands";

/** Payload of the `play-session-started` event. */
interface SessionStartedPayload {
  item_id: string;
  started_at: number;
}

/** Payload of the `play-session-ended` event. */
interface SessionEndedPayload {
  item_id: string;
  started_at: number;
  ended_at: number;
}

/**
 * Returns a `Set` of item ids currently being played, kept live via backend
 * events. Re-renders whenever a session starts or ends.
 */
export function usePlaySessions(): Set<string> {
  const [playing, setPlaying] = useState<Set<string>>(new Set());

  useEffect(() => {
    let active = true;
    const unlisteners: Array<() => void> = [];

    // Seed from the backend's authoritative snapshot.
    sessionGetActive()
      .then((sessions) => {
        if (!active) return;
        setPlaying(new Set(sessions.map((s) => s.item_id)));
      })
      .catch(console.error);

    listen<SessionStartedPayload>("play-session-started", (event) => {
      setPlaying((prev) => {
        const next = new Set(prev);
        next.add(event.payload.item_id);
        return next;
      });
    }).then((fn) => unlisteners.push(fn));

    listen<SessionEndedPayload>("play-session-ended", (event) => {
      setPlaying((prev) => {
        if (!prev.has(event.payload.item_id)) return prev;
        const next = new Set(prev);
        next.delete(event.payload.item_id);
        return next;
      });
    }).then((fn) => unlisteners.push(fn));

    return () => {
      active = false;
      unlisteners.forEach((fn) => fn());
    };
  }, []);

  return playing;
}
