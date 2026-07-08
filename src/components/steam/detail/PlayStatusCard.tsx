/**
 * One-click play status card: story and online status chip rows.
 * Loads the status itself from the item id.
 */
import { useState, useEffect } from "react";
import { Timer } from "lucide-react";
import { gameStatusGet, gameStatusSet, GameStatus, StoryStatus, OnlineStatus } from "@/services/tauriCommands";

const STORY_OPTIONS: StoryStatus[] = ["unplayed", "playing", "on_hold", "completed", "abandoned"];
const ONLINE_OPTIONS: OnlineStatus[] = ["inactive", "active"];

/**
 * Renders the Play Status chips for a Steam game's DB item.
 */
export default function PlayStatusCard({ itemId }: { itemId: string }) {
  const [status, setStatus] = useState<GameStatus | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    gameStatusGet(itemId).then(setStatus).catch(() => {});
  }, [itemId]);

  async function update(story: StoryStatus, online: OnlineStatus) {
    if (!status) return;
    setSaving(true);
    try {
      const updated = await gameStatusSet(itemId, story, online, status.snooze_until);
      setStatus(updated);
    } catch {
      // Non-fatal — chips simply stay unchanged.
    } finally {
      setSaving(false);
    }
  }

  if (!status) return null;

  return (
    <div className="sdt-card sdt-card--static">
      <div className="sdt-card-header sdt-card-header--static">
        <span className="sdt-card-title"><span className="sdt-card-icon"><Timer size={13} /></span>Play Status</span>
        {saving && <span className="sdt-saving-indicator">Saving…</span>}
      </div>
      <div className="sdt-card-body sdt-card-body--rows">
        <div className="sdt-row">
          <span className="sdt-row-label">Story</span>
          <div className="sdt-status-chips">
            {STORY_OPTIONS.map((s) => (
              <button
                key={s}
                className={`sdt-status-chip ${status.story_status === s ? "sdt-status-chip--active" : ""}`}
                onClick={() => update(s, status.online_status as OnlineStatus)}
                disabled={saving}
              >
                {s.replace(/_/g, " ")}
              </button>
            ))}
          </div>
        </div>
        <div className="sdt-row">
          <span className="sdt-row-label">Online</span>
          <div className="sdt-status-chips">
            {ONLINE_OPTIONS.map((s) => (
              <button
                key={s}
                className={`sdt-status-chip ${status.online_status === s ? "sdt-status-chip--active" : ""}`}
                onClick={() => update(status.story_status as StoryStatus, s)}
                disabled={saving}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
