import { Gamepad2 } from "lucide-react";
import s from "./status.module.css";
import { formatHoursMinutes } from "@/utils/formatPlaytime";


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
    <div className={s.ptRow} style={{ animationDelay: `${rank * 45}ms` }}>
      <span className={s.ptRank}>#{rank + 1}</span>
      <div className={s.ptThumb}>
        {thumb
          ? <img src={thumb} alt="" className={s.ptImg} loading="lazy" />
          : <Gamepad2 size={11} color="var(--color-text-muted)" />
        }
      </div>
      <div className={s.ptInfo}>
        <span className={s.ptName}>{name}</span>
        <div className={s.ptTrack}>
          <div className={s.ptFill} style={{ width: `${pct}%` }} />
        </div>
      </div>
      <span className={s.ptTime}>{formatHoursMinutes(minutes)}</span>
    </div>
  );
}
