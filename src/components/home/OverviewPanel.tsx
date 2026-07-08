/**
 * Compact overview navigation panel for the home page —
 * icon, title, subtitle, thumbnail mosaic, and a chevron.
 * Used for both the Collections and Steam entries.
 */
import { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import styles from "./OverviewPanel.module.css";

interface OverviewPanelProps {
  /** Leading icon inside the tinted square. */
  icon: ReactNode;
  /** Panel title, e.g. "My Collections". */
  title: string;
  /** Subtitle line, e.g. "3 collections · 42 items". */
  meta: string;
  /** Thumbnail URLs rendered as a right-aligned mosaic. */
  mosaicUrls: string[];
  /** Fallback icon when there are no mosaic images. */
  emptyIcon?: ReactNode;
  /** Navigation handler. */
  onClick: () => void;
}

/**
 * Clickable overview row linking to a library section.
 */
export default function OverviewPanel({
  icon,
  title,
  meta,
  mosaicUrls,
  emptyIcon,
  onClick,
}: OverviewPanelProps) {
  return (
    <button className={styles.panel} onClick={onClick}>
      <div className={styles.left}>
        <div className={styles.icon}>{icon}</div>
        <div className={styles.info}>
          <span className={styles.title}>{title}</span>
          <span className={styles.meta}>{meta}</span>
        </div>
      </div>
      <div className={styles.mosaic}>
        {mosaicUrls.length > 0
          ? mosaicUrls.map((url, i) => (
              <img key={i} src={url} alt="" className={styles.mosaicImg} loading="lazy"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            ))
          : (emptyIcon ?? null)
        }
      </div>
      <ArrowRight size={13} className={styles.arrow} />
    </button>
  );
}
