/**
 * Home-page aggregate "now playing" entry.
 *
 * Solves the "1 to N games running" display problem the same way Steam /
 * Discord / Figma do — degrade by count, never break layout:
 * - 0 playing → renders nothing
 * - 1 playing → rich: cover + name + green live dot
 * - N playing → avatar-stack of up to 3 covers (+overflow) + "N playing" count,
 *   click to expand a compact list
 *
 * Resolves active item ids against the home page's `allItems` (which already
 * carry name + cover), so no extra backend query is needed. Green is the live
 * signal everywhere; text always accompanies it (never color alone).
 */
import { useState } from "react";
import { FavoriteItem } from "@/types/item";
import { usePlaySessions } from "@/hooks/usePlaySessions";
import np from "@/components/common/nowPlaying.module.css";
import styles from "./NowPlayingBanner.module.css";

/** Resolves a best-effort cover image URL for a game, or null. */
function coverOf(item: FavoriteItem): string | null {
  return item.icon_url ?? item.header_image ?? item.thumbnail_path ?? null;
}

interface NowPlayingBannerProps {
  /** All library items (with name + cover), used to resolve active sessions. */
  allItems: FavoriteItem[];
  /** Called with an item when its entry is clicked. */
  onOpen: (item: FavoriteItem) => void;
}

/**
 * Renders the aggregate now-playing entry, or nothing when no game is running.
 */
export default function NowPlayingBanner({ allItems, onOpen }: NowPlayingBannerProps) {
  const playing = usePlaySessions();
  const [expanded, setExpanded] = useState(false);

  const games = allItems.filter((it) => playing.has(it.id));
  if (games.length === 0) return null;

  // Single game — rich presentation.
  if (games.length === 1) {
    const game = games[0];
    const cover = coverOf(game);
    return (
      <button className={styles.single} onClick={() => onOpen(game)} title={`${game.name} — playing now`}>
        <span className={styles.cover}>
          {cover ? <img src={cover} alt="" /> : <span className={styles.coverFallback} />}
          <span className={`${np.dot} ${np.dotLg} ${styles.coverDot}`} aria-hidden="true" />
        </span>
        <span className={styles.singleText}>
          <span className={styles.label}>Now playing</span>
          <span className={styles.name}>{game.name}</span>
        </span>
      </button>
    );
  }

  // Multiple games — avatar stack + count, expandable.
  const shown = games.slice(0, 3);
  const overflow = games.length - shown.length;
  return (
    <div className={styles.multi}>
      <button
        className={styles.multiHeader}
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        title={`${games.length} games playing`}
      >
        <span className={styles.stack}>
          {shown.map((game) => {
            const cover = coverOf(game);
            return (
              <span key={game.id} className={styles.stackItem}>
                {cover ? <img src={cover} alt="" /> : <span className={styles.coverFallback} />}
              </span>
            );
          })}
          {overflow > 0 && <span className={styles.stackMore}>+{overflow}</span>}
        </span>
        <span className={styles.multiCount}>
          <span className={`${np.dot} ${np.dotMd}`} aria-hidden="true" />
          {games.length} playing
        </span>
      </button>

      {expanded && (
        <ul className={styles.list}>
          {games.map((game) => {
            const cover = coverOf(game);
            return (
              <li key={game.id}>
                <button className={styles.listRow} onClick={() => onOpen(game)}>
                  <span className={styles.listCover}>
                    {cover ? <img src={cover} alt="" /> : <span className={styles.coverFallback} />}
                  </span>
                  <span className={styles.listName}>{game.name}</span>
                  <span className={`${np.dot} ${np.dotSm}`} aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
