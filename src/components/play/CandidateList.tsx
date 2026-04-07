/**
 * Horizontal scrolling row of candidate game cards shown below the featured hero.
 * Each card is 160px wide with a portrait cover, status dot, name, and playtime.
 */
import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { PlayCandidate } from "@/hooks/usePlayPage";
import { formatPlaytime } from "@/utils/formatPlaytime";
import { strategyGetMetadata } from "@/services/tauriCommands";
import { steamImageSrc } from "@/utils/pathUtils";
import { convertFileSrc } from "@tauri-apps/api/core";

interface Props {
  candidates: PlayCandidate[];
  onSelect: (candidate: PlayCandidate) => void;
}

const STATUS_COLORS: Record<string, string> = {
  unplayed:  "#818cf8",
  playing:   "#4ade80",
  on_hold:   "#fbbf24",
  completed: "#38bdf8",
  abandoned: "#f87171",
};

export default function CandidateList({ candidates, onSelect }: Props) {
  if (candidates.length === 0) {
    return <p className="cl-empty">No other candidates match the current filter.</p>;
  }

  return (
    <div className="cl-scroll">
      {candidates.map((c) => (
        <CandidateCard key={c.item.id} candidate={c} onSelect={onSelect} />
      ))}
      <style>{`
        .cl-scroll {
          display: flex;
          gap: var(--space-3);
          overflow-x: auto;
          padding-bottom: var(--space-1);
          /* negative margin trick so cards don't clip their hover shadow */
          padding-top: 4px;
          margin-top: -4px;
          scrollbar-width: thin;
          scrollbar-color: var(--color-border) transparent;
        }
        .cl-scroll::-webkit-scrollbar { height: 4px; }
        .cl-scroll::-webkit-scrollbar-track { background: transparent; }
        .cl-scroll::-webkit-scrollbar-thumb { background: var(--color-border); border-radius: 2px; }
        .cl-empty {
          font-size: 13px;
          color: var(--color-text-muted);
          padding: var(--space-3) 0;
        }
      `}</style>
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
    <button className="cc-root" onClick={() => onSelect(candidate)} title={item.name}>
      <div className="cc-art">
        {imgSrc
          ? <img src={imgSrc} alt={item.name} className="cc-img" />
          : <div className="cc-placeholder"><span className="cc-initial">{item.name[0]}</span></div>
        }
        <span className="cc-dot" style={{ background: dotColor }} />
      </div>
      <div className="cc-info">
        <span className="cc-name">{item.name}</span>
        <span className="cc-sub">
          <Clock size={10} />
          {formatPlaytime(totalPlayMinutes)}
        </span>
      </div>

      <style>{`
        .cc-root {
          flex-shrink: 0;
          width: 152px;
          display: flex;
          flex-direction: column;
          background: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          overflow: hidden;
          cursor: pointer;
          text-align: left;
          padding: 0;
          transition: border-color .15s, transform .15s, box-shadow .15s;
        }
        .cc-root:hover {
          border-color: var(--color-accent);
          transform: translateY(-3px);
          box-shadow: 0 8px 20px rgba(0,0,0,.18);
        }
        .cc-art {
          position: relative;
          width: 100%;
          /* 2:3 portrait ratio for library_image */
          aspect-ratio: 2 / 3;
          background: var(--color-bg-tertiary);
          overflow: hidden;
        }
        .cc-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .cc-placeholder {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .cc-initial {
          font-size: 28px;
          font-weight: 800;
          color: var(--color-text-muted);
          opacity: .5;
        }
        .cc-dot {
          position: absolute;
          top: 7px;
          right: 7px;
          width: 9px;
          height: 9px;
          border-radius: 50%;
          border: 2px solid var(--color-bg-secondary);
          box-shadow: 0 1px 4px rgba(0,0,0,.4);
        }
        .cc-info {
          padding: 8px 9px 9px;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }
        .cc-name {
          font-size: 12px;
          font-weight: 600;
          color: var(--color-text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          line-height: 1.3;
        }
        .cc-sub {
          display: flex;
          align-items: center;
          gap: 3px;
          font-size: 11px;
          color: var(--color-text-muted);
        }
      `}</style>
    </button>
  );
}
