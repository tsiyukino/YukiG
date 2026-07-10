/**
 * Helpers for a collection's platform source.
 *
 * A collection created by a platform sync (Steam) is marked with
 * `default_strategy = "steam_game"`. The Games page hides these — the Steam
 * library is browsed on the Steam page, not as a user storage folder.
 */
import { Collection } from "@/types/collection";

/** True when a collection is a platform (Steam) container, not a user folder. */
export function isPlatformCollection(c: Pick<Collection, "default_strategy">): boolean {
  return c.default_strategy === "steam_game";
}
