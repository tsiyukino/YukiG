/**
 * Tauri command wrappers — read-only folder browsing (detail views).
 */
import { invoke } from "@tauri-apps/api/core";

/** An image file inside a screenshots folder. */
export interface FolderImage {
  path: string;
  filename: string;
  size: number;
  /** Unix timestamp of last modification, 0 if unavailable. */
  timestamp: number;
}

/** One entry in a directory listing (the Mods tree, loaded on demand). */
export interface FolderTreeNode {
  name: string;
  path: string;
  is_dir: boolean;
  /** File size in bytes; 0 for directories. */
  size: number;
}

/** One directory's direct children plus whether the listing was capped. */
export interface FolderListing {
  entries: FolderTreeNode[];
  /** True when the directory had more entries than the per-directory cap. */
  truncated: boolean;
}

/**
 * Lists the image files directly inside a folder, newest first.
 * Backs the Screenshots preview grid for any user-set screenshots folder.
 * @param path - Absolute folder path
 * @throws {string} If the path is missing, not a directory, or unreadable
 */
export async function folderListImages(path: string): Promise<FolderImage[]> {
  return invoke("folder_list_images", { path });
}

/**
 * Lists one directory's direct children (non-recursive).
 * Backs the Mods file tree: call it for the root, then for each directory the
 * user expands, so a deep mod folder is never walked several levels up front.
 * @param path - Absolute folder path
 * @throws {string} If the path is missing, not a directory, or unreadable
 */
export async function folderChildren(path: string): Promise<FolderListing> {
  return invoke("folder_children", { path });
}
