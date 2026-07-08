/**
 * Horizontal scrolling row of candidate game cards shown below the featured hero.
 * Each card is a portrait cover with a status dot, name, and playtime.
 */
import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { PlayCandidate } from "@/hooks/usePlayPage";
import { formatPlaytime } from "@/utils/formatPlaytime";
import { strategyGetMetadata } from "@/services/tauriCommands";
import { steamImageSrc } from "@/utils/pathUtils";
import { convertFileSrc } from "@tauri-apps/api/core";
import styles from "./CandidateList.module.css";

interface Props {
  candidates: PlayCandidate[];
  onSelect: (candidate: PlayCandidate) => void;
}

/** Status dot colors — shared palette with FeaturedCard's chips. */
const STATUS_COLORS: Record<string, string> = {
  unplayed:  "#818cf8",
  playing:   "#4ade80",
  on_hold:   "#fbbf24",
  completed: "#38bdf8",
  abandoned: "#f87171",
};

export default function CandidateList({ candidates, onSelect }: Props) {
  if (candidates.length === 0) {
    return <p className={styles.empty}>No other candidates match the current filter.</p>;
  }

  return (
    <div className={styles.scroll}>
      {candidates.map((c) => (
        <CandidateCard key={c.item.id} candidate={c} onSelect={onSelect} />
      ))}
    </div>
  );
}

interface CardProps {
  candidate: PlayCandidate;
  onSelect: (c: PlayCandidate) => void;
}

function CandidateCard({ candidate, onSelect }: CardProps) {
  const { item, status, totalPlayMinutes } = candidate;
  const [imgSrc, setImgSrc] = useState("");
  const dotColor = STATUS_COLORS[status.story_status] ?? "#818cf8";

  useEffect(() => {
    if (item.thumbnail_path) {
      setImgSrc(convertFileSrc(item.thumbnail_path));
      return;
    }
    strategyGetMetadata(item.id)
      .then((meta) => {
        setImgSrc(
          meta.library_image ? steamImageSrc(meta.library_image) :
          meta.header_image  ? steamImageSrc(meta.header_image)  : ""
        );
      })
      .catch(() => {});
  }, [item.id, item.thumbnail_path]);

  return (
    <button className={styles.card} onClick={() => onSelect(candidate)} title={item.name}>
      <div className={styles.art}>
        {imgSrc
          ? <img src={imgSrc} alt={item.name} className={styles.img} />
          : <div className={styles.placeholder}><span className={styles.initial}>{item.name[0]}</span></div>
        }
        <span className={styles.dot} style={{ background: dotColor }} />
      </div>
      <div className={styles.info}>
        <span className={styles.name}>{item.name}</span>
        <span className={styles.sub}>
          <Clock size={10} />
          {formatPlaytime(totalPlayMinutes)}
        </span>
      </div>
    </button>
  );
}
