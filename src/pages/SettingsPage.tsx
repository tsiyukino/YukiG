/**
 * Settings page — horizontal tab bar shell.
 *
 * Each tab's content lives in its own file under src/pages/settings/;
 * shared styles come from src/pages/settings/settings.module.css.
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
import PageTitle from "@/components/common/PageTitle";
import s from "./settings/settings.module.css";

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
    <div className={s.page}>
      <PageTitle title="Settings" subtitle="Configure YukiG preferences" />

      <div className={s.tabs}>
        {TABS.map((t) => (
          <button
            key={t.id}
            className={tab === t.id ? `${s.tab} ${s.tabActive}` : s.tab}
            onClick={() => setTab(t.id)}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      <div className={s.body}>
        {tab === "behaviour"  && <BehaviourTab  />}
        {tab === "appearance" && <AppearanceTab />}
        {tab === "library"    && <LibraryTab    />}
        {tab === "steam"      && <SteamTab      />}
        {tab === "data"       && <DataTab       />}
        {tab === "debug"      && <DebugTab      />}
        {tab === "about"      && <AboutTab      />}
      </div>
    </div>
  );
}
