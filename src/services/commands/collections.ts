/**
 * Tauri command wrappers — Collections domain.
 */
import { invoke } from "@tauri-apps/api/core";
import { Collection, NewCollection, UpdateCollection } from "@/types/collection";

/**
 * Retrieves all collections ordered by sort_order, then name.
 * @returns Array of all collections
 * @throws {string} If the database query fails
 */
export async function collectionGetAll(): Promise<Collection[]> {
  return invoke("collection_get_all");
}

/**
 * Retrieves a single collection by UUID.
 * @param id - The collection UUID
 * @returns The matching collection
 * @throws {string} If the id does not exist
 */
export async function collectionGetById(id: string): Promise<Collection> {
  return invoke("collection_get_by_id", { id });
}

/**
 * Creates a new collection.
 * @param input - The new collection data
 * @returns The created collection record
 * @throws {string} If the name is already taken
 */
export async function collectionCreate(input: NewCollection): Promise<Collection> {
  return invoke("collection_create", {
    name: input.name,
    icon: input.icon,
    color: input.color,
    description: input.description,
    defaultStrategy: input.default_strategy,
  });
}

/**
 * Updates an existing collection. Only provided fields are changed.
 * @param id - The collection UUID
 * @param input - Fields to update (all optional)
 * @returns The updated collection record
 * @throws {string} If the id does not exist or new name is taken
 */
export async function collectionUpdate(id: string, input: UpdateCollection): Promise<Collection> {
  return invoke("collection_update", {
    id,
    name: input.name,
    icon: input.icon,
    color: input.color,
    description: input.description,
    defaultStrategy: input.default_strategy,
    sortOrder: input.sort_order,
  });
}

/**
 * Deletes a collection and all its items.
 * @param id - The collection UUID
 * @throws {string} If the delete fails
 */
export async function collectionDelete(id: string): Promise<void> {
  return invoke("collection_delete", { id });
}

/**
 * Bulk-updates sort_order for multiple collections in one transaction.
 * @param order - Array of [id, sortOrder] pairs
 * @throws {string} If any update fails
 */
export async function collectionReorder(order: [string, number][]): Promise<void> {
  return invoke("collection_reorder", { order });
}
