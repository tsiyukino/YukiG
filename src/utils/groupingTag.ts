/**
 * Transitional adapter: presents a grouping tag as a Collection.
 *
 * Collections were migrated into grouping tags (migration 015). While the UI is
 * switched over incrementally, this maps a grouping `Tag` to the `Collection`
 * shape the existing views still expect, so data can come from grouping tags
 * without rewriting every consumer at once.
 *
 * Remove this once the views consume `Tag` directly (stage 3e).
 */
import { Tag } from "@/types/tag";
import { Collection } from "@/types/collection";

/** Well-known id of the system Steam grouping tag (migrations 014/015). */
export const STEAM_GROUPING_ID = "steam-system";

/** True when a collection/grouping is sourced from a platform (Steam), not local. */
export function isPlatformCollection(c: { id: string }): boolean {
  return c.id === STEAM_GROUPING_ID;
}

/**
 * Adapts a grouping tag to a Collection. `default_strategy` is derived so the
 * Steam grouping tag keeps being treated as the Steam collection; timestamps
 * are not carried on tags and are stubbed (no view reads them).
 */
export function groupingTagToCollection(tag: Tag): Collection {
  return {
    id: tag.id,
    name: tag.name,
    icon: tag.icon,
    color: tag.color,
    description: tag.description,
    default_strategy: tag.id === STEAM_GROUPING_ID ? "steam_game" : "",
    sort_order: tag.sort_order,
    created_at: "",
    updated_at: "",
  };
}
