/**
 * Shared launch-button state for item cards and rows.
 * Owns the in-flight flag and swallows launch errors uniformly.
 */
import { useState } from "react";
import { Item } from "@/types/item";
import { strategyExecuteLaunchTracked } from "@/services/tauriCommands";

/** What a launch button needs: the in-flight flag and the click handler. */
export interface GameLaunch {
  /** True from launch until the game process exits (tracked launch). */
  launching: boolean;
  /** Click handler — stops propagation so the card's onClick doesn't fire. */
  launch: (e: React.MouseEvent) => void;
}

/**
 * Returns launch state and a click handler for the given item.
 * Launches are tracked: playtime and last_launched are recorded, so the
 * tray's recent-games list stays accurate for card launches too.
 * Errors are silently ignored — there is no toast system yet.
 */
export function useGameLaunch(item: Item): GameLaunch {
  const [launching, setLaunching] = useState(false);

  async function launch(e: React.MouseEvent) {
    e.stopPropagation();
    setLaunching(true);
    try {
      await strategyExecuteLaunchTracked(item.id);
    } catch {
      // Silently ignore — nothing to show without a toast system
    } finally {
      setLaunching(false);
    }
  }

  return { launching, launch };
}
