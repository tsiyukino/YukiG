/**
 * Tauri command wrappers — Items domain.
 */
import { invoke } from "@tauri-apps/api/core";
import { Item, FavoriteItem } from "@/types/item";

/**
 * Retrieves all game root items (strategy_type 'game' + 'steam_game') across all collections.
 * Used by the Play page so both local and imported Steam games appear.
 * @returns Flat array ordered by collection then sort_order
 * @throws {string} If the query fails
 */
export async function itemGetAllGames(): Promise<Item[]> {
  return invoke("item_get_all_games");
}

/**
 * Retrieves all non-Steam root items across every collection in one query.
 * @returns Flat array of all local items ordered by collection then sort_order
 * @throws {string} If the query fails
 */
export async function itemGetAllLocal(): Promise<Item[]> {
  return invoke("item_get_all_local");
}

/**
 * Retrieves all items in a collection.
 * @param collectionId - The parent collection UUID
 * @returns Array of items ordered by sort_order, then name
 * @throws {string} If the query fails
 */
export async function itemGetByCollection(collectionId: string): Promise<Item[]> {
  return invoke("item_get_by_collection", { collectionId });
}

/**
 * Retrieves all child items of a virtual_folder or virtual_group item.
 * @param parentId - The parent item UUID
 * @returns Ordered list of child items
 * @throws {string} If the query fails
 */
export async function itemGetByParent(parentId: string): Promise<Item[]> {
  return invoke("item_get_by_parent", { parentId });
}

/**
 * Retrieves a single item by UUID.
 * @param id - The item UUID
 * @returns The matching item
 * @throws {string} If the id does not exist
 */
export async function itemGetById(id: string): Promise<Item> {
  return invoke("item_get_by_id", { id });
}

/**
 * Creates a new item in a collection.
 * @param collectionId - The parent collection UUID
 * @param name - Display name for the item
 * @param folderPath - Absolute path to the folder
 * @param strategyType - Strategy identifier (e.g., "game", "steam_game")
 * @param description - Optional description
 * @param parentId - Optional parent item UUID for nesting
 * @returns The created item record
 * @throws {string} If the collection does not exist or insert fails
 */
export async function itemCreate(
  collectionId: string,
  name: string,
  folderPath: string,
  strategyType: string,
  description: string,
  parentId?: string | null
): Promise<Item> {
  return invoke("item_create", {
    collectionId,
    name,
    folderPath,
    strategyType,
    description,
    parentId: parentId ?? null,
  });
}

/**
 * Updates an item's name, description, strategy_type, notes, and/or parent.
 * @param id - The item UUID
 * @param name - New display name (optional)
 * @param description - New description (optional)
 * @param strategyType - New strategy type (optional)
 * @param notes - New notes (optional)
 * @param parentId - New parent item UUID or null to move to root (optional)
 * @returns The updated item record
 * @throws {string} If the update fails
 */
export async function itemUpdate(
  id: string,
  name?: string,
  description?: string,
  strategyType?: string,
  notes?: string,
  parentId?: string | null
): Promise<Item> {
  return invoke("item_update", { id, name, description, strategyType, notes, parentId });
}

/**
 * Moves an item to a new parent folder/group, or to the collection root.
 * @param id - The item UUID to move
 * @param newParentId - UUID of the target folder/group, or null to move to root
 * @returns The updated item record
 * @throws {string} If the item does not exist or the update fails
 */
export async function itemReparent(id: string, newParentId: string | null): Promise<Item> {
  return invoke("item_reparent", { id, newParentId });
}

/**
 * Deletes an item and its associated metadata and tags.
 * @param id - The item UUID
 * @throws {string} If the delete fails
 */
export async function itemDelete(id: string): Promise<void> {
  return invoke("item_delete", { id });
}

/**
 * Returns all favorited items in a collection.
 * @param collectionId - The collection UUID
 * @returns Array of favorited items
 * @throws {string} If the query fails
 */
export async function itemGetFavorites(collectionId: string): Promise<Item[]> {
  return invoke("item_get_favorites", { collectionId });
}

/**
 * Returns every favorited item across all collections, with header_image and
 * icon_url metadata joined in.
 * @returns Array of FavoriteItem (Item + optional art metadata)
 * @throws {string} If the query fails
 */
export async function itemGetAllFavorites(): Promise<FavoriteItem[]> {
  return invoke("item_get_all_favorites");
}

/**
 * Sets or clears the favorite flag on an item.
 * @param id - The item UUID
 * @param isFavorite - True to mark as favorite, false to unmark
 * @returns The updated item record
 * @throws {string} If the item does not exist or the update fails
 */
export async function itemSetFavorite(id: string, isFavorite: boolean): Promise<Item> {
  return invoke("item_set_favorite", { id, isFavorite });
}

/**
 * Bulk-updates sort_order for multiple items in one transaction.
 * @param order - Array of [id, sortOrder] pairs
 * @throws {string} If any update fails
 */
export async function itemReorder(order: [string, number][]): Promise<void> {
  return invoke("item_reorder", { order });
}

/**
 * Deletes a folder item and all of its descendants recursively.
 * Unlike itemDelete, this cascades through the entire tree.
 * @param id - The folder item UUID
 */
export async function folderDelete(id: string): Promise<void> {
  return invoke("folder_delete", { id });
}
