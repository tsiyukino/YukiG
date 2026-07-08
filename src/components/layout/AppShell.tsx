/**
 * Top-level application shell.
 *
 * Renders the titlebar across the full width, then the sidebar and main
 * content area side by side below it. The titlebar replaces the native
 * Windows frame (decorations: false).
 */
import { ReactNode } from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";
import { ContextMenuProvider } from "@/components/common/ContextMenuProvider";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import styles from "./AppShell.module.css";

interface AppShellProps {
  /** The current page content to render in the main area. */
  children: ReactNode;
}

/**
 * Frameless application shell: titlebar on top, sidebar + content below.
 */
export default function AppShell({ children }: AppShellProps) {
  useKeyboardShortcuts();

  return (
    <ContextMenuProvider>
      <div className={styles.shell}>
        <Header />
        <div className={styles.body}>
          <Sidebar />
          <main className={styles.content}>{children}</main>
        </div>
      </div>
    </ContextMenuProvider>
  );
}
