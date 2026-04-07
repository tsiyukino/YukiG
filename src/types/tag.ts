/**
 * TypeScript types for the tag and tag-group domains.
 * Mirror the Rust Tag and TagGroup structs.
 */

/** A user-created label that can be applied to any item. */
export interface Tag {
  id: string;
  name: string;
  color: string;
  /** The group this tag belongs to, or null if ungrouped. */
  group_id: string | null;
  /** `"regular"` for normal tags; `"mood"` for Play-page mood filters. */
  tag_type: "regular" | "mood";
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
