/**
 * Application sidebar with primary navigation.
 * Collapsible — defaults to collapsed (icon-only) on startup.
 * Nav items are grouped into labelled sections separated by thin dividers.
 */
import { useState } from "react";
import { NavLink } from "react-router-dom";
import { readAppPrefs } from "@/hooks/useAppPrefs";
import { Home, Gamepad2, Search, Settings, Tag, PanelLeftOpen, PanelLeftClose, BarChart2, Dices } from "lucide-react";
import SteamIcon from "@/components/common/SteamIcon";
import styles from "./Sidebar.module.css";

interface NavItem {
  to: string;
  end?: boolean;
  icon: React.ReactNode;
  label: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { to: "/",       end: true, icon: <Home      size={15} />, label: "Home"   },
      { to: "/status",            icon: <BarChart2 size={15} />, label: "Status" },
      { to: "/play",              icon: <Dices     size={15} />, label: "Play"   },
    ],
  },
  {
    label: "Library",
    items: [
      { to: "/games", icon: <Gamepad2  size={15} />, label: "Games" },
      { to: "/steam", icon: <SteamIcon size={15} />, label: "Steam" },
    ],
  },
  {
    label: "Organize",
    items: [
      { to: "/search", icon: <Search size={15} />, label: "Search" },
      { to: "/tags",   icon: <Tag    size={15} />, label: "Tags"   },
    ],
  },
];

/** Builds the NavLink className for the default and active states. */
function linkClass({ isActive }: { isActive: boolean }): string {
  return isActive ? `${styles.link} ${styles.linkActive}` : styles.link;
}

/**
 * Left sidebar with primary navigation links grouped into labelled sections.
 * Starts collapsed (icon-only); click the toggle to expand.
 */
export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(() => !readAppPrefs().sidebarExpandedOnStart);

  return (
    <nav className={collapsed ? `${styles.sidebar} ${styles.collapsed}` : styles.sidebar}>
      <div className={styles.toggleRow}>
        <button
          className={styles.toggleBtn}
          onClick={() => setCollapsed((v) => !v)}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
        </button>
      </div>

      <div className={styles.groups}>
        {NAV_GROUPS.map((group, i) => (
          <div key={group.label}>
            {i > 0 && <div className={styles.divider} />}
            <div className={styles.group}>
              {!collapsed && <span className={styles.groupLabel}>{group.label}</span>}
              <ul className={styles.nav}>
                {group.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      className={linkClass}
                      title={collapsed ? item.label : undefined}
                    >
                      {item.icon}
                      {!collapsed && <span>{item.label}</span>}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>

      <div className={styles.spacer} />

      <ul className={styles.nav}>
        <li>
          <NavLink
            to="/settings"
            className={linkClass}
            title={collapsed ? "Settings" : undefined}
          >
            <Settings size={15} />
            {!collapsed && <span>Settings</span>}
          </NavLink>
        </li>
      </ul>
    </nav>
  );
}
