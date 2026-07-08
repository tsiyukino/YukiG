/**
 * Stats strip for the home page — one tinted stat card per metric.
 */
import { ReactNode } from "react";
import { Layers, FileText, Heart, Tag } from "lucide-react";
import styles from "./StatsStrip.module.css";

/** The dashboard counters shown on the home page. */
export interface HomeStats {
  collections: number;
  games: number;
  favorites: number;
  tags: number;
}

/** Decorative category hues for the stat icons (data, not theme tokens). */
const STATS: { key: keyof HomeStats; label: string; accent: string; icon: ReactNode }[] = [
  { key: "collections", label: "Collections", accent: "#6366f1", icon: <Layers size={15} /> },
  { key: "games",       label: "Games",       accent: "#3b82f6", icon: <FileText size={15} /> },
  { key: "favorites",   label: "Favorites",   accent: "#ec4899", icon: <Heart size={15} /> },
  { key: "tags",        label: "Tags",        accent: "#10b981", icon: <Tag size={15} /> },
];

/**
 * Renders the four dashboard counters in a responsive grid.
 */
export default function StatsStrip({ stats }: { stats: HomeStats }) {
  return (
    <div className={styles.strip}>
      {STATS.map(({ key, label, accent, icon }) => (
        <div key={key} className={styles.stat}>
          <div className={styles.icon} style={{ background: `${accent}18`, color: accent }}>
            {icon}
          </div>
          <div className={styles.body}>
            <span className={styles.value}>{stats[key]}</span>
            <span className={styles.label}>{label}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
