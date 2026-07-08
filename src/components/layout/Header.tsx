/**
 * Custom application titlebar: drag region, app name, and window controls.
 * Replaces the native Windows frame (decorations: false).
 * Global search lives on the Search page (`/` shortcut), not here.
 */
import WindowControls from "./WindowControls";
import styles from "./Header.module.css";

/**
 * Slim frameless titlebar with drag region and window controls.
 */
export default function Header() {
  return (
    <header className={styles.titlebar}>
      <div className={styles.drag} data-tauri-drag-region />

      <div className={styles.left} data-tauri-drag-region>
        <span className={styles.appName}>YukiG</span>
      </div>

      <WindowControls />
    </header>
  );
}
