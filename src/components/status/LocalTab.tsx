import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Layers, Gamepad2, Clock, Tag, TrendingUp, BarChart2 } from "lucide-react";
import { Collection } from "@/types/collection";
import { Item } from "@/types/item";
import { Tag as TagType } from "@/types/tag";
import StatTile from "@/components/status/StatTile";
import PlaytimeRow from "@/components/status/PlaytimeRow";
import PlaytimeHistogram, { BucketEntry } from "@/components/status/PlaytimeHistogram";
import CollectionRow from "@/components/status/CollectionRow";

/** Local item extended with playtime data from strategy metadata. */
interface LocalItem extends Item {
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

/** Playtime histogram bucket definition. */
interface Bucket {
  label: string;
  min: number;
  max: number;
  color: string;
}

const BUCKETS: Bucket[] = [
  { label: "Never",   min: 0,     max: 1,      color: "#94a3b8" },
  { label: "< 1h",    min: 1,     max: 60,     color: "#6366f1" },
  { label: "1–3h",    min: 60,    max: 180,    color: "#8b5cf6" },
  { label: "3–10h",   min: 180,   max: 600,    color: "#a78bfa" },
  { label: "10–30h",  min: 600,   max: 1800,   color: "#3b82f6" },
  { label: "30–100h", min: 1800,  max: 6000,   color: "#0ea5e9" },
  { label: "100h+",   min: 6000,  max: 30000,  color: "#22c55e" },
  { label: "500h+",   min: 30000, max: 60000,  color: "#10b981" },
  { label: "1000h+",  min: 60000, max: 300000, color: "#f59e0b" },
  { label: "5000h+",  min: 300000, max: Infinity, color: "#ef4444" },
];

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

/**
 * Local tab on the Status page.
 * Shows per-collection breakdown, top played local games, and playtime histogram.
 */
export default function LocalTab({ db }: LocalTabProps) {
  const navigate = useNavigate();
  const maxCount = db.collectionBreakdown[0]?.items.length ?? 1;
  const totalPlaytime = db.allLocalItems.reduce((s, i) => s + i.playtime_minutes, 0);

  const topLocal = useMemo(() =>
    [...db.allLocalItems].filter((i) => i.playtime_minutes > 0)
      .sort((a, b) => b.playtime_minutes - a.playtime_minutes)
      .slice(0, 8),
    [db]
  );
  const maxPlaytime = topLocal[0]?.playtime_minutes ?? 1;

  // Build histogram buckets for local games
  const localHistBuckets: BucketEntry[] = useMemo(() =>
    BUCKETS.map((bucket) => ({
      bucket,
      games: db.allLocalItems
        .filter((i) => {
          if (bucket.min === 0 && bucket.max === 1) return i.playtime_minutes === 0;
          return i.playtime_minutes >= bucket.min && i.playtime_minutes < bucket.max;
        })
        .map((i) => ({ name: i.name, minutes: i.playtime_minutes, thumb: null, isSteam: false })),
    })).filter((b) => b.games.length > 0),
    [db]
  );

  return (
    <div className="stp-tab-body">
      <div className="stp-grid-4">
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
        <div className="stp-empty-state">
          <Layers size={28} strokeWidth={1.5} color="var(--color-text-muted)" />
          <p>No collections yet. Create one from the Games page.</p>
        </div>
      ) : (
        <div className="stp-card">
          <div className="stp-card-header"><Layers size={13} /><span>Collections</span></div>
          <div className="stp-coll-list">
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

      {/* Top played local */}
      {topLocal.length > 0 && (
        <div className="stp-card">
          <div className="stp-card-header"><TrendingUp size={13} /><span>Top Played</span></div>
          <div className="stp-pt-list">
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
          <p className="stp-card-note">Playtime is recorded when games are launched through YukiG.</p>
        </div>
      )}

      {/* Playtime histogram */}
      {localHistBuckets.length > 0 && (
        <div className="stp-card">
          <div className="stp-card-header"><BarChart2 size={13} /><span>Playtime Distribution</span><span className="stp-card-meta">click a bar to see games</span></div>
          <PlaytimeHistogram buckets={localHistBuckets} />
        </div>
      )}

      {/* Tags */}
      {db.tagBreakdown.length > 0 && (
        <div className="stp-card">
          <div className="stp-card-header"><Tag size={13} /><span>Tags</span><span className="stp-card-meta">{db.tagBreakdown.length} total</span></div>
          <div className="stp-tags-wrap">
            {db.tagBreakdown.map(({ tag, count }) => (
              <div key={tag.id} className="stp-tag"
                style={{ borderColor: `${tag.color}55`, background: `${tag.color}10` }}>
                <span className="stp-tag-dot" style={{ background: tag.color }} />
                <span className="stp-tag-name">{tag.name}</span>
                {count > 0 && <span className="stp-tag-count" style={{ color: tag.color }}>{count}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
