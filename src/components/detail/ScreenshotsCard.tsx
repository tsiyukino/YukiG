/**
 * Collapsible screenshots preview for a user-set folder: loads the folder's
 * images lazily on first expand, shows a thumbnail grid, and opens a clicked
 * image with the system viewer. Shared by local and Steam games — both point
 * it at whatever folder the user configured.
 */
import { useState } from "react";
import { ChevronDown, ChevronRight, Image } from "lucide-react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { folderListImages, FolderImage, shellOpenPath } from "@/services/tauriCommands";
import styles from "./ScreenshotsCard.module.css";

/** Thumbnails rendered when the card first opens. */
const INITIAL_VISIBLE = 24;
/** Thumbnails added per "Show more" click. */
const SHOW_MORE_STEP = 48;

interface ScreenshotsCardProps {
  /** Absolute path of the screenshots folder. */
  folder: string;
}

/**
 * Renders the collapsible screenshots grid. Thumbnails render incrementally
 * (initial batch + "Show more") — mounting hundreds of full-size images at
 * once stalls the webview on decode.
 */
export default function ScreenshotsCard({ folder }: ScreenshotsCardProps) {
  const [open, setOpen] = useState(false);
  const [images, setImages] = useState<FolderImage[] | null>(null);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && images === null) {
      folderListImages(folder)
        .then(setImages)
        .catch((e) => setError(String(e)));
    }
  }

  return (
    <div className={styles.card}>
      <button className={styles.header} onClick={toggle}>
        {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        <Image size={13} />
        <span className={styles.title}>Screenshots</span>
        {images !== null && <span className={styles.count}>{images.length}</span>}
      </button>

      {open && (
        <div className={styles.body}>
          {error && <p className={styles.error}>{error}</p>}
          {images !== null && images.length === 0 && !error && (
            <p className={styles.empty}>No images in this folder yet.</p>
          )}
          {images !== null && images.length > 0 && (
            <>
              <div className={styles.grid}>
                {images.slice(0, visibleCount).map((img) => (
                  <button
                    key={img.path}
                    className={styles.thumbBtn}
                    onClick={() => shellOpenPath(img.path).catch(() => {})}
                    title={img.filename}
                  >
                    <img
                      className={styles.thumb}
                      src={convertFileSrc(img.path)}
                      alt={img.filename}
                      loading="lazy"
                      decoding="async"
                    />
                  </button>
                ))}
              </div>
              {images.length > visibleCount && (
                <button
                  className={styles.showMore}
                  onClick={() => setVisibleCount((n) => n + SHOW_MORE_STEP)}
                >
                  Show {Math.min(SHOW_MORE_STEP, images.length - visibleCount)} more
                  ({images.length - visibleCount} hidden)
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
