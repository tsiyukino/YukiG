/**
 * Resolves where clicking an item should navigate.
 *
 * The item's source is its `strategy_type` (`steam_game` = Steam, `game` =
 * local, etc.) — one strategy per platform — so that alone decides the route,
 * not whether it happens to be filed in a collection. Steam games open on the
 * Steam page; every other item opens the standalone detail page, which works
 * whether or not the item belongs to a group.
 */
import type { NavigateOptions, To } from "react-router-dom";

/** Minimal shape needed to route an item. */
interface RoutableItem {
  id: string;
  strategy_type: string;
}

/** A resolved navigation target: the path plus optional router state. */
export interface ItemRoute {
  to: To;
  options?: NavigateOptions;
}

/**
 * Returns the navigation target for an item.
 */
export function itemRoute(item: RoutableItem): ItemRoute {
  if (item.strategy_type === "steam_game") {
    return { to: "/steam", options: { state: { openItemId: item.id } } };
  }
  return { to: `/items/${item.id}` };
}
