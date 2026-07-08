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
import styles from "./FeaturedCard.module.css";

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

/** Display colors per story status — over-image chips, not theme colors. */
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
    <div className={styles.root}>
      <div className={styles.bg}>
        {imgs.hero
          ? <img src={imgs.hero} alt="" aria-hidden className={styles.bgImg} />
          : <div className={styles.bgFallback} />
        }
        <div className={styles.bgGradient} />
      </div>

      <div className={styles.body}>
        <div className={styles.info}>
          <div className={styles.chips}>
            <span
              className={styles.chip}
              style={{ background: stMeta.color + "28", color: stMeta.color, borderColor: stMeta.color + "55" }}
            >
              {stMeta.label}
            </span>
            {status.online_status === "active" && (
              <span className={`${styles.chip} ${styles.chipOnline}`}>● Online</span>
            )}
            {moodTags.map((t) => (
              <span
                key={t.id}
                className={styles.chip}
                style={{ background: t.color + "22", color: t.color, borderColor: t.color + "44" }}
              >
                {t.name}
              </span>
            ))}
          </div>

          <h2 className={styles.title}>{item.name}</h2>

          <div className={styles.playtime}>
            <Clock size={13} />
            <span>{formatPlaytime(totalPlayMinutes)}</span>
            {lastLaunched ? (
              <>
                <span className={styles.sep}>·</span>
                <span>Last played {new Date(lastLaunched * 1000).toLocaleDateString()}</span>
              </>
            ) : null}
          </div>

          <div className={styles.actions}>
            <button className={`${styles.btn} ${styles.launch}`} onClick={onLaunch}>
              <Play size={13} fill="currentColor" strokeWidth={0} />
              Launch
            </button>
            <button className={`${styles.btn} ${styles.ghost}`} onClick={onSkip}>
              <SkipForward size={14} />
              Skip
            </button>
            <div className={styles.divider} />
            <button className={`${styles.btn} ${styles.ghost} ${styles.completed}`} onClick={() => onSetStatus("completed")}>
              <CheckCircle size={14} />
              Completed
            </button>
            <button className={`${styles.btn} ${styles.ghost} ${styles.drop}`} onClick={() => onSetStatus("abandoned")}>
              <XCircle size={14} />
              Drop
            </button>
            <div className={styles.snooze}>
              <button className={`${styles.btn} ${styles.ghost}`} onClick={() => setShowSnooze(v => !v)}>
                <AlarmClock size={14} />
                Snooze
              </button>
              {showSnooze && (
                <div className={styles.snoozeMenu}>
                  {SNOOZE_OPTIONS.map(opt => (
                    <button
                      key={opt.days}
                      className={styles.snoozeItem}
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

        {imgs.cover && (
          <div className={styles.cover}>
            <img src={imgs.cover} alt={item.name} className={styles.coverImg} />
          </div>
        )}
      </div>
    </div>
  );
}
