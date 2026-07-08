import { Clock, ChevronRight } from "lucide-react";
import { Collection } from "@/types/collection";
import s from "./status.module.css";
import { formatHoursMinutes } from "@/utils/formatPlaytime";


interface LocalItem {
  playtime_minutes: number;
}

interface CollectionRowProps {
  /** The collection to display. */
  collection: Collection;
  /** Items belonging to this collection (used for count and playtime). */
  items: LocalItem[];
  /** Maximum item count across all collections (used to scale the fill bar). */
  maxCount: number;
  /** Called when the row is clicked (navigate to collection). */
  onClick: () => void;
}

/** A single row in the Local tab's Collections list. */
export default function CollectionRow({ collection, items, maxCount, onClick }: CollectionRowProps) {
  const totalPlaytime = items.reduce((s, i) => s + i.playtime_minutes, 0);
  const pct = maxCount > 0 ? (items.length / maxCount) * 100 : 0;

  return (
    <button className={s.collRow} onClick={onClick}>
      <span className={s.collDot} style={{ background: collection.color }} />
      <div className={s.collInfo}>
        <span className={s.collName}>{collection.name}</span>
        {totalPlaytime > 0 && (
          <span className={s.collPlaytime}><Clock size={9} /> {formatHoursMinutes(totalPlaytime)}</span>
        )}
      </div>
      <div className={s.collTrack}>
        <div className={s.collFill} style={{ width: `${pct}%`, background: `${collection.color}80` }} />
      </div>
      <span className={s.collCount}>{items.length}</span>
      <ChevronRight size={12} className={s.collArrow} />
    </button>
  );
}
