/**
 * Settings page — horizontal tab bar shell.
 *
 * Owns: header, tab bar, shared CSS (sp-* classes used by all tab panels).
 * Each tab's content lives in its own file under src/pages/settings/.
 *
 * Tabs: Behaviour · Appearance · Library · Steam · Data · Debug · About
 */
import { useState } from "react";
import {
  FolderOpen,
  Info,
  Palette,
  SlidersHorizontal,
  Bug,
  Library,
} from "lucide-react";
import SteamIcon from "@/components/common/SteamIcon";
import BehaviourTab  from "./settings/BehaviourTab";
import AppearanceTab from "./settings/AppearanceTab";
import LibraryTab    from "./settings/LibraryTab";
import SteamTab      from "./settings/SteamTab";
import DataTab       from "./settings/DataTab";
import DebugTab      from "./settings/DebugTab";
import AboutTab      from "./settings/AboutTab";

// ─── Tab definitions ──────────────────────────────────────────────────────────

type TabId = "behaviour" | "appearance" | "library" | "steam" | "data" | "debug" | "about";

interface TabDef {
  id: TabId;
  label: string;
  icon: React.ReactNode;
}

const TABS: TabDef[] = [
  { id: "behaviour",  label: "Behaviour",  icon: <SlidersHorizontal size={13} /> },
  { id: "appearance", label: "Appearance", icon: <Palette           size={13} /> },
  { id: "library",    label: "Library",    icon: <Library           size={13} /> },
  { id: "steam",      label: "Steam",      icon: <SteamIcon         size={13} /> },
  { id: "data",       label: "Data",       icon: <FolderOpen        size={13} /> },
  { id: "debug",      label: "Debug",      icon: <Bug               size={13} /> },
  { id: "about",      label: "About",      icon: <Info              size={13} /> },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

/** Full-page settings view with a tab bar. Tab content is in src/pages/settings/. */
export default function SettingsPage() {
  const [tab, setTab] = useState<TabId>("behaviour");

  return (
    <div className="sp">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="sp-header">
        <h1 className="sp-title">Settings</h1>
        <p className="sp-subtitle">Configure YukiG preferences</p>
      </div>

      {/* ── Tab bar ─────────────────────────────────────────────────────── */}
      <div className="sp-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`sp-tab ${tab === t.id ? "sp-tab--active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab content ─────────────────────────────────────────────────── */}
      <div className="sp-body">
        {tab === "behaviour"  && <BehaviourTab  />}
        {tab === "appearance" && <AppearanceTab />}
        {tab === "library"    && <LibraryTab    />}
        {tab === "steam"      && <SteamTab      />}
        {tab === "data"       && <DataTab       />}
        {tab === "debug"      && <DebugTab      />}
        {tab === "about"      && <AboutTab      />}
      </div>

      <style>{`
        .sp {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: var(--space-5);
        }

        /* ── Header ─────────────────────────────────────────────────────── */
        .sp-title { font-size: 22px; font-weight: 700; letter-spacing: -0.025em; }
        .sp-subtitle { font-size: 12.5px; color: var(--color-text-muted); margin-top: 2px; }

        /* ── Tab bar ────────────────────────────────────────────────────── */
        .sp-tabs {
          display: flex;
          align-items: center;
          gap: 2px;
          border-bottom: 1px solid var(--color-border);
        }
        .sp-tab {
          display: inline-flex;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-2) var(--space-3);
          font-size: 13px;
          font-weight: 500;
          color: var(--color-text-muted);
          border-radius: var(--radius-sm) var(--radius-sm) 0 0;
          border: 1px solid transparent;
          border-bottom: none;
          margin-bottom: -1px;
          transition: color var(--transition-fast), background var(--transition-fast);
        }
        .sp-tab:hover { color: var(--color-text-primary); background: var(--color-bg-secondary); }
        .sp-tab--active {
          color: var(--color-text-primary);
          background: var(--color-bg);
          border-color: var(--color-border);
          border-bottom-color: var(--color-bg);
        }

        /* ── Body ───────────────────────────────────────────────────────── */
        .sp-body { display: flex; flex-direction: column; gap: var(--space-6); }

        /* ── Section ────────────────────────────────────────────────────── */
        .sp-section {
          display: flex; flex-direction: column; gap: 0;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          overflow: hidden;
        }
        .sp-section-heading {
          display: flex; align-items: center; gap: var(--space-2);
          padding: var(--space-3) var(--space-4);
          background: var(--color-bg-secondary);
          border-bottom: 1px solid var(--color-border);
          font-size: 12px; font-weight: 600;
          color: var(--color-text-secondary);
          text-transform: uppercase; letter-spacing: 0.05em;
        }

        /* ── Row ────────────────────────────────────────────────────────── */
        .sp-row {
          display: flex; align-items: flex-start; gap: var(--space-4);
          padding: var(--space-4);
          border-bottom: 1px solid var(--color-border-subtle);
          flex-wrap: wrap;
        }
        .sp-row:last-child { border-bottom: none; }
        .sp-row-info { flex: 1; min-width: 160px; }
        .sp-row-label { font-size: 13px; font-weight: 500; color: var(--color-text-primary); }
        .sp-row-desc { font-size: 12px; color: var(--color-text-muted); margin-top: 2px; line-height: 1.5; }
        .sp-row-control {
          display: flex; flex-direction: column; align-items: flex-end;
          gap: var(--space-1); flex-shrink: 0; max-width: 55%;
        }

        /* ── Accent swatches ────────────────────────────────────────────── */
        .sp-accent-swatches {
          display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap;
        }
        .sp-swatch {
          width: 22px; height: 22px; border-radius: 50%;
          border: 2px solid transparent; cursor: pointer; flex-shrink: 0;
          transition: transform var(--transition-fast), border-color var(--transition-fast);
        }
        .sp-swatch:hover { transform: scale(1.15); }
        .sp-swatch--active { border-color: var(--color-text-primary); transform: scale(1.15); }
        .sp-swatch--custom {
          display: flex; flex-direction: column; align-items: center; gap: 2px;
          width: auto; height: auto; border-radius: var(--radius-sm);
          background: none; border: 1px solid var(--color-border);
          padding: 2px 6px; cursor: pointer;
        }
        .sp-swatch--custom input[type="color"] {
          width: 20px; height: 16px; border: none; padding: 0;
          cursor: pointer; background: none;
        }

        /* ── Segmented control ──────────────────────────────────────────── */
        .sp-seg {
          display: inline-flex;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          overflow: hidden;
        }
        .sp-seg-btn {
          padding: 4px 10px; font-size: 12px; font-weight: 500;
          color: var(--color-text-muted);
          border-right: 1px solid var(--color-border);
          transition: color var(--transition-fast), background var(--transition-fast);
        }
        .sp-seg-btn:last-child { border-right: none; }
        .sp-seg-btn:hover:not(:disabled) { color: var(--color-text-primary); background: var(--color-bg-secondary); }
        .sp-seg-btn--active { color: var(--color-accent); background: var(--color-accent-light); }
        .sp-seg-btn:disabled { opacity: 0.4; cursor: not-allowed; }

        /* ── Data dir ───────────────────────────────────────────────────── */
        .sp-data-dir-block { display: flex; flex-direction: column; gap: var(--space-1); width: 100%; }
        .sp-data-dir {
          display: flex; align-items: center; gap: var(--space-2);
          background: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          padding: var(--space-2) var(--space-3);
        }
        .sp-data-dir-path {
          font-family: var(--font-mono); font-size: 11px;
          color: var(--color-text-secondary);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          flex: 1; min-width: 0;
        }

        /* ── Shared ─────────────────────────────────────────────────────── */
        .sp-btn {
          display: inline-flex; align-items: center; gap: var(--space-1);
          padding: var(--space-1) var(--space-2);
          font-size: 12px; color: var(--color-text-muted);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm); flex-shrink: 0;
          transition: color var(--transition-fast), background var(--transition-fast);
          white-space: nowrap;
        }
        .sp-btn:hover:not(:disabled) {
          color: var(--color-accent);
          background: var(--color-accent-light);
          border-color: var(--color-accent);
        }
        .sp-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .sp-spin { animation: sp-spin 1s linear infinite; }
        @keyframes sp-spin { to { transform: rotate(360deg); } }
        .sp-mono { font-family: var(--font-mono); font-size: 11px; color: var(--color-text-secondary); word-break: break-all; text-align: right; }
        .sp-value { font-size: 13px; color: var(--color-text-secondary); }
        .sp-error { font-size: 11px; color: var(--color-danger); }
        .sp-error--section { padding: var(--space-2) var(--space-4); display: block; }
        .sp-success { font-size: 11px; color: var(--color-success); line-height: 1.5; }
        .sp-debug-out {
          font-family: var(--font-mono); font-size: 11px;
          color: var(--color-text-secondary);
          background: var(--color-bg-tertiary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          padding: var(--space-3); white-space: pre-wrap;
          word-break: break-all; max-height: 300px; overflow-y: auto;
        }

        /* ── Toggle ─────────────────────────────────────────────────────── */
        .sp-toggle { position: relative; display: inline-flex; align-items: center; width: 36px; height: 20px; flex-shrink: 0; }
        .sp-toggle input { opacity: 0; width: 0; height: 0; position: absolute; }
        .sp-toggle-track {
          width: 36px; height: 20px; border-radius: 10px;
          background: var(--color-border);
          transition: background var(--transition-fast);
          cursor: pointer; position: relative;
        }
        .sp-toggle input:checked + .sp-toggle-track { background: var(--color-accent); }
        .sp-toggle input:disabled + .sp-toggle-track { opacity: 0.4; cursor: not-allowed; }
        .sp-toggle-track::after {
          content: ''; position: absolute; top: 2px; left: 2px;
          width: 16px; height: 16px; border-radius: 50%;
          background: var(--color-bg);
          transition: transform var(--transition-fast);
          box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        }
        .sp-toggle input:checked + .sp-toggle-track::after { transform: translateX(16px); }
      `}</style>
    </div>
  );
}
