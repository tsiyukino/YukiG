import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Layers, Gamepad2, Clock, Tag, TrendingUp } from "lucide-react";
import { Collection } from "@/types/collection";
import { Item } from "@/types/item";
import { Tag as TagType } from "@/types/tag";
import StatTile from "@/components/status/StatTile";
import PlaytimeRow from "@/components/status/PlaytimeRow";
import CollectionRow from "@/components/status/CollectionRow";
import s from "./status.module.css";

interface LocalItem extends Item {
  playtime_seconds: number;
  playtime_minutes: number;
  last_launched: number;
}

/** Aggregated local database statistics passed from StatusPage. */
export interface DbData {
  userCollections: Collection[];
  collectionBreakdown: { collection: Collection; items: LocalItem[] }[];
  tagBreakdown: { tag: TagType; count: number }[];
  allLocalItems: LocalItem[];
  favoriteCount: number;
  loadedAt: Date;
}

function fmtMinutes(mins: number): string {
  if (mins === 0) return "0h";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

interface LocalTabProps {
  /** Local DB statistics. */
  db: DbData;
}

/** Local tab on the Status page. Shows collections breakdown, top played, and tags. */
export default function LocalTab({ db }: LocalTabProps) {
  const navigate = useNavigate();
  const maxCount = db.collectionBreakdown[0]?.items.length ?? 1;
  const totalPlaytime = db.allLocalItems.reduce((s, i) => s + i.playtime_minutes, 0);

  const topLocal = useMemo(() =>
    [...db.allLocalItems]
      .filter((i) => i.playtime_minutes > 0)
      .sort((a, b) => b.playtime_minutes - a.playtime_minutes)
      .slice(0, 8),
    [db]
  );
  const maxPlaytime = topLocal[0]?.playtime_minutes ?? 1;

  return (
    <div className={s.tabBody}>
      <div className={s.grid4}>
        <StatTile icon={<Layers size={15} />} label="Collections"
          value={db.userCollections.length} accent="#6366f1" />
        <StatTile icon={<Gamepad2 size={15} />} label="Games"
          value={db.allLocalItems.length} accent="#3b82f6" />
        <StatTile icon={<Clock size={15} />} label="Playtime"
          value={fmtMinutes(totalPlaytime)} accent="#8b5cf6" />
        <StatTile icon={<Tag size={15} />} label="Tags"
          value={db.tagBreakdown.length} accent="#10b981" />
      </div>

      {db.collectionBreakdown.length === 0 ? (
        <div className={s.emptyState}>
          <Layers size={28} strokeWidth={1.5} color="var(--color-text-muted)" />
          <p>No collections yet. Create one from the Games page.</p>
        </div>
      ) : (
        <div className={s.card}>
          <div className={s.cardHeader}><Layers size={13} /><span>Collections</span></div>
          <div className={s.collList}>
            {db.collectionBreakdown.map(({ collection, items }) => (
              <CollectionRow
                key={collection.id}
                collection={collection}
                items={items}
                maxCount={maxCount}
                onClick={() => navigate(`/collections/${collection.id}`)}
              />
            ))}
          </div>
        </div>
      )}

      {topLocal.length > 0 && (
        <div className={s.card}>
          <div className={s.cardHeader}><TrendingUp size={13} /><span>Top Played</span></div>
          <div className={s.ptList}>
            {topLocal.map((item, i) => (
              <PlaytimeRow
                key={item.id}
                name={item.name}
                minutes={item.playtime_minutes}
                maxMinutes={maxPlaytime}
                rank={i}
                thumb={null}
              />
            ))}
          </div>
          <p className={s.cardNote}>Playtime is recorded when games are launched through YukiG.</p>
        </div>
      )}

      {/* Tags */}
      {db.tagBreakdown.length > 0 && (
        <div className={s.card}>
          <div className={s.cardHeader}><Tag size={13} /><span>Tags</span><span className={s.cardMeta}>{db.tagBreakdown.length} total</span></div>
          <div className={s.tagsWrap}>
            {db.tagBreakdown.map(({ tag, count }) => (
              <div key={tag.id} className={s.tag}
                style={{ borderColor: `${tag.color}55`, background: `${tag.color}10` }}>
                <span className={s.tagDot} style={{ background: tag.color }} />
                <span className={s.tagName}>{tag.name}</span>
                {count > 0 && <span className={s.tagCount} style={{ color: tag.color }}>{count}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
