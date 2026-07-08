/**
 * Greeting hero for the home page — time-of-day gradient background,
 * date + greeting on the left, featured favorite card on the right.
 */
import { FolderOpen, Heart, ArrowRight, Star } from "lucide-react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { FavoriteItem } from "@/types/item";
import styles from "./HeroSection.module.css";

type TimeOfDay = "morning" | "afternoon" | "evening" | "night";

function getTimeOfDay(): TimeOfDay {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "morning";
  if (h >= 12 && h < 17) return "afternoon";
  if (h >= 17 && h < 21) return "evening";
  return "night";
}

const GREETINGS: Record<TimeOfDay, string> = {
  morning: "Good morning", afternoon: "Good afternoon",
  evening: "Good evening", night: "Good night",
};
// One accent hue per time of day — the single source of truth for both the
// wash and the accent bar. RGB triplets so the wash can vary alpha without
// duplicating the color.
const HERO_HUE: Record<TimeOfDay, string> = {
  morning: "251, 191, 36",   // amber  — dawn
  afternoon: "99, 102, 241", // indigo — day
  evening: "139, 92, 246",   // violet — dusk
  night: "129, 140, 248",    // soft indigo — night
};

/**
 * A low-opacity accent wash for the given time of day. It composites over the
 * hero's own `--color-bg` surface, so it stays legible in both light and dark
 * themes — the greeting text uses semantic tokens and never fights the backdrop.
 */
function heroWash(tod: TimeOfDay): string {
  const hue = HERO_HUE[tod];
  return (
    `radial-gradient(ellipse 70% 130% at 92% 0%, rgba(${hue}, 0.16) 0%, transparent 55%), ` +
    `linear-gradient(135deg, rgba(${hue}, 0.10) 0%, rgba(${hue}, 0.02) 100%)`
  );
}

function formatDate(): string {
  return new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

interface HeroSectionProps {
  /** The favorite to feature in the hero panel, if any. */
  featured: FavoriteItem | null;
  /** Name of the featured item's collection. */
  collectionName?: string;
  /** Accent color of the featured item's collection. */
  collectionColor?: string;
  /** Opens the featured item's detail page. */
  onOpenFeatured: () => void;
}

/**
 * Time-of-day greeting hero with an optional featured favorite card.
 */
export default function HeroSection({
  featured,
  collectionName,
  collectionColor,
  onOpenFeatured,
}: HeroSectionProps) {
  const tod = getTimeOfDay();

  return (
    <div className={styles.hero} style={{ backgroundImage: heroWash(tod) }}>
      <div className={styles.accentBar} style={{ background: `rgb(${HERO_HUE[tod]})` }} />
      <div className={styles.left}>
        <p className={styles.date}>{formatDate()}</p>
        <h1 className={styles.greeting}>{GREETINGS[tod]}</h1>
        <p className={styles.sub}>Welcome back to your library.</p>
      </div>
      <div className={styles.right}>
        {featured && collectionColor ? (
          <FeaturedFavorite
            item={featured}
            collectionName={collectionName ?? ""}
            collectionColor={collectionColor}
            onOpen={onOpenFeatured}
          />
        ) : (
          <div className={`${styles.featured} ${styles.featuredEmpty}`}>
            <Star size={18} color="var(--color-text-muted)" />
            <span className={styles.emptyText}>Mark an item as a favorite<br />and it will appear here.</span>
          </div>
        )}
      </div>
    </div>
  );
}

function FeaturedFavorite({ item, collectionName, collectionColor, onOpen }: {
  item: FavoriteItem; collectionName: string; collectionColor: string; onOpen: () => void;
}) {
  const src = item.thumbnail_path ? convertFileSrc(item.thumbnail_path) : null;
  return (
    <div
      className={styles.featured}
      style={{ boxShadow: `0 4px 24px ${collectionColor}30, var(--shadow-sm)` }}
    >
      <div className={styles.icon} style={{ background: `${collectionColor}25` }}>
        {src ? <img src={src} alt="" className={styles.img} /> : <FolderOpen size={22} color={collectionColor} />}
      </div>
      <div className={styles.body}>
        <span className={styles.eyebrow}><Heart size={10} style={{ display: "inline", marginRight: 4 }} />Favorite</span>
        <span className={styles.name}>{item.name}</span>
        <span className={styles.coll} style={{ color: collectionColor }}>{collectionName}</span>
      </div>
      <button className={styles.openBtn} onClick={onOpen} style={{ background: collectionColor }}>
        Open <ArrowRight size={11} />
      </button>
    </div>
  );
}
