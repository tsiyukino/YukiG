/**
 * TypeScript types for the tag and tag-group domains.
 * Mirror the Rust Tag and TagGroup structs.
 */

/**
 * Kind of tag, which drives how it is displayed and where it appears.
 *
 * - `category`         — genre-like classification (Simulation, ARPG, Strategy).
 * - `functional`       — capability/feature tags (Co-op, Multiplayer, Steam Cloud).
 * - `element`          — thematic tags (Tragedy, Comedy, Philosophy, Art).
 * - `mood`             — Play-page mood filters.
 * - `steam_collection` — a Steam Collection (the user's in-Steam grouping); drives
 *                        the Steam page sidebar. Written by Steam sync.
 * - `regular`          — legacy/uncategorised tags (default before types existed).
 */
export type TagType =
  | "category"
  | "functional"
  | "element"
  | "mood"
  | "steam_collection"
  | "regular";

/** A user-created label that can be applied to any item. */
export interface Tag {
  id: string;
  name: string;
  color: string;
  /** The group this tag belongs to, or null if ungrouped. */
  group_id: string | null;
  /** What kind of tag this is; drives display and placement. */
  tag_type: TagType;
}

/** A named group of tags with a user-defined prefix string. */
export interface TagGroup {
  id: string;
  name: string;
  /** Free-form prefix string set by the user, e.g. "chem:" or "linux:". */
  prefix: string;
  sort_order: number;
  created_at: string;
}

/** Input for creating a new tag. */
export interface NewTag {
  name: string;
  color: string;
}
