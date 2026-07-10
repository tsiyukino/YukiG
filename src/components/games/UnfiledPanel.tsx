/**
 * Right-hand staging column on the Games page: games not filed in any
 * collection (library root). Games are dragged from here onto a collection to
 * file them. Collapsible via a bookmark handle on its left edge.
 */
import { ChevronRight, Gamepad2 } from "lucide-react";
import { FavoriteItem } from "@/types/item";
import { steamImageSrc } from "@/utils/pathUtils";
import { convertFileSrc } from "@tauri-apps/api/core";
import { useNavigate } from "react-router-dom";
import { itemRoute } from "@/utils/itemNavigation";
import styles from "./UnfiledPanel.module.css";

/** Best-effort cover for a game. */
function coverOf(g: FavoriteItem): string | null {
  return g.icon_url
    ? steamImageSrc(g.icon_url)
    : g.header_image
    ? steamImageSrc(g.header_image)
    : g.thumbnail_path
    ? convertFileSrc(g.thumbnail_path)
    : null;
}

interface UnfiledPanelProps {
  games: FavoriteItem[];
  loading: boolean;
  /** Collapsed state is owned by the page so it can also animate the layout. */
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

/**
 * Collapsible column of unfiled games. Each game is draggable (dataTransfer
 * carries its item id) so it can be dropped onto a collection to file it.
 */
export default function UnfiledPanel({ games, loading, collapsed, onToggleCollapsed }: UnfiledPanelProps) {
  const navigate = useNavigate();

  return (
    <div className={collapsed ? `${styles.panel} ${styles.collapsed}` : styles.panel}>
      {/* Bookmark handle on the seam — no divider line, a tab with a chevron. */}
      <button
        className={styles.handle}
        onClick={onToggleCollapsed}
        title={collapsed ? "Show unfiled games" : "Hide unfiled games"}
        aria-expanded={!collapsed}
      >
        <ChevronRight size={14} className={collapsed ? styles.chevronCollapsed : styles.chevron} />
      </button>

      <div className={styles.body}>
          <div className={styles.header}>
            <span className={styles.title}>Unfiled</span>
            <span className={styles.count}>{games.length}</span>
          </div>

          {loading ? (
            <div className={styles.empty}>Loading…</div>
          ) : games.length === 0 ? (
            <div className={styles.empty}>
              <Gamepad2 size={18} />
              <span>No unfiled games</span>
            </div>
          ) : (
            <div className={styles.list}>
              {games.map((g) => {
                const cover = coverOf(g);
                return (
                  <div
                    key={g.id}
                    className={styles.game}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("application/x-yukig-item", g.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onClick={() => { const { to, options } = itemRoute(g); navigate(to, options); }}
                    title={g.name}
                  >
                    <span className={styles.cover}>
                      {cover ? <img src={cover} alt="" loading="lazy" /> : <Gamepad2 size={14} />}
                    </span>
                    <span className={styles.name}>{g.name}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
    </div>
  );
}
