/**
 * Collapsible collections sidebar for the Steam library tab.
 * Styles come from the steam feature stylesheet (sp-*).
 */
import { Gamepad2, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { CollectionGroup } from "@/utils/steamFormatters";

interface LibrarySidebarProps {
  groups: CollectionGroup[];
  selectedGroup: string | null;
  onSelect: (name: string) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  totalInstalled: number;
  totalGames: number;
}

/**
 * Renders the collections nav with per-group logo thumbs and a stats footer.
 */
export default function LibrarySidebar({
  groups, selectedGroup, onSelect, collapsed, onToggleCollapsed, totalInstalled, totalGames,
}: LibrarySidebarProps) {
  return (
    <aside className={`sp-sidebar ${collapsed ? "sp-sidebar--collapsed" : ""}`}>
      <div className="sp-sidebar-header">
        {!collapsed && (
          <>
            <span className="sp-sidebar-label">Collections</span>
            <span className="sp-sidebar-count">{groups.length}</span>
          </>
        )}
        <button
          className="sp-sidebar-toggle"
          onClick={onToggleCollapsed}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
        </button>
      </div>
      <nav className="sp-sidebar-nav">
        {groups.map((g) => {
          const installedCount = g.games.filter((x) => x.is_installed).length;
          const firstLogoImg = g.games.find((x) => x.icon_url)?.icon_url ?? null;
          const isActive = selectedGroup === g.name;
          return (
            <button
              key={g.name}
              className={`sp-sidebar-item ${isActive ? "sp-sidebar-item--active" : ""}`}
              onClick={() => onSelect(g.name)}
              title={collapsed ? g.name : undefined}
            >
              {/* Collapsed: small square with logo; expanded: logo on dark background */}
              {collapsed ? (
                <div className="sp-sidebar-mosaic sp-sidebar-mosaic--icon">
                  {firstLogoImg ? (
                    <img
                      src={firstLogoImg}
                      alt=""
                      className="sp-sidebar-mosaic-img-logo"
                      loading="lazy"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  ) : (
                    <Gamepad2 size={12} />
                  )}
                </div>
              ) : (
                <div className="sp-sidebar-item-inner">
                  <div className="sp-sidebar-logo-thumb">
                    {firstLogoImg ? (
                      <img
                        src={firstLogoImg}
                        alt=""
                        className="sp-sidebar-logo-thumb-img"
                        loading="lazy"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    ) : (
                      <Gamepad2 size={12} />
                    )}
                  </div>
                  <div className="sp-sidebar-item-info">
                    <span className="sp-sidebar-item-name">{g.name}</span>
                    <span className="sp-sidebar-item-meta">{installedCount}/{g.games.length}</span>
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </nav>

      {!collapsed && (
        <div className="sp-sidebar-footer">
          <div className="sp-sidebar-stat">
            <span className="sp-sidebar-stat-val">{totalInstalled}</span>
            <span className="sp-sidebar-stat-label">installed</span>
          </div>
          <div className="sp-sidebar-stat-divider" />
          <div className="sp-sidebar-stat">
            <span className="sp-sidebar-stat-val">{totalGames}</span>
            <span className="sp-sidebar-stat-label">total</span>
          </div>
        </div>
      )}
    </aside>
  );
}
