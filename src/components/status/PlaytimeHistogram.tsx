import { useState } from "react";
import { Gamepad2, X } from "lucide-react";
import { formatHoursMinutes } from "@/utils/formatPlaytime";
import s from "./status.module.css";
import h from "./PlaytimeHistogram.module.css";

/** Playtime histogram bucket definition. */
interface Bucket {
  label: string;
  min: number;
  max: number;
  color: string;
}

/** A bucket entry pairing a bucket definition with the games that fall in it. */
export interface BucketEntry {
  bucket: Bucket;
  games: Array<{ name: string; minutes: number; thumb: string | null; isSteam: boolean }>;
}

interface PlaytimeHistogramProps {
  buckets: BucketEntry[];
}

/**
 * Horizontal bar chart of games grouped by playtime bucket.
 * Each row fills the full container width — no empty space on the right.
 * Clicking a row opens a drill-down drawer listing the games in that bucket.
 */
export default function PlaytimeHistogram({ buckets }: PlaytimeHistogramProps) {
  const [openBucket, setOpenBucket] = useState<BucketEntry | null>(null);

  const visible = buckets.filter((b) => b.games.length > 0);
  const maxCount = Math.max(...visible.map((b) => b.games.length), 1);

  if (visible.length === 0) {
    return <p className={s.emptyInline}>No playtime data yet.</p>;
  }

  return (
    <div className={h.wrap}>
      <div className={h.rows}>
        {visible.map((entry) => {
          const count = entry.games.length;
          // sqrt scale keeps small buckets visible
          const pct = Math.sqrt(count / maxCount);
          const isOpen = openBucket?.bucket.label === entry.bucket.label;

          return (
            <button
              key={entry.bucket.label}
              className={isOpen ? `${h.row} ${h.rowOpen}` : h.row}
              onClick={() => setOpenBucket(isOpen ? null : entry)}
              title={`${entry.bucket.label}: ${count} game${count !== 1 ? "s" : ""}`}
            >
              <span className={h.lbl}>{entry.bucket.label}</span>
              <span className={h.track}>
                <span
                  className={h.fill}
                  style={{
                    width: `${pct * 100}%`,
                    background: entry.bucket.color,
                  }}
                />
              </span>
              <span className={h.cnt}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Drill-down drawer */}
      {openBucket && (
        <div className={s.drawer}>
          <div className={s.drawerHeader}>
            <span className={s.drawerDot} style={{ background: openBucket.bucket.color }} />
            <span className={s.drawerTitle}>{openBucket.bucket.label}</span>
            <span className={s.drawerCount}>{openBucket.games.length} games</span>
            <button className={s.drawerClose} onClick={() => setOpenBucket(null)}>
              <X size={13} />
            </button>
          </div>
          <div className={s.drawerList}>
            {[...openBucket.games]
              .sort((a, b) => b.minutes - a.minutes)
              .map((g, i) => (
                <div key={i} className={s.drawerRow}>
                  <div className={s.drawerThumb}>
                    {g.thumb
                      ? <img src={g.thumb} alt="" className={s.drawerThumbImg} loading="lazy" />
                      : <Gamepad2 size={11} color="var(--color-text-muted)" />}
                  </div>
                  <div className={s.drawerInfo}>
                    <span className={s.drawerName}>{g.name}</span>
                    {g.isSteam && <span className={s.drawerBadge}>Steam</span>}
                  </div>
                  <span className={s.drawerTime}>{g.minutes > 0 ? formatHoursMinutes(g.minutes) : "—"}</span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
