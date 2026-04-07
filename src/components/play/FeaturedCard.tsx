/**
 * Featured game hero — full-width cinematic card.
 *
 * Layout:
 *   • Background: library_hero (3840×1240) stretched full width, darkened
 *   • Bottom overlay: gradient → title, chips, playtime on the left;
 *     portrait cover (library_image 600×900) pinned to the right
 *   • Action bar fixed at the bottom of the card
 */
import { useState, useEffect } from "react";
import { Play, SkipForward, CheckCircle, XCircle, AlarmClock, Clock } from "lucide-react";
import { PlayCandidate, SNOOZE_OPTIONS } from "@/hooks/usePlayPage";
import { StoryStatus } from "@/services/commands/play";
import { formatPlaytime } from "@/utils/formatPlaytime";
import { strategyGetMetadata } from "@/services/tauriCommands";
import { steamImageSrc } from "@/utils/pathUtils";
import { convertFileSrc } from "@tauri-apps/api/core";

interface Props {
  candidate: PlayCandidate;
  onLaunch: () => void;
  onSkip: () => void;
  onSetStatus: (status: StoryStatus) => void;
  onSnooze: (days: number) => void;
}

interface GameImages {
  hero: string;    // wide background
  cover: string;   // portrait cover on the right
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  unplayed:  { label: "Unplayed",  color: "#818cf8" },
  playing:   { label: "Playing",   color: "#4ade80" },
  on_hold:   { label: "On Hold",   color: "#fbbf24" },
  snoozed:   { label: "Snoozed",   color: "#94a3b8" },
  completed: { label: "Completed", color: "#38bdf8" },
  abandoned: { label: "Abandoned", color: "#f87171" },
};

function useGameImages(candidate: PlayCandidate): GameImages {
  const [imgs, setImgs] = useState<GameImages>({ hero: "", cover: "" });
  const { item } = candidate;

  useEffect(() => {
    setImgs({ hero: "", cover: "" });
    if (item.thumbnail_path) {
      const src = convertFileSrc(item.thumbnail_path);
      setImgs({ hero: src, cover: src });
      return;
    }
    strategyGetMetadata(item.id)
      .then((meta) => {
        setImgs({
          hero:  meta.library_hero  ? steamImageSrc(meta.library_hero)
               : meta.header_image  ? steamImageSrc(meta.header_image)  : "",
          cover: meta.library_image ? steamImageSrc(meta.library_image)
               : meta.header_image  ? steamImageSrc(meta.header_image)  : "",
        });
      })
      .catch(() => {});
  }, [item.id, item.thumbnail_path]);

  return imgs;
}

export default function FeaturedCard({ candidate, onLaunch, onSkip, onSetStatus, onSnooze }: Props) {
  const [showSnooze, setShowSnooze] = useState(false);
  const { item, status, totalPlayMinutes, lastLaunched, moodTags } = candidate;
  const imgs = useGameImages(candidate);
  const stMeta = STATUS_META[status.story_status] ?? { label: status.story_status, color: "#818cf8" };

  return (
    <div className="fc-root">
      {/* ── Wide background hero ── */}
      <div className="fc-bg">
        {imgs.hero
          ? <img src={imgs.hero} alt="" aria-hidden className="fc-bg-img" />
          : <div className="fc-bg-fallback" />
        }
        <div className="fc-bg-gradient" />
      </div>

      {/* ── Main content row ── */}
      <div className="fc-body">
        {/* Left: info */}
        <div className="fc-info">
          {/* Chips row */}
          <div className="fc-chips">
            <span
              className="fc-chip fc-chip--status"
              style={{ background: stMeta.color + "28", color: stMeta.color, borderColor: stMeta.color + "55" }}
            >
              {stMeta.label}
            </span>
            {status.online_status === "active" && (
              <span className="fc-chip fc-chip--online">● Online</span>
            )}
            {moodTags.map((t) => (
              <span
                key={t.id}
                className="fc-chip"
                style={{ background: t.color + "22", color: t.color, borderColor: t.color + "44" }}
              >
                {t.name}
              </span>
            ))}
          </div>

          {/* Title */}
          <h2 className="fc-title">{item.name}</h2>

          {/* Playtime */}
          <div className="fc-playtime">
            <Clock size={13} />
            <span>{formatPlaytime(totalPlayMinutes)}</span>
            {lastLaunched ? (
              <>
                <span className="fc-sep">·</span>
                <span>Last played {new Date(lastLaunched * 1000).toLocaleDateString()}</span>
              </>
            ) : null}
          </div>

          {/* Actions */}
          <div className="fc-actions">
            <button className="fc-btn fc-btn--launch" onClick={onLaunch}>
              <Play size={13} fill="currentColor" strokeWidth={0} />
              Launch
            </button>
            <button className="fc-btn fc-btn--ghost" onClick={onSkip}>
              <SkipForward size={14} />
              Skip
            </button>
            <div className="fc-divider" />
            <button className="fc-btn fc-btn--ghost fc-btn--completed" onClick={() => onSetStatus("completed")}>
              <CheckCircle size={14} />
              Completed
            </button>
            <button className="fc-btn fc-btn--ghost fc-btn--drop" onClick={() => onSetStatus("abandoned")}>
              <XCircle size={14} />
              Drop
            </button>
            <div className="fc-snooze">
              <button className="fc-btn fc-btn--ghost" onClick={() => setShowSnooze(v => !v)}>
                <AlarmClock size={14} />
                Snooze
              </button>
              {showSnooze && (
                <div className="fc-snooze-menu">
                  {SNOOZE_OPTIONS.map(opt => (
                    <button
                      key={opt.days}
                      className="fc-snooze-item"
                      onClick={() => { onSnooze(opt.days); setShowSnooze(false); }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: portrait cover */}
        {imgs.cover && (
          <div className="fc-cover">
            <img src={imgs.cover} alt={item.name} className="fc-cover-img" />
          </div>
        )}
      </div>

      <style>{`
        .fc-root {
          position: relative;
          width: 100%;
          border-radius: var(--radius-lg);
          overflow: hidden;
          background: #0d0d10;
          box-shadow: var(--shadow-lg);
          min-height: 320px;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
        }

        /* background */
        .fc-bg {
          position: absolute;
          inset: 0;
          z-index: 0;
        }
        .fc-bg-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center 25%;
          opacity: .55;
        }
        .fc-bg-fallback {
          width: 100%;
          height: 100%;
          background: linear-gradient(135deg, #1e1e2e 0%, #0d0d10 100%);
        }
        .fc-bg-gradient {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            to right,
            rgba(0,0,0,.85) 0%,
            rgba(0,0,0,.60) 50%,
            rgba(0,0,0,.05) 100%
          ),
          linear-gradient(
            to top,
            rgba(0,0,0,.75) 0%,
            transparent 60%
          );
        }

        /* body */
        .fc-body {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          padding: var(--space-6);
          gap: var(--space-6);
        }

        /* info column */
        .fc-info {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
          padding-bottom: 2px;
        }
        .fc-chips {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }
        .fc-chip {
          font-size: 11px;
          font-weight: 600;
          padding: 2px 9px;
          border-radius: var(--radius-full);
          border: 1px solid transparent;
          letter-spacing: .02em;
          white-space: nowrap;
        }
        .fc-chip--online {
          background: rgba(34,197,94,.18);
          color: #4ade80;
          border-color: rgba(34,197,94,.35);
        }
        .fc-title {
          font-size: 32px;
          font-weight: 800;
          color: #fff;
          line-height: 1.1;
          letter-spacing: -.01em;
          text-shadow: 0 2px 12px rgba(0,0,0,.6);
          /* allow wrapping for long titles */
          overflow-wrap: break-word;
        }
        .fc-playtime {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12.5px;
          color: rgba(255,255,255,.55);
        }
        .fc-sep { opacity: .4; }

        /* actions */
        .fc-actions {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          flex-wrap: wrap;
          padding-top: var(--space-1);
        }
        .fc-divider {
          width: 1px;
          height: 20px;
          background: rgba(255,255,255,.15);
          margin: 0 4px;
        }
        .fc-btn {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 7px 14px;
          border-radius: var(--radius-sm);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
          transition: background .12s, border-color .12s, color .12s;
        }
        .fc-btn--launch {
          background: linear-gradient(160deg, #818cf8 0%, #6366f1 55%, #4f46e5 100%);
          border: 1px solid rgba(129,140,248,.35);
          color: #fff;
          padding: 7px 16px;
          font-size: 13px;
          font-weight: 600;
          box-shadow: 0 2px 8px rgba(99,102,241,.4), inset 0 1px 0 rgba(255,255,255,.15);
          transition: background .15s, box-shadow .18s, transform .12s, border-color .15s;
        }
        .fc-btn--launch:hover {
          background: linear-gradient(160deg, #a5b4fc 0%, #818cf8 50%, #6366f1 100%);
          border-color: rgba(165,180,252,.45);
          box-shadow: 0 0 0 3px rgba(99,102,241,.2), 0 4px 14px rgba(99,102,241,.5), inset 0 1px 0 rgba(255,255,255,.2);
          transform: translateY(-1px);
        }
        .fc-btn--launch:active {
          transform: translateY(0);
          box-shadow: 0 1px 4px rgba(99,102,241,.35), inset 0 1px 0 rgba(255,255,255,.1);
        }
        .fc-btn--ghost {
          background: rgba(255,255,255,.08);
          border: 1px solid rgba(255,255,255,.14);
          color: rgba(255,255,255,.75);
          backdrop-filter: blur(6px);
        }
        .fc-btn--ghost:hover {
          background: rgba(255,255,255,.16);
          border-color: rgba(255,255,255,.28);
          color: #fff;
        }
        .fc-btn--drop:hover {
          background: rgba(239,68,68,.22);
          border-color: rgba(239,68,68,.4);
          color: #fca5a5;
        }
        .fc-btn--completed {
          background: rgba(34,197,94,.12);
          border-color: rgba(34,197,94,.35);
          color: #4ade80;
          box-shadow: 0 0 8px rgba(34,197,94,.25);
        }
        .fc-btn--completed:hover {
          background: rgba(34,197,94,.22);
          border-color: rgba(34,197,94,.55);
          color: #86efac;
          box-shadow: 0 0 14px rgba(34,197,94,.45), 0 0 0 3px rgba(34,197,94,.15);
        }

        /* snooze */
        .fc-snooze { position: relative; }
        .fc-snooze-menu {
          position: absolute;
          bottom: calc(100% + 6px);
          left: 0;
          background: var(--color-bg);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          box-shadow: var(--shadow-lg);
          min-width: 120px;
          z-index: 50;
          overflow: hidden;
        }
        .fc-snooze-item {
          display: block;
          width: 100%;
          padding: 8px 14px;
          text-align: left;
          background: none;
          border: none;
          font-size: 13px;
          color: var(--color-text-secondary);
          cursor: pointer;
        }
        .fc-snooze-item:hover {
          background: var(--color-bg-tertiary);
          color: var(--color-text-primary);
        }

        /* portrait cover */
        .fc-cover {
          flex-shrink: 0;
          width: 130px;
          height: 195px;
          border-radius: var(--radius-md);
          overflow: hidden;
          box-shadow: 0 8px 32px rgba(0,0,0,.6);
          border: 1px solid rgba(255,255,255,.08);
        }
        .fc-cover-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
      `}</style>
    </div>
  );
}
