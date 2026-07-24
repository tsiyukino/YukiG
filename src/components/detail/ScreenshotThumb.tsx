/**
 * A single screenshot thumbnail.
 *
 * Renders the source image directly (lazy + async decode). A prior attempt to
 * canvas-downscale each source failed in the WebView — `toDataURL` on an
 * asset-protocol image trips cross-origin tainting and leaves the tile stuck
 * on its placeholder — so the tile shows the real image and relies on
 * `content-visibility` (in the stylesheet) to skip off-screen tiles instead.
 */
import { useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import styles from "./ScreenshotThumb.module.css";

interface ScreenshotThumbProps {
  /** Absolute path of the source image. */
  path: string;
  filename: string;
  /** Opens the full image (system viewer). */
  onOpen: () => void;
}

/**
 * Renders one screenshot tile.
 */
export default function ScreenshotThumb({ path, filename, onOpen }: ScreenshotThumbProps) {
  const [loaded, setLoaded] = useState(false);

  return (
    <button className={styles.tile} onClick={onOpen} title={filename}>
      {!loaded && <span className={styles.placeholder} />}
      <img
        className={loaded ? styles.img : styles.imgHidden}
        src={convertFileSrc(path)}
        alt={filename}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
      />
    </button>
  );
}
