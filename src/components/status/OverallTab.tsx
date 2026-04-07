import {
  Gamepad2, Clock, CheckCircle2, HardDrive, Heart, Tag,
  Layers, TrendingUp, Calendar,
} from "lucide-react";
import { useSteamStore } from "@/store/steamStore";
import SteamIcon from "@/components/common/SteamIcon";
import { steamImageSrc } from "@/utils/pathUtils";
import StatTile from "@/components/status/StatTile";
import { DbData } from "@/components/status/LocalTab";

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

interface OverallTabProps {
  /** Local DB statistics. */
  db: DbData;
  /** Steam store state (games, loading, error). */
  steam: ReturnType<typeof useSteamStore>;
}

interface SpotlightCardProps {
  eyebrow: React.ReactNode;
  heroSrc: string;
  name: string;
  meta: string;
}

/** Game spotlight card: portrait art with name+meta below. */
function SpotlightCard({ eyebrow, heroSrc, name, meta }: SpotlightCardProps) {
  return (
    <div className="stp-scard">
      <div className="stp-scard-eyebrow">{eyebrow}</div>
      <div className="stp-scard-art-wrap">
        <img src={heroSrc} alt="" className="stp-scard-art" loading="lazy"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
        <div className="stp-scard-gradient" />
      </div>
      <div className="stp-scard-foot">
        <span className="stp-scard-name">{name}</span>
        <span className="stp-scard-meta">{meta}</span>
      </div>
    </div>
  );
}

/**
 * Overall tab on the Status page.
 * Shows cross-platform hero metrics, platform summary cards, and game spotlights.
 */
export default function OverallTab({ db, steam }: OverallTabProps) {
  const steamGames = steam.result?.games ?? [];
  const installed = steamGames.filter((g) => g.is_installed);
  const steamPlaytime = steamGames.reduce((acc, g) => acc + g.playtime_minutes, 0);
  const localPlaytime = db.allLocalItems.reduce((acc, i) => acc + i.playtime_minutes, 0);
  const totalDisk = installed.reduce((acc, g) => acc + g.size_on_disk, 0);
  const totalGames = db.allLocalItems.length + steamGames.length;

  const topSteam = steamGames.filter((g) => g.playtime_minutes > 0)
    .sort((a, b) => b.playtime_minutes - a.playtime_minutes)[0] ?? null;
  const lastSteam = steamGames.filter((g) => g.last_played > 0)
    .sort((a, b) => b.last_played - a.last_played)[0] ?? null;
  const topLocal = db.allLocalItems.filter((i) => i.playtime_minutes > 0)
    .sort((a, b) => b.playtime_minutes - a.playtime_minutes)[0] ?? null;

  const showSpotlights = (topSteam || lastSteam) && !steam.loading;

  return (
    <div className="stp-tab-body">
      <div className="stp-grid-3-3">
        <StatTile icon={<Gamepad2 size={15} />} label="Total Games"
          value={totalGames} accent="#6366f1" delay={0}
          sub={`${db.allLocalItems.length} local · ${steamGames.length} Steam`} />
        <StatTile icon={<Clock size={15} />} label="Total Playtime"
          value={steam.loading ? "…" : fmtMinutes(steamPlaytime + localPlaytime)}
          sub={steam.loading ? "scanning Steam…" : "Steam + local"}
          accent="#3b82f6" delay={50} />
        <StatTile icon={<CheckCircle2 size={15} />} label="Steam Installed"
          value={steam.loading ? "…" : installed.length}
          sub={steam.loading ? "scanning…" : steamGames.length > 0 ? `${Math.round(installed.length / steamGames.length * 100)}% of library` : undefined}
          accent="#22c55e" delay={100} />
        <StatTile icon={<HardDrive size={15} />} label="Disk Used"
          value={steam.loading ? "…" : fmtBytes(totalDisk)}
          sub={steam.loading ? "scanning…" : "installed Steam games"}
          accent="#f59e0b" delay={150} />
        <StatTile icon={<Heart size={15} />} label="Favorites"
          value={db.favoriteCount} accent="#ec4899" delay={200} />
        <StatTile icon={<Tag size={15} />} label="Tags"
          value={db.tagBreakdown.length} accent="#10b981" delay={250} />
      </div>

      {/* Platform summary cards */}
      <div className="stp-platform-row">
        <div className="stp-pcard stp-pcard--local">
          <div className="stp-pcard-header">
            <div className="stp-pcard-icon stp-pcard-icon--local"><Layers size={13} /></div>
            <span className="stp-pcard-title">Local Library</span>
          </div>
          <div className="stp-pcard-stats">
            <div className="stp-pcard-stat">
              <span className="stp-pcard-num">{db.userCollections.length}</span>
              <span className="stp-pcard-lbl">Collections</span>
            </div>
            <div className="stp-pcard-div" />
            <div className="stp-pcard-stat">
              <span className="stp-pcard-num">{db.allLocalItems.length}</span>
              <span className="stp-pcard-lbl">Games</span>
            </div>
            <div className="stp-pcard-div" />
            <div className="stp-pcard-stat">
              <span className="stp-pcard-num">{localPlaytime > 0 ? fmtMinutes(localPlaytime) : "—"}</span>
              <span className="stp-pcard-lbl">Playtime</span>
            </div>
          </div>
          {topLocal && (
            <div className="stp-pcard-highlight">
              <Clock size={10} />
              <span>Most played: <strong>{topLocal.name}</strong> · {fmtMinutes(topLocal.playtime_minutes)}</span>
            </div>
          )}
        </div>

        <div className="stp-pcard stp-pcard--steam">
          <div className="stp-pcard-header">
            <div className="stp-pcard-icon stp-pcard-icon--steam"><SteamIcon size={13} /></div>
            <span className="stp-pcard-title">Steam</span>
            {steam.loading && <span className="stp-badge-scan">scanning…</span>}
          </div>
          <div className="stp-pcard-stats">
            <div className="stp-pcard-stat">
              <span className="stp-pcard-num">{steam.loading ? "…" : steamGames.length}</span>
              <span className="stp-pcard-lbl">Games</span>
            </div>
            <div className="stp-pcard-div" />
            <div className="stp-pcard-stat">
              <span className="stp-pcard-num">{steam.loading ? "…" : installed.length}</span>
              <span className="stp-pcard-lbl">Installed</span>
            </div>
            <div className="stp-pcard-div" />
            <div className="stp-pcard-stat">
              <span className="stp-pcard-num">{steam.loading ? "…" : fmtMinutes(steamPlaytime)}</span>
              <span className="stp-pcard-lbl">Playtime</span>
            </div>
          </div>
          {topSteam && !steam.loading && (
            <div className="stp-pcard-highlight">
              <TrendingUp size={10} />
              <span>Most played: <strong>{topSteam.name}</strong> · {fmtMinutes(topSteam.playtime_minutes)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Spotlights — portrait-style game cards */}
      {showSpotlights && (
        <div className="stp-spotlight-row">
          {topSteam && topSteam.library_image && (
            <SpotlightCard
              eyebrow={<><TrendingUp size={10} />All-Time Most Played</>}
              heroSrc={steamImageSrc(topSteam.library_image)}
              name={topSteam.name}
              meta={fmtMinutes(topSteam.playtime_minutes)}
            />
          )}
          {lastSteam && lastSteam.library_image && (
            <SpotlightCard
              eyebrow={<><Calendar size={10} />Last Played</>}
              heroSrc={steamImageSrc(lastSteam.library_image)}
              name={lastSteam.name}
              meta={fmtDate(lastSteam.last_played)}
            />
          )}
        </div>
      )}
    </div>
  );
}
