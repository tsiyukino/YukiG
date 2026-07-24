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

/** A node in a folder tree (the Mods preview). */
export interface FolderTreeNode {
  name: string;
  path: string;
  is_dir: boolean;
  /** File size in bytes; 0 for directories. */
  size: number;
  children: FolderTreeNode[];
  /** True when children were cut off by the node budget or depth limit. */
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
 * Reads a folder tree up to `maxDepth` levels, capped in size.
 * Backs the Mods file-tree preview on the game detail page.
 * @param path - Absolute folder path
 * @param maxDepth - Levels of children to descend
 * @throws {string} If the path is missing, not a directory, or unreadable
 */
export async function folderTree(path: string, maxDepth: number): Promise<FolderTreeNode> {
  return invoke("folder_tree", { path, maxDepth });
}
