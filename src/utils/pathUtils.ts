/**
 * Path manipulation utilities for Windows paths.
 */
import { convertFileSrc } from "@tauri-apps/api/core";

/**
 * Returns an `<img src>`-safe URL for a Steam image value.
 *
 * Steam image fields (`header_image`, `library_image`, etc.) contain either:
 * - A local Windows path from `librarycache/` — must be converted via `convertFileSrc`
 *   so the Tauri WebView can load it through the asset protocol.
 * - A CDN `https://` URL — used as-is when the local file is absent.
 *
 * @param value - Local path or CDN URL from a Steam image metadata field
 * @returns A URL safe to use as an `<img src>` attribute
 */
export function steamImageSrc(value: string): string {
  if (!value) return "";
  return value.startsWith("http") ? value : convertFileSrc(value);
}

/**
 * Returns just the file/folder name from a full path.
 *
 * @param path - Full path (Windows or POSIX)
 * @returns The last path segment
 */
export function basename(path: string): string {
  return path.replace(/[/\\]+$/, "").split(/[/\\]/).pop() ?? path;
}

/**
 * Returns the file extension (with dot) or empty string if none.
 *
 * @param path - Full path or filename
 * @returns Extension string like ".exe", ".pdf", or ""
 */
export function extname(path: string): string {
  const name = basename(path);
  const dotIndex = name.lastIndexOf(".");
  return dotIndex > 0 ? name.slice(dotIndex) : "";
}
