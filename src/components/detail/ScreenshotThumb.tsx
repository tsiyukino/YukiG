/**
 * A single screenshot thumbnail that downscales its source through a canvas.
 *
 * A raw `<img>` pointed at a full-resolution screenshot forces the webview to
 * decode ~2 megapixels per tile, which stalls when many mount together. This
 * decodes each source once off-screen, paints it into a small canvas, and keeps
 * only that few-KB bitmap — so scrolling and repaints never touch the original
 * again. `content-visibility` skips off-screen tiles entirely.
 */
import { useEffect, useRef, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import styles from "./ScreenshotThumb.module.css";

/** Longest edge of the generated thumbnail, in device-independent px. */
const THUMB_EDGE = 320;

interface ScreenshotThumbProps {
  /** Absolute path of the source image. */
  path: string;
  filename: string;
  /** Opens the full image (system viewer). */
  onOpen: () => void;
}

/**
 * Renders one downscaled screenshot tile.
 */
export default function ScreenshotThumb({ path, filename, onOpen }: ScreenshotThumbProps) {
  const [thumb, setThumb] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    const img = new window.Image();
    img.onload = () => {
      if (cancelled) return;
      const scale = Math.min(1, THUMB_EDGE / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = canvasRef.current ?? document.createElement("canvas");
      canvasRef.current = canvas;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) { setFailed(true); return; }
      ctx.drawImage(img, 0, 0, w, h);
      try {
        setThumb(canvas.toDataURL("image/jpeg", 0.8));
      } catch {
        setFailed(true);
      }
    };
    img.onerror = () => { if (!cancelled) setFailed(true); };
    img.src = convertFileSrc(path);
    return () => { cancelled = true; img.onload = null; img.onerror = null; };
  }, [path]);

  return (
    <button className={styles.tile} onClick={onOpen} title={filename}>
      {thumb && <img className={styles.img} src={thumb} alt={filename} />}
      {!thumb && !failed && <span className={styles.placeholder} />}
      {failed && <span className={styles.failed} />}
    </button>
  );
}
