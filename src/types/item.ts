/**
 * TypeScript types for the item domain.
 * Mirror the Rust `Item` struct.
 */

/** A folder (or file) added to a collection. */
export interface Item {
  id: string;
  collection_id: string;
  /** UUID of the parent virtual_folder or virtual_group item. Null for root items. */
  parent_id: string | null;
  name: string;
  folder_path: string;
  strategy_type: string;
  /** Detected file category for `"file"` strategy items (e.g. `"image"`, `"pdf"`). Empty for others. */
  category: string;
  description: string;
  notes: string;
  thumbnail_path: string | null;
  sort_order: number;
  /** True if the user has marked this item as a favourite. */
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * An item marked as favourite, extended with Steam image metadata.
 * Returned by `item_get_all_favorites` for the home dashboard favorites grid.
 */
export interface FavoriteItem extends Item {
  /** Steam CDN header image URL, or null for non-Steam items. */
  header_image: string | null;
  /** Steam community icon URL (~184×184 square JPG). Fast-loading; works for all games. */
  icon_url: string | null;
}

/** Input for creating a new item. */
export interface NewItem {
  collection_id: string;
  name: string;
  folder_path: string;
  strategy_type: string;
  description: string;
}
