/**
 * Resolves where clicking an item should navigate.
 *
 * Centralizes the "which route for this item" decision so every surface
 * (home, search, tags, tray) behaves the same. Steam games open on the Steam
 * page; a filed item opens its detail page under its collection; an un-filed
 * library item (no collection, e.g. an un-imported Steam game surfaced
 * elsewhere) also routes to the Steam page rather than a dead
 * `/collections/null/...` URL.
 */
import type { NavigateOptions, To } from "react-router-dom";

/** Minimal shape needed to route an item. */
interface RoutableItem {
  id: string;
  collection_id: string | null;
  strategy_type: string;
}

/** A resolved navigation target: the path plus optional router state. */
export interface ItemRoute {
  to: To;
  options?: NavigateOptions;
}

/**
 * Returns the navigation target for an item, or the Steam page as a fallback
 * when the item has no collection to open under.
 */
export function itemRoute(item: RoutableItem): ItemRoute {
  if (item.strategy_type === "steam_game" || !item.collection_id) {
    return { to: "/steam", options: { state: { openItemId: item.id } } };
  }
  return { to: `/collections/${item.collection_id}/items/${item.id}` };
}
