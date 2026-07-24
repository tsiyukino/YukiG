/**
 * Collapsible screenshots preview for a user-set folder: loads the folder's
 * image list lazily on first expand and renders each via ScreenshotThumb
 * (lazy image + content-visibility so off-screen tiles stay cheap). Clicking a
 * tile opens the original with the system viewer. Shared by local and Steam
 * games.
 */
import { useState } from "react";
import { ChevronDown, ChevronRight, Image } from "lucide-react";
import { folderListImages, FolderImage, shellOpenPath } from "@/services/tauriCommands";
import ScreenshotThumb from "./ScreenshotThumb";
import styles from "./ScreenshotsCard.module.css";

interface ScreenshotsCardProps {
  /** Absolute path of the screenshots folder. */
  folder: string;
}

/**
 * Renders the collapsible screenshots grid.
 */
export default function ScreenshotsCard({ folder }: ScreenshotsCardProps) {
  const [open, setOpen] = useState(false);
  const [images, setImages] = useState<FolderImage[] | null>(null);
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
            <div className={styles.grid}>
              {images.map((img) => (
                <ScreenshotThumb
                  key={img.path}
                  path={img.path}
                  filename={img.filename}
                  onOpen={() => shellOpenPath(img.path).catch(() => {})}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
