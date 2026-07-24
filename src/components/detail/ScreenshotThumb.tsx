/**
 * A single screenshot thumbnail.
 *
 * Requests a cached, downscaled thumbnail from the backend (see
 * `screenshot_thumb`) and renders that few-KB file — never the full-resolution
 * source. This keeps the grid responsive: no megapixel decode in the webview,
 * and because the thumbnail is a small real file it stays cached in the DOM
 * without the reload-on-scroll churn that `content-visibility` caused.
 * Clicking opens the original with the system viewer.
 */
import { useEffect, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { screenshotThumb } from "@/services/tauriCommands";
import styles from "./ScreenshotThumb.module.css";

interface ScreenshotThumbProps {
  /** Absolute path of the source image. */
  path: string;
  filename: string;
  /** Opens the full image (system viewer). */
  onOpen: () => void;
}

/**
 * Renders one screenshot tile backed by a cached thumbnail.
 */
export default function ScreenshotThumb({ path, filename, onOpen }: ScreenshotThumbProps) {
  const [thumbSrc, setThumbSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setThumbSrc(null);
    setFailed(false);
    screenshotThumb(path)
      .then((cached) => { if (!cancelled) setThumbSrc(convertFileSrc(cached)); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [path]);

  return (
    <button className={styles.tile} onClick={onOpen} title={filename}>
      {thumbSrc && <img className={styles.img} src={thumbSrc} alt={filename} />}
      {!thumbSrc && !failed && <span className={styles.placeholder} />}
      {failed && <span className={styles.failed} />}
    </button>
  );
}
