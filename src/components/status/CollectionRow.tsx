import { Clock, ChevronRight } from "lucide-react";
import { Collection } from "@/types/collection";

function fmtMinutes(mins: number): string {
  if (mins === 0) return "0h";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

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
    <button className="stp-coll-row" onClick={onClick}>
      <span className="stp-coll-dot" style={{ background: collection.color }} />
      <div className="stp-coll-info">
        <span className="stp-coll-name">{collection.name}</span>
        {totalPlaytime > 0 && (
          <span className="stp-coll-playtime"><Clock size={9} /> {fmtMinutes(totalPlaytime)}</span>
        )}
      </div>
      <div className="stp-coll-track">
        <div className="stp-coll-fill" style={{ width: `${pct}%`, background: `${collection.color}80` }} />
      </div>
      <span className="stp-coll-count">{items.length}</span>
      <ChevronRight size={12} className="stp-coll-arrow" />
    </button>
  );
}
