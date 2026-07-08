/**
 * Resolves the display image for an item card.
 * Preference order: manually-set thumbnail, then extracted exe icon,
 * then nothing (callers render a folder-icon fallback).
 */
import { convertFileSrc } from "@tauri-apps/api/core";
import { Item } from "@/types/item";
import { useExeIcon } from "@/hooks/useExeIcon";

/** Resolved image sources for an item. */
export interface ItemIcon {
  /** The manually-set thumbnail as a webview-loadable URL, if any. */
  thumbnailSrc: string | null;
  /** Best available image: thumbnail, else exe icon, else null. */
  iconSrc: string | null;
}

/**
 * Returns the best available image sources for the given item.
 */
export function useItemIcon(item: Item): ItemIcon {
  const exeIconSrc = useExeIcon(item.id, item.strategy_type);
  const thumbnailSrc = item.thumbnail_path ? convertFileSrc(item.thumbnail_path) : null;
  return { thumbnailSrc, iconSrc: thumbnailSrc ?? exeIconSrc };
}
