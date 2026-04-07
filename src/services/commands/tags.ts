/**
 * Tauri command wrappers — Tags and Tag Groups domain.
 */
import { invoke } from "@tauri-apps/api/core";
import { Tag, TagGroup } from "@/types/tag";
import { Item } from "@/types/item";

/** A flat row associating an item with a tag, returned by `tag_get_by_collection`. */
export interface ItemTagRow {
  item_id: string;
  tag_id: string;
  tag_name: string;
  tag_color: string;
  /** `"regular"` or `"mood"`. */
  tag_type: string;
}

/**
 * Returns a map of tag_id → item count for every tag that has at least one item.
 * Uses a single SQL query — much faster than calling tagGetItems per tag.
 * @returns Record mapping tag_id to the number of items with that tag
 * @throws {string} If the query fails
 */
export async function tagGetItemCounts(): Promise<Record<string, number>> {
  return invoke("tag_get_item_counts");
}

/**
 * Retrieves all tags ordered alphabetically.
 * @returns Array of all tags
 * @throws {string} If the query fails
 */
export async function tagGetAll(): Promise<Tag[]> {
  return invoke("tag_get_all");
}

/**
 * Creates a new tag.
 * @param name - Unique tag name
 * @param color - Hex color string
 * @returns The created tag
 * @throws {string} If the name is not unique
 */
export async function tagCreate(name: string, color: string): Promise<Tag> {
  return invoke("tag_create", { name, color });
}

/**
 * Creates a new mood tag (`tag_type = 'mood'`).
 * Mood tags appear as filter chips on the Play page.
 * @param name - Unique tag name
 * @param color - Hex color string
 * @returns The created mood tag
 * @throws {string} If the name is not unique or the database write fails
 */
export async function tagCreateMood(name: string, color: string): Promise<Tag> {
  return invoke("tag_create_mood", { name, color });
}

/**
 * Ensures a mood tag with the given name exists, creating it if necessary.
 * Returns the existing tag (preserving its current colour) or the newly created one.
 * @param name - Tag name
 * @param color - Hex color to use if creating a new tag
 * @returns The existing or newly created mood tag
 * @throws {string} If the database operation fails
 */
export async function tagUpsertMood(name: string, color: string): Promise<Tag> {
  return invoke("tag_upsert_mood", { name, color });
}

/**
 * Deletes a tag by id. Cascades to all item_tags rows.
 * @param tagId - The tag UUID
 * @throws {string} If the delete fails
 */
export async function tagDelete(tagId: string): Promise<void> {
  return invoke("tag_delete", { tagId });
}

/**
 * Returns all tags assigned to a specific item.
 * @param itemId - The item UUID
 * @returns Array of tags ordered alphabetically
 * @throws {string} If the query fails
 */
export async function tagGetByItem(itemId: string): Promise<Tag[]> {
  return invoke("tag_get_by_item", { itemId });
}

/**
 * Assigns a tag to an item. No-ops if already assigned.
 * @param itemId - The item UUID
 * @param tagId - The tag UUID
 * @throws {string} If the operation fails
 */
export async function tagAssign(itemId: string, tagId: string): Promise<void> {
  return invoke("tag_assign", { itemId, tagId });
}

/**
 * Removes a tag from an item.
 * @param itemId - The item UUID
 * @param tagId - The tag UUID
 * @throws {string} If the operation fails
 */
export async function tagRemove(itemId: string, tagId: string): Promise<void> {
  return invoke("tag_remove", { itemId, tagId });
}

/**
 * Returns all item-tag associations for items in a collection.
 * @param collectionId - The collection UUID
 * @returns Flat list of item-tag rows
 * @throws {string} If the query fails
 */
export async function tagGetByCollection(collectionId: string): Promise<ItemTagRow[]> {
  return invoke("tag_get_by_collection", { collectionId });
}

/**
 * Returns all item-tag associations for a list of item ids in one query.
 * Used by the Play page to bulk-load mood-tag assignments.
 * @param itemIds - Array of item UUIDs
 * @returns Flat list of item-tag rows
 * @throws {string} If the query fails
 */
export async function tagGetByItemsBulk(itemIds: string[]): Promise<ItemTagRow[]> {
  return invoke("tag_get_by_items_bulk", { itemIds });
}

/**
 * Creates a new tag inside a specific group.
 * @param name - Tag display name
 * @param color - Hex color string
 * @param groupId - The tag group UUID to place the tag in
 */
export async function tagCreateInGroup(name: string, color: string, groupId: string): Promise<Tag> {
  return invoke("tag_create_in_group", { name, color, groupId });
}

/**
 * Moves a tag to a different group, or ungroups it (pass null).
 * @param tagId - The tag UUID
 * @param groupId - Target group UUID, or null to ungroup
 */
export async function tagSetGroup(tagId: string, groupId: string | null): Promise<Tag> {
  return invoke("tag_set_group", { tagId, groupId });
}

/**
 * Returns all items that have a specific tag assigned.
 * @param tagId - The tag UUID to filter by
 */
export async function tagGetItems(tagId: string): Promise<Item[]> {
  return invoke("tag_get_items", { tagId });
}

/**
 * Bulk-updates sort_order for multiple tags in one transaction.
 * @param order - Array of [id, sortOrder] pairs
 */
export async function tagReorder(order: [string, number][]): Promise<void> {
  return invoke("tag_reorder", { order });
}

// ─── Tag Groups ───────────────────────────────────────────────────────────────

/**
 * Returns all tag groups ordered by sort_order.
 */
export async function tagGroupGetAll(): Promise<TagGroup[]> {
  return invoke("tag_group_get_all");
}

/**
 * Creates a new tag group.
 * @param name - Group display name
 * @param prefix - Free-form prefix string (e.g. "genre:", "platform:")
 */
export async function tagGroupCreate(name: string, prefix: string): Promise<TagGroup> {
  return invoke("tag_group_create", { name, prefix });
}

/**
 * Updates a tag group's name and prefix.
 * @param groupId - The group UUID
 * @param name - New display name
 * @param prefix - New prefix string
 */
export async function tagGroupUpdate(groupId: string, name: string, prefix: string): Promise<TagGroup> {
  return invoke("tag_group_update", { groupId, name, prefix });
}

/**
 * Deletes a tag group. Tags in this group become ungrouped.
 * @param groupId - The group UUID to delete
 */
export async function tagGroupDelete(groupId: string): Promise<void> {
  return invoke("tag_group_delete", { groupId });
}

/**
 * Bulk-updates sort_order for multiple tag groups in one transaction.
 * @param order - Array of [id, sortOrder] pairs
 * @throws {string} If any update fails
 */
export async function tagGroupReorder(order: [string, number][]): Promise<void> {
  return invoke("tag_group_reorder", { order });
}
