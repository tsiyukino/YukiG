import { Gamepad2 } from "lucide-react";

/** Formats a minute count into a human-readable duration string. */
function fmtMinutes(mins: number): string {
  if (mins === 0) return "0h";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

interface PlaytimeRowProps {
  /** Game name. */
  name: string;
  /** Total playtime in minutes. */
  minutes: number;
  /** Maximum playtime in the list (used to scale the bar width). */
  maxMinutes: number;
  /** Zero-based rank index (shown as #1, #2, …). */
  rank: number;
  /** Optional thumbnail URL; falls back to a gamepad icon. */
  thumb: string | null;
}

/**
 * A single row in the "Top Played" list showing rank, thumbnail, name, bar, and time.
 */
export default function PlaytimeRow({ name, minutes, maxMinutes, rank, thumb }: PlaytimeRowProps) {
  const pct = maxMinutes > 0 ? (minutes / maxMinutes) * 100 : 0;
  return (
    <div className="stp-pt-row" style={{ animationDelay: `${rank * 45}ms` }}>
      <span className="stp-pt-rank">#{rank + 1}</span>
      <div className="stp-pt-thumb">
        {thumb
          ? <img src={thumb} alt="" className="stp-pt-img" loading="lazy" />
          : <Gamepad2 size={11} color="var(--color-text-muted)" />
        }
      </div>
      <div className="stp-pt-info">
        <span className="stp-pt-name">{name}</span>
        <div className="stp-pt-track">
          <div className="stp-pt-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <span className="stp-pt-time">{fmtMinutes(minutes)}</span>
    </div>
  );
}
