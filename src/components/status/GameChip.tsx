import { Gamepad2 } from "lucide-react";
import s from "./status.module.css";

interface GameChipProps {
  /** Game display name. */
  name: string;
  /** Secondary line (e.g. last played date or playtime). */
  sub: string;
  /** Optional thumbnail URL; falls back to a gamepad icon. */
  thumb: string | null;
}

/**
 * A compact game card showing thumbnail, name, and a secondary info line.
 * Used in the "Recently Played" list on the Steam tab.
 */
export default function GameChip({ name, sub, thumb }: GameChipProps) {
  return (
    <div className={s.chip}>
      <div className={s.chipIcon}>
        {thumb
          ? <img src={thumb} alt="" className={s.chipImg} loading="lazy"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          : <Gamepad2 size={12} color="var(--color-text-muted)" />
        }
      </div>
      <div className={s.chipBody}>
        <span className={s.chipName}>{name}</span>
        <span className={s.chipSub}>{sub}</span>
      </div>
    </div>
  );
}
