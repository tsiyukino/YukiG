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
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";

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
    <div className="app-shell">
      <Header />
      <div className="app-body">
        <Sidebar />
        <main className="app-content">{children}</main>
      </div>

      <style>{`
        .app-shell {
          display: flex;
          flex-direction: column;
          height: 100vh;
          width: 100vw;
          overflow: hidden;
          background: var(--color-bg);
        }
        .app-body {
          flex: 1;
          display: flex;
          min-height: 0;
          overflow: hidden;
        }
        .app-content {
          flex: 1;
          min-height: 0;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          min-width: 0;
        }
        .app-content > .page-padded {
          flex: 1;
          overflow-y: auto;
          padding: var(--space-6);
          padding-top: var(--space-4);
        }
      `}</style>
    </div>
  );
}
