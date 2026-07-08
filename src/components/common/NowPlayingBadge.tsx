/**
 * Badge shown on an item that is currently being played.
 *
 * Self-contained: subscribes to live play-session state via `usePlaySessions`
 * and renders nothing unless the given item is active. Any card can drop in
 * `<NowPlayingBadge itemId={item.id} />` with no prop plumbing — the single
 * subscription is shared through the hook.
 *
 * Composes the shared `nowPlaying.module.css` primitives so the live signal is
 * identical across every surface. Three variants cover the density tiers:
 * - `pill` (default): dot + "Playing" label, for grid cards
 * - `dot`: dot only, for space-constrained list rows
 * - `over-image`: stronger pill for overlaying cover art (gallery cards)
 */
import { usePlaySessions } from "@/hooks/usePlaySessions";
import np from "./nowPlaying.module.css";

/** Visual density variant. */
export type NowPlayingVariant = "pill" | "dot" | "over-image";

interface NowPlayingBadgeProps {
  /** UUID of the item this badge is attached to. */
  itemId: string;
  /** Visual variant; defaults to "pill". */
  variant?: NowPlayingVariant;
  /** Pill label; defaults to "Playing". Ignored for the `dot` variant. */
  label?: string;
}

/**
 * Renders a live "playing" indicator when `itemId` has an active session,
 * otherwise renders nothing.
 */
export default function NowPlayingBadge({
  itemId,
  variant = "pill",
  label = "Playing",
}: NowPlayingBadgeProps) {
  const playing = usePlaySessions();
  if (!playing.has(itemId)) return null;

  if (variant === "dot") {
    return (
      <span
        className={`${np.dot} ${np.dotSm}`}
        role="img"
        aria-label="Currently playing"
        title="This game is running"
      />
    );
  }

  const pillClass =
    variant === "over-image" ? `${np.pill} ${np.pillOverImage}` : np.pill;

  return (
    <span className={pillClass} title="This game is running">
      <span className={`${np.dot} ${np.dotMd}`} aria-hidden="true" />
      {label}
    </span>
  );
}
