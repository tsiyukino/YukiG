import { useState } from "react";
import { Gamepad2, X } from "lucide-react";

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

function fmtMinutes(mins: number): string {
  if (mins === 0) return "0h";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
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
    return (
      <p className="stp-empty-inline">No playtime data yet.</p>
    );
  }

  return (
    <div className="stp-hist-wrap">
      <div className="stp-hist-rows">
        {visible.map((entry) => {
          const count = entry.games.length;
          // sqrt scale keeps small buckets visible
          const pct = Math.sqrt(count / maxCount);
          const isOpen = openBucket?.bucket.label === entry.bucket.label;

          return (
            <button
              key={entry.bucket.label}
              className={`stp-hist-row${isOpen ? " stp-hist-row--open" : ""}`}
              onClick={() => setOpenBucket(isOpen ? null : entry)}
              title={`${entry.bucket.label}: ${count} game${count !== 1 ? "s" : ""}`}
            >
              {/* Label */}
              <span className="stp-hist-lbl">{entry.bucket.label}</span>

              {/* Bar track */}
              <span className="stp-hist-track">
                <span
                  className="stp-hist-fill"
                  style={{
                    width: `${pct * 100}%`,
                    background: entry.bucket.color,
                  }}
                />
              </span>

              {/* Count */}
              <span className="stp-hist-cnt">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Drill-down drawer */}
      {openBucket && (
        <div className="stp-drawer">
          <div className="stp-drawer-header">
            <span className="stp-drawer-dot" style={{ background: openBucket.bucket.color }} />
            <span className="stp-drawer-title">{openBucket.bucket.label}</span>
            <span className="stp-drawer-count">{openBucket.games.length} games</span>
            <button className="stp-drawer-close" onClick={() => setOpenBucket(null)}>
              <X size={13} />
            </button>
          </div>
          <div className="stp-drawer-list">
            {[...openBucket.games]
              .sort((a, b) => b.minutes - a.minutes)
              .map((g, i) => (
                <div key={i} className="stp-drawer-row">
                  <div className="stp-drawer-thumb">
                    {g.thumb
                      ? <img src={g.thumb} alt="" className="stp-drawer-thumb-img" loading="lazy" />
                      : <Gamepad2 size={11} color="var(--color-text-muted)" />}
                  </div>
                  <div className="stp-drawer-info">
                    <span className="stp-drawer-name">{g.name}</span>
                    {g.isSteam && <span className="stp-drawer-badge">Steam</span>}
                  </div>
                  <span className="stp-drawer-time">{g.minutes > 0 ? fmtMinutes(g.minutes) : "—"}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      <style>{`
        .stp-hist-wrap { padding: var(--space-2) var(--space-4) var(--space-3); display: flex; flex-direction: column; gap: var(--space-3); }

        .stp-hist-rows { display: flex; flex-direction: column; gap: 5px; }

        .stp-hist-row {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          width: 100%;
          border: none;
          background: none;
          padding: 3px 0;
          cursor: pointer;
          border-radius: var(--radius-sm);
          transition: background 0.12s;
          text-align: left;
        }
        .stp-hist-row:hover { background: var(--color-bg-secondary); }
        .stp-hist-row--open { background: var(--color-bg-secondary); }

        .stp-hist-lbl {
          font-size: 11px;
          color: var(--color-text-muted);
          min-width: 52px;
          text-align: right;
          flex-shrink: 0;
          user-select: none;
        }

        .stp-hist-track {
          flex: 1;
          height: 14px;
          background: var(--color-border);
          border-radius: 3px;
          overflow: hidden;
          min-width: 0;
        }

        .stp-hist-fill {
          display: block;
          height: 100%;
          border-radius: 3px;
          transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          min-width: 3px;
        }

        .stp-hist-cnt {
          font-size: 11px;
          font-weight: 600;
          color: var(--color-text-primary);
          min-width: 28px;
          text-align: left;
          flex-shrink: 0;
          user-select: none;
        }
      `}</style>
    </div>
  );
}
