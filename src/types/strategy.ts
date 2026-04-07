/**
 * TypeScript types for the folder strategy system.
 * Mirror the Rust strategy types.
 */

/** A file or folder entry to display in the item view. */
export interface DisplayItem {
  name: string;
  path: string;
  is_dir: boolean;
  size_bytes: number | null;
  modified_at: string | null;
}

/** The primary action to perform when launching an item. */
export interface LaunchAction {
  action_type: "run_exe" | "open_with_default";
  target_path: string;
}

/** A metadata field the strategy expects the user to configure. */
export interface MetadataField {
  key: string;
  label: string;
  required: boolean;
  field_type: "file_path" | "folder_path" | "text";
}

/** Structured metadata returned by a strategy scan. */
export interface ScanResult {
  metadata: Record<string, string>;
  summary: string;
}

/**
 * All supported strategy type identifiers.
 *
 * `"file"` stores a single file path in the `folder_path` column.
 * `"folder"` is a disk-backed folder whose children are DB items.
 */
export type StrategyType =
  | "game"
  | "document"
  | "code"
  | "file"
  | "folder"
  | "virtual_folder"
  | "virtual_group";

/**
 * File categories detected by the `file` and `folder` strategies.
 *
 * The Rust backend encodes the category in the DisplayItem name as
 * `<stem>\x00<category>`. Use `parseFilesDisplayItem` to decode.
 */
export type FileCategory =
  | "image"
  | "pdf"
  | "document"
  | "spreadsheet"
  | "presentation"
  | "archive"
  | "text"
  | "markdown"
  | "audio"
  | "video"
  | "ebook"
  | "font"
  | "data"
  | "unknown"
  | "dir";

/** Parsed display item returned by `parseFilesDisplayItem`. */
export interface ParsedFilesItem {
  /** Filename without extension (stem). The full path is in `DisplayItem.path`. */
  name: string;
  /** Detected file category. */
  category: FileCategory;
}

/**
 * Splits the encoded name from the `file` / `folder` strategies into a stem and category.
 *
 * The Rust backend encodes `stem\x00category` into `DisplayItem.name` using
 * a null-byte delimiter that never appears in a valid Windows filename.
 *
 * @param encodedName - The raw `name` field from a `DisplayItem`
 * @returns Object with `name` (stem) and `category`
 */
export function parseFilesDisplayItem(encodedName: string): ParsedFilesItem {
  const idx = encodedName.indexOf("\x00");
  if (idx === -1) {
    return { name: encodedName, category: "unknown" };
  }
  return {
    name: encodedName.slice(0, idx),
    category: encodedName.slice(idx + 1) as FileCategory,
  };
}
