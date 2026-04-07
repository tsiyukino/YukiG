import { useMemo } from "react";
import { BarChart2, CheckCircle2, Clock, HardDrive, TrendingUp, Calendar, Circle } from "lucide-react";
import { useSteamStore } from "@/store/steamStore";
import SteamIcon from "@/components/common/SteamIcon";
import { steamImageSrc } from "@/utils/pathUtils";
import StatTile from "@/components/status/StatTile";
import PlaytimeRow from "@/components/status/PlaytimeRow";
import GameChip from "@/components/status/GameChip";
import InstalledDonut from "@/components/status/InstalledDonut";
import PlaytimeHistogram, { BucketEntry } from "@/components/status/PlaytimeHistogram";

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

function fmtBytes(bytes: number): string {
  if (bytes === 0) return "—";
  const gb = bytes / (1024 ** 3);
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / (1024 ** 2);
  return `${mb.toFixed(0)} MB`;
}

function fmtDate(ts: number): string {
  if (ts === 0) return "Never";
  return new Date(ts * 1000).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

interface SteamTabProps {
  /** Steam store state (games, loading, error). */
  steam: ReturnType<typeof useSteamStore>;
}

/**
 * Steam tab on the Status page.
 * Shows installed ratio donut, playtime histogram, top played chart, and recently played.
 */
export default function SteamTab({ steam }: SteamTabProps) {
  const games = steam.result?.games ?? [];
  const installed = games.filter((g) => g.is_installed);
  const totalDisk = installed.reduce((acc, g) => acc + g.size_on_disk, 0);
  const totalPlaytime = games.reduce((acc, g) => acc + g.playtime_minutes, 0);

  const topPlayed = useMemo(() =>
    [...games].filter((g) => g.playtime_minutes > 0)
      .sort((a, b) => b.playtime_minutes - a.playtime_minutes)
      .slice(0, 10),
    [games]
  );
  const recentlyPlayed = useMemo(() =>
    [...games].filter((g) => g.last_played > 0)
      .sort((a, b) => b.last_played - a.last_played)
      .slice(0, 6),
    [games]
  );
  const maxPlaytime = topPlayed[0]?.playtime_minutes ?? 1;

  // Build histogram for Steam games
  const steamHistBuckets: BucketEntry[] = useMemo(() =>
    BUCKETS.map((bucket) => ({
      bucket,
      games: games
        .filter((g) => {
          if (bucket.min === 0 && bucket.max === 1) return g.playtime_minutes === 0;
          return g.playtime_minutes >= bucket.min && g.playtime_minutes < bucket.max;
        })
        .map((g) => ({
          name: g.name,
          minutes: g.playtime_minutes,
          thumb: g.header_image ? steamImageSrc(g.header_image) : null,
          isSteam: true,
        })),
    })),
    [games]
  );

  if (steam.loading && games.length === 0) {
    return (
      <div className="stp-scan-wait">
        <div className="stp-scan-pulse" />
        <p className="stp-scan-text">Scanning Steam library…</p>
        <p className="stp-scan-sub">Reading appinfo.vdf and localconfig.vdf</p>
      </div>
    );
  }

  if (steam.error) {
    return <div className="stp-error">Steam scan failed: {steam.error}</div>;
  }

  return (
    <div className="stp-tab-body">
      <div className="stp-grid-4">
        <StatTile icon={<SteamIcon size={15} />} label="Total Games"
          value={games.length} accent="#1b9ae4" delay={0} />
        <StatTile icon={<CheckCircle2 size={15} />} label="Installed"
          value={installed.length}
          sub={games.length > 0 ? `${Math.round(installed.length / games.length * 100)}% of library` : undefined}
          accent="#22c55e" delay={50} />
        <StatTile icon={<Clock size={15} />} label="Total Playtime"
          value={fmtMinutes(totalPlaytime)} accent="#3b82f6" delay={100} />
        <StatTile icon={<HardDrive size={15} />} label="Disk Used"
          value={fmtBytes(totalDisk)} sub="installed only" accent="#f59e0b" delay={150} />
      </div>

      {/* Histogram */}
      <div className="stp-card">
        <div className="stp-card-header">
          <BarChart2 size={13} /><span>Playtime Distribution</span>
          {steam.loading && <span className="stp-badge-scan">updating…</span>}
          <span className="stp-card-meta">click bar to see games</span>
        </div>
        <PlaytimeHistogram buckets={steamHistBuckets} />
      </div>

      {/* Mid row */}
      <div className="stp-steam-mid">
        <div className="stp-card stp-card--center">
          <div className="stp-card-header"><Circle size={13} /><span>Installed Ratio</span></div>
          <InstalledDonut installed={installed.length} total={games.length} />
        </div>

        <div className="stp-card">
          <div className="stp-card-header">
            <Calendar size={13} /><span>Recently Played</span>
            {steam.loading && <span className="stp-badge-scan">updating…</span>}
          </div>
          {recentlyPlayed.length === 0
            ? <p className="stp-empty-inline">No play history found.</p>
            : (
              <div className="stp-chip-list">
                {recentlyPlayed.map((g) => (
                  <GameChip
                    key={g.app_id}
                    name={g.name}
                    sub={fmtDate(g.last_played)}
                    thumb={g.icon_url ? steamImageSrc(g.icon_url) : null}
                  />
                ))}
              </div>
            )
          }
        </div>
      </div>

      {/* Top played */}
      {topPlayed.length > 0 && (
        <div className="stp-card">
          <div className="stp-card-header">
            <TrendingUp size={13} /><span>Top Played</span>
            <span className="stp-card-meta">{topPlayed.length} games</span>
          </div>
          <div className="stp-pt-list">
            {topPlayed.map((g, i) => (
              <PlaytimeRow
                key={g.app_id}
                name={g.name}
                minutes={g.playtime_minutes}
                maxMinutes={maxPlaytime}
                rank={i}
                thumb={g.header_image ? steamImageSrc(g.header_image) : null}
              />
            ))}
          </div>
        </div>
      )}

      {/* Steam info */}
      {steam.result && (
        <div className="stp-card stp-card--muted">
          <div className="stp-card-header"><SteamIcon size={13} /><span>Steam Info</span></div>
          <div className="stp-meta-list">
            <div className="stp-meta-row">
              <span className="stp-meta-key">Path</span>
              <span className="stp-meta-val stp-meta-val--mono">{steam.result.steam_path}</span>
            </div>
            <div className="stp-meta-row">
              <span className="stp-meta-key">Accounts</span>
              <span className="stp-meta-val">{steam.result.users.length}</span>
            </div>
            <div className="stp-meta-row">
              <span className="stp-meta-key">Collections</span>
              <span className="stp-meta-val">{steam.result.collection_names.length}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
