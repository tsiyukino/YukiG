/**
 * TypeScript types for the collection domain.
 * Mirror the Rust `Collection`, `NewCollection`, and `UpdateCollection` structs.
 */

/** A user-created category that groups related items. */
export interface Collection {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  default_strategy: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/** Input for creating a new collection. */
export interface NewCollection {
  name: string;
  icon: string;
  color: string;
  description: string;
  default_strategy: string;
}

/** Input for updating an existing collection. All fields optional. */
export interface UpdateCollection {
  name?: string;
  icon?: string;
  color?: string;
  description?: string;
  default_strategy?: string;
  sort_order?: number;
}
