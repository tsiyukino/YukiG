/**
 * Minimize / maximize / close buttons for the frameless titlebar.
 * Tracks the maximized state so the middle button swaps its icon.
 */
import { useState, useEffect } from "react";
import { Minus, Square, X } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import styles from "./WindowControls.module.css";

/**
 * Native-feeling window controls for the custom titlebar.
 */
export default function WindowControls() {
  const [isMaximized, setIsMaximized] = useState(false);
  const appWindow = getCurrentWindow();

  useEffect(() => {
    appWindow.isMaximized().then(setIsMaximized).catch(() => {});
    const unlisten = appWindow.onResized(() => {
      appWindow.isMaximized().then(setIsMaximized).catch(() => {});
    });
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  async function handleMaximize() {
    if (isMaximized) { await appWindow.unmaximize(); }
    else { await appWindow.maximize(); }
    setIsMaximized(!isMaximized);
  }

  return (
    <div className={styles.controls}>
      <button className={styles.btn} onClick={() => appWindow.minimize()} title="Minimize">
        <Minus size={13} strokeWidth={1.5} />
      </button>
      <button className={styles.btn} onClick={handleMaximize} title={isMaximized ? "Restore" : "Maximize"}>
        {isMaximized ? (
          <svg width="12" height="12" viewBox="0 0 11 11" fill="none">
            <rect x="2.5" y="0.5" width="8" height="8" rx="0.5" stroke="currentColor" strokeWidth="1.2" />
            <rect x="0.5" y="2.5" width="8" height="8" rx="0.5" stroke="currentColor" strokeWidth="1.2" fill="var(--color-bg)" />
          </svg>
        ) : (
          <Square size={11} strokeWidth={1.5} />
        )}
      </button>
      <button className={`${styles.btn} ${styles.close}`} onClick={() => appWindow.close()} title="Close">
        <X size={14} strokeWidth={1.5} />
      </button>
    </div>
  );
}
