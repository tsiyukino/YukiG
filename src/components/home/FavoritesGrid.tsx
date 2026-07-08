/**
 * Shuffled favorites grid for the home page — covers local items and Steam
 * games uniformly. Shows exactly 2 rows based on measured container width;
 * "See more" reveals 2 more rows at a time.
 */
import { useState, useMemo, useRef, useEffect } from "react";
import { Gamepad2 } from "lucide-react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { FavoriteItem } from "@/types/item";
import { Collection } from "@/types/collection";
import { steamImageSrc } from "@/utils/pathUtils";
import styles from "./FavoritesGrid.module.css";

const CARD_WIDTH = 160;
const CARD_GAP = 8; /* var(--space-2) */

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface FavoritesGridProps {
  /** All favorites (local + Steam) from the home data hook. */
  favorites: FavoriteItem[];
  /** Collections, used to label local favorites. */
  collections: Collection[];
  /** Called with the clicked favorite. */
  onItemClick: (item: FavoriteItem) => void;
}

/**
 * Responsive favorite-card grid with progressive "See more" reveal.
 */
export default function FavoritesGrid({ favorites, collections, onItemClick }: FavoritesGridProps) {
  const shuffled = useMemo(() => shuffle(favorites), [favorites]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState(5);
  const [extraRows, setExtraRows] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      setCols(Math.max(1, Math.floor((w + CARD_GAP) / (CARD_WIDTH + CARD_GAP))));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (shuffled.length === 0) return null;

  const visible = cols * (2 + extraRows);
  const shown = shuffled.slice(0, visible);
  const hasMore = visible < shuffled.length;

  return (
    <div className={styles.wrap}>
      <div className={styles.grid} ref={containerRef}>
        {shown.map((fav, i) => {
          const isSteam = fav.strategy_type === "steam_game";
          const thumb = isSteam
            ? (fav.header_image ? steamImageSrc(fav.header_image) : null)
            : (fav.thumbnail_path ? convertFileSrc(fav.thumbnail_path) : null);
          const sub = isSteam
            ? "Steam"
            : (collections.find((c) => c.id === fav.collection_id)?.name ?? "");
          return (
            <FavCard
              key={fav.id}
              name={fav.name}
              thumb={thumb}
              sub={sub}
              eager={i < 10}
              onClick={() => onItemClick(fav)}
            />
          );
        })}
      </div>
      {hasMore && (
        <button className={styles.more} onClick={() => setExtraRows((r) => r + 2)}>
          See more · {shuffled.length - visible} remaining
        </button>
      )}
    </div>
  );
}

/** Uniform favorite card for both local items and Steam games. */
function FavCard({ name, thumb, sub, eager, onClick }: {
  name: string; thumb: string | null; sub: string; eager?: boolean; onClick?: () => void;
}) {
  return (
    <button className={styles.card} onClick={onClick}>
      <div className={styles.art}>
        {thumb
          ? <img
              src={thumb}
              alt=""
              className={styles.img}
              loading={eager ? "eager" : "lazy"}
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          : <Gamepad2 size={16} color="var(--color-text-muted)" strokeWidth={1.5} />
        }
      </div>
      <div className={styles.info}>
        <span className={styles.name}>{name}</span>
        <span className={styles.sub}>{sub}</span>
      </div>
    </button>
  );
}
