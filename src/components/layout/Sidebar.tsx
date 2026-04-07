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
      { to: "/status",            icon: <BarChart2  size={15} />, label: "Status" },
      { to: "/play",              icon: <Dices      size={15} />, label: "Play"   },
    ],
  },
  {
    label: "Library",
    items: [
      { to: "/games", icon: <Gamepad2   size={15} />, label: "Games" },
      { to: "/steam", icon: <SteamIcon  size={15} />, label: "Steam" },
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

/**
 * Left sidebar with primary navigation links grouped into labelled sections.
 * Starts collapsed (icon-only); click the toggle to expand.
 */
export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(() => !readAppPrefs().sidebarExpandedOnStart);

  return (
    <nav className={`sidebar ${collapsed ? "sidebar--collapsed" : ""}`}>
      <div className="sidebar-toggle-row">
        <button
          className="sidebar-toggle-btn"
          onClick={() => setCollapsed((v) => !v)}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
        </button>
      </div>

      <div className="sidebar-groups">
        {NAV_GROUPS.map((group, i) => (
          <div key={group.label}>
            {i > 0 && <div className="sidebar-divider" />}
            <div className="sidebar-group">
              {!collapsed && <span className="sidebar-group-label">{group.label}</span>}
              <ul className="sidebar-nav">
                {group.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      className={({ isActive }) => `sidebar-link ${isActive ? "sidebar-link--active" : ""}`}
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

      <div className="sidebar-spacer" />

      <ul className="sidebar-nav">
        <li>
          <NavLink
            to="/settings"
            className={({ isActive }) => `sidebar-link ${isActive ? "sidebar-link--active" : ""}`}
            title={collapsed ? "Settings" : undefined}
          >
            <Settings size={15} />
            {!collapsed && <span>Settings</span>}
          </NavLink>
        </li>
      </ul>

      <style>{`
        .sidebar {
          width: 192px;
          flex-shrink: 0;
          background: var(--color-bg-secondary);
          border-right: 1px solid var(--color-border);
          display: flex;
          flex-direction: column;
          padding: 12px 8px;
          gap: var(--space-1);
          transition: width 150ms ease;
          overflow: hidden;
        }
        .sidebar--collapsed {
          width: 48px;
          padding: 12px 6px;
        }

        /* ── toggle ── */
        .sidebar-toggle-row {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 8px;
        }
        .sidebar--collapsed .sidebar-toggle-row {
          justify-content: center;
        }
        .sidebar-toggle-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 26px;
          height: 26px;
          border: none;
          background: transparent;
          border-radius: var(--radius-sm);
          color: var(--color-text-muted);
          cursor: pointer;
          transition: background var(--transition-fast), color var(--transition-fast);
        }
        .sidebar-toggle-btn:hover {
          background: var(--color-bg-tertiary);
          color: var(--color-text-primary);
        }

        /* ── groups ── */
        .sidebar-spacer { flex: 1; }
        .sidebar-groups {
          display: flex;
          flex-direction: column;
          gap: 0;
        }
        .sidebar-divider {
          height: 1px;
          background: var(--color-border);
          margin: 8px 4px;
        }
        .sidebar-group {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .sidebar-group-label {
          font-size: 10px;
          font-weight: 600;
          letter-spacing: .08em;
          text-transform: uppercase;
          color: var(--color-text-muted);
          padding: 0 10px;
          margin-bottom: 3px;
          white-space: nowrap;
        }

        /* ── nav items ── */
        .sidebar-nav {
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .sidebar-link {
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 7px 10px;
          border-radius: var(--radius-sm);
          color: var(--color-text-secondary);
          text-decoration: none;
          font-size: 13px;
          font-weight: 500;
          transition: background var(--transition-fast), color var(--transition-fast);
          white-space: nowrap;
        }
        .sidebar--collapsed .sidebar-link {
          width: 36px;
          height: 36px;
          padding: 0;
          justify-content: center;
          margin: 0 auto;
          border-radius: 8px;
        }
        .sidebar-link:hover {
          background: var(--color-bg-tertiary);
          color: var(--color-text-primary);
        }
        .sidebar-link--active {
          background: var(--color-accent-light);
          color: var(--color-accent);
        }
        .sidebar-link--active svg {
          color: var(--color-accent);
        }
      `}</style>
    </nav>
  );
}
