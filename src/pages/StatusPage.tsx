/**
 * Status page — library-wide statistics across all platforms.
 *
 * Three tabs:
 * - Overall  : Cross-platform hero metrics, platform cards, spotlight games
 * - Local    : Collections breakdown, per-item playtime from metadata, tags
 * - Steam    : Installed ratio, playtime histogram with drilldown, top chart, recent
 */
import { useState, useEffect } from "react";
import { RefreshCw } from "lucide-react";
import {
  collectionGetAll, itemGetAllLocal,
  itemGetAllFavorites, tagGetAll, tagGetItemCounts,
  strategyGetPlaytimeBulk,
} from "@/services/tauriCommands";
import { useSteamStore } from "@/store/steamStore";
import { Item } from "@/types/item";
import OverallTab from "@/components/status/OverallTab";
import LocalTab, { DbData } from "@/components/status/LocalTab";
import SteamTab from "@/components/status/SteamTab";

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = "overall" | "local" | "steam";

/** Local item extended with playtime data from strategy metadata. */
interface LocalItem extends Item {
  playtime_minutes: number;
  last_launched: number; // unix seconds, 0 = never
}

// ─── Main page ────────────────────────────────────────────────────────────────

/** Status page root. Loads all data and renders tab content via sub-components. */
export default function StatusPage() {
  const [tab, setTab] = useState<Tab>("overall");
  const [db, setDb] = useState<DbData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const steam = useSteamStore();

  useEffect(() => {
    loadDb();
  }, []);

  async function loadDb() {
    setLoading(true);
    setError(null);
    try {
      // Fire all independent queries in parallel
      const [collections, allItems, allTags, tagCounts, favorites] = await Promise.all([
        collectionGetAll(),
        itemGetAllLocal(),
        tagGetAll(),
        tagGetItemCounts(),
        itemGetAllFavorites(),
      ]);

      const userCollections = collections.filter((c) => c.default_strategy !== "steam_game");

      // One playtime fetch for all items at once
      const allIds = allItems.map((i) => i.id);
      const playtimeMap = allIds.length > 0 ? await strategyGetPlaytimeBulk(allIds) : {};

      const allLocalItems: LocalItem[] = allItems.map((item) => {
        const pt = playtimeMap[item.id] ?? {};
        return {
          ...item,
          playtime_minutes: parseInt(pt["total_playtime_minutes"] ?? "0", 10) || 0,
          last_launched: parseInt(pt["last_launched"] ?? "0", 10) || 0,
        };
      });

      // Group items by collection
      const itemsByCollection = new Map<string, LocalItem[]>();
      for (const item of allLocalItems) {
        const arr = itemsByCollection.get(item.collection_id) ?? [];
        arr.push(item);
        itemsByCollection.set(item.collection_id, arr);
      }

      const breakdown = userCollections.map((col) => ({
        collection: col,
        items: itemsByCollection.get(col.id) ?? [],
      }));

      const tagBreakdown = allTags
        .map((tag) => ({ tag, count: tagCounts[tag.id] ?? 0 }))
        .sort((a, b) => b.count - a.count);

      setDb({
        userCollections,
        collectionBreakdown: breakdown,
        tagBreakdown,
        allLocalItems,
        favoriteCount: favorites.length,
        loadedAt: new Date(),
      });
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  const TAB_LABELS: Record<Tab, string> = { overall: "Overview", local: "Local", steam: "Steam" };

  return (
    <div className="stp-root">
      {/* Header */}
      <div className="stp-header">
        <div className="stp-header-top">
          <h1 className="stp-title">Status</h1>
          <button
            className="stp-refresh-btn"
            onClick={loadDb}
            disabled={loading}
            title="Refresh"
          >
            <RefreshCw size={13} className={loading ? "stp-spin" : ""} />
          </button>
        </div>
        <div className="stp-seg">
          {(["overall", "local", "steam"] as Tab[]).map((t) => (
            <button
              key={t}
              className={`stp-seg-btn${tab === t ? " stp-seg-btn--active" : ""}`}
              onClick={() => setTab(t)}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="stp-body">
        {error && <div className="stp-error">{error}</div>}
        {!error && loading && <div className="stp-loading">Loading statistics…</div>}
        {!error && !loading && db && tab === "overall" && <OverallTab db={db} steam={steam} />}
        {!error && !loading && db && tab === "local" && <LocalTab db={db} />}
        {!error && !loading && tab === "steam" && <SteamTab steam={steam} />}
      </div>

      <style>{STYLES}</style>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const STYLES = `
/* ── Page shell ── */
.stp-root { width: 100%; display: flex; flex-direction: column; gap: 0; min-height: 0; }

/* ── Header ── */
.stp-header { position: sticky; top: calc(-1 * var(--space-4)); z-index: 10; background: var(--color-bg); display: flex; flex-direction: column; gap: var(--space-3); padding: var(--space-4) var(--space-6) var(--space-3); border-bottom: 1px solid var(--color-border-subtle); }
.stp-header-top { display: flex; align-items: center; justify-content: space-between; }
.stp-title { font-size: 22px; font-weight: 700; letter-spacing: -0.025em; color: var(--color-text-primary); }

/* ── Segment switcher ── */
.stp-seg { display: flex; background: var(--color-bg-secondary); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 3px; gap: 2px; }
.stp-seg-btn { padding: 5px 14px; font-size: 12.5px; font-weight: 500; color: var(--color-text-muted); border-radius: calc(var(--radius-md) - 2px); cursor: pointer; transition: background var(--transition-fast), color var(--transition-fast), box-shadow var(--transition-fast); background: none; border: none; white-space: nowrap; }
.stp-seg-btn:hover { color: var(--color-text-primary); }
.stp-seg-btn--active { background: var(--color-bg); color: var(--color-text-primary); font-weight: 600; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }

/* ── Refresh ── */
.stp-refresh-btn { display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; color: var(--color-text-muted); border: 1px solid var(--color-border); border-radius: var(--radius-sm); background: var(--color-bg); cursor: pointer; transition: background var(--transition-fast), color var(--transition-fast); flex-shrink: 0; }
.stp-refresh-btn:hover:not(:disabled) { background: var(--color-bg-secondary); color: var(--color-text-primary); }
.stp-refresh-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.stp-spin { animation: stp-spin 1s linear infinite; }
@keyframes stp-spin { to { transform: rotate(360deg); } }

/* ── Body ── */
.stp-body { flex: 1; overflow-y: auto; padding: var(--space-6); display: flex; flex-direction: column; gap: var(--space-6); min-width: 0; }
.stp-error { padding: var(--space-3) var(--space-4); background: var(--color-danger-light); color: var(--color-danger); border-radius: var(--radius-sm); font-size: 13px; }
.stp-loading { color: var(--color-text-muted); font-size: 13px; text-align: center; padding: var(--space-8) 0; }
.stp-tab-body { display: flex; flex-direction: column; gap: var(--space-5); width: 100%; min-width: 0; }

/* ── Grids ── */
.stp-grid-3-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-3); }
.stp-grid-4   { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-3); }
.stp-grid-2   { display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--space-3); }

/* ── Stat tile ── */
.stp-tile { background: var(--color-bg-secondary); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: var(--space-4); display: flex; flex-direction: column; gap: var(--space-1); position: relative; overflow: hidden; animation: stp-fadein 0.35s both; }
@keyframes stp-fadein { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
.stp-tile-bar { position: absolute; top: 0; left: 0; right: 0; height: 3px; }
.stp-tile-icon { width: 28px; height: 28px; border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; margin-bottom: var(--space-1); margin-top: var(--space-1); }
.stp-tile-body { display: flex; flex-direction: column; gap: 2px; }
.stp-tile-value { font-size: 24px; font-weight: 700; letter-spacing: -0.03em; line-height: 1; color: var(--color-text-primary); }
.stp-tile-label { font-size: 11.5px; color: var(--color-text-muted); font-weight: 500; }
.stp-tile-sub { font-size: 10.5px; color: var(--color-text-muted); margin-top: 1px; }

/* ── Cards ── */
.stp-card { border: 1px solid var(--color-border); border-radius: var(--radius-md); overflow: hidden; }
.stp-card--muted { background: var(--color-bg-secondary); }
.stp-card-header { display: flex; align-items: center; gap: var(--space-2); padding: var(--space-2) var(--space-4); background: var(--color-bg-secondary); border-bottom: 1px solid var(--color-border); font-size: 12px; font-weight: 600; color: var(--color-text-primary); min-height: 36px; }
.stp-card-meta { margin-left: auto; font-size: 11px; font-weight: 400; color: var(--color-text-muted); }
.stp-card-note { font-size: 11px; color: var(--color-text-muted); padding: var(--space-2) var(--space-4) var(--space-3); }

/* ── Badge ── */
.stp-badge-scan { margin-left: auto; font-size: 10px; font-weight: 500; color: var(--color-accent); background: var(--color-accent-light); padding: 1px 6px; border-radius: var(--radius-full); animation: stp-pulse 1.4s ease-in-out infinite; }
@keyframes stp-pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }

/* ── Platform cards ── */
.stp-platform-row { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4); }
.stp-pcard { border: 1px solid var(--color-border); border-radius: var(--radius-md); overflow: hidden; }
.stp-pcard-header { display: flex; align-items: center; gap: var(--space-2); padding: var(--space-2) var(--space-4); font-size: 13px; font-weight: 600; color: var(--color-text-primary); background: var(--color-bg-secondary); border-bottom: 1px solid var(--color-border); min-height: 40px; }
.stp-pcard-title { flex: 1; }
.stp-pcard-icon { width: 22px; height: 22px; border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.stp-pcard-icon--local { background: #6366f120; color: #6366f1; }
.stp-pcard-icon--steam { background: #1b9ae420; color: #1b9ae4; }
.stp-pcard-stats { display: flex; align-items: center; justify-content: space-around; padding: var(--space-4); }
.stp-pcard-stat { display: flex; flex-direction: column; align-items: center; gap: 2px; }
.stp-pcard-div { width: 1px; height: 30px; background: var(--color-border); }
.stp-pcard-num { font-size: 20px; font-weight: 700; letter-spacing: -0.03em; color: var(--color-text-primary); }
.stp-pcard-lbl { font-size: 11px; color: var(--color-text-muted); }
.stp-pcard-highlight { display: flex; align-items: center; gap: var(--space-2); padding: var(--space-2) var(--space-4); border-top: 1px solid var(--color-border-subtle); font-size: 11.5px; color: var(--color-text-muted); }
.stp-pcard-highlight strong { color: var(--color-text-primary); font-weight: 600; }

/* ── Spotlight cards (portrait 2:3, fixed width) ── */
.stp-spotlight-row { display: flex; gap: var(--space-4); }
.stp-scard { border: 1px solid var(--color-border); border-radius: var(--radius-md); overflow: hidden; display: flex; flex-direction: column; width: 200px; flex-shrink: 0; }
.stp-scard-eyebrow { display: flex; align-items: center; gap: 5px; padding: var(--space-2) var(--space-3); font-size: 10.5px; font-weight: 500; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.05em; background: var(--color-bg-secondary); border-bottom: 1px solid var(--color-border); }
.stp-scard-art-wrap { position: relative; width: 100%; aspect-ratio: 2/3; background: var(--color-bg-tertiary); overflow: hidden; }
.stp-scard-art { width: 100%; height: 100%; object-fit: cover; display: block; }
.stp-scard-logo { position: absolute; inset: 0; margin: auto; max-width: 75%; max-height: 40%; object-fit: contain; filter: drop-shadow(0 2px 8px rgba(0,0,0,0.7)); }
.stp-scard-gradient { position: absolute; bottom: 0; left: 0; right: 0; height: 50%; background: linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 100%); pointer-events: none; }
.stp-scard-foot { display: flex; align-items: center; justify-content: space-between; padding: var(--space-2) var(--space-3); background: var(--color-bg-secondary); }
.stp-scard-name { font-size: 12px; font-weight: 600; color: var(--color-text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; min-width: 0; }
.stp-scard-meta { font-size: 11px; color: var(--color-text-muted); flex-shrink: 0; margin-left: var(--space-2); }

/* ── Playtime list ── */
.stp-pt-list { padding: 0 var(--space-4); }
.stp-pt-row { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-2) 0; border-bottom: 1px solid var(--color-border-subtle); animation: stp-fadein 0.3s both; }
.stp-pt-row:last-child { border-bottom: none; }
.stp-pt-rank { font-size: 11px; font-weight: 600; color: var(--color-text-muted); min-width: 20px; text-align: right; }
.stp-pt-thumb { width: 32px; height: 22px; border-radius: 3px; background: var(--color-bg-tertiary); display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0; }
.stp-pt-img { width: 100%; height: 100%; object-fit: cover; display: block; }
.stp-pt-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.stp-pt-name { font-size: 12.5px; color: var(--color-text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.stp-pt-track { height: 3px; background: var(--color-border); border-radius: 2px; overflow: hidden; }
.stp-pt-fill { height: 100%; background: var(--color-accent); border-radius: 2px; }
.stp-pt-time { font-size: 11px; color: var(--color-text-muted); min-width: 42px; text-align: right; flex-shrink: 0; }

/* ── Histogram (layout is scoped inside PlaytimeHistogram.tsx) ── */

/* ── Histogram drawer ── */
.stp-drawer { border: 1px solid var(--color-border); border-radius: var(--radius-md); overflow: hidden; margin-top: var(--space-3); }
.stp-drawer-header { display: flex; align-items: center; gap: var(--space-2); padding: var(--space-2) var(--space-3); background: var(--color-bg-secondary); border-bottom: 1px solid var(--color-border); font-size: 12.5px; }
.stp-drawer-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.stp-drawer-title { font-weight: 600; color: var(--color-text-primary); }
.stp-drawer-count { font-size: 11px; color: var(--color-text-muted); margin-left: var(--space-1); }
.stp-drawer-close { margin-left: auto; color: var(--color-text-muted); cursor: pointer; display: flex; align-items: center; padding: 2px; border-radius: var(--radius-sm); transition: color var(--transition-fast); }
.stp-drawer-close:hover { color: var(--color-text-primary); }
.stp-drawer-list { max-height: 220px; overflow-y: auto; }
.stp-drawer-row { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-2) var(--space-3); border-bottom: 1px solid var(--color-border-subtle); }
.stp-drawer-row:last-child { border-bottom: none; }
.stp-drawer-thumb { width: 36px; height: 24px; border-radius: 3px; background: var(--color-bg-tertiary); display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0; }
.stp-drawer-thumb-img { width: 100%; height: 100%; object-fit: cover; display: block; }
.stp-drawer-info { flex: 1; min-width: 0; display: flex; align-items: center; gap: var(--space-2); }
.stp-drawer-name { font-size: 12.5px; color: var(--color-text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.stp-drawer-badge { font-size: 9.5px; color: #1b9ae4; background: #1b9ae415; border-radius: 3px; padding: 1px 4px; flex-shrink: 0; }
.stp-drawer-time { font-size: 11px; color: var(--color-text-muted); min-width: 40px; text-align: right; flex-shrink: 0; }

/* ── Donut ── */
.stp-donut { display: flex; align-items: center; justify-content: center; gap: var(--space-5); padding: var(--space-4); }
.stp-donut-svg-wrap { position: relative; width: 100px; height: 100px; flex-shrink: 0; }
.stp-donut-svg { width: 100%; height: 100%; }
.stp-donut-arc { transition: stroke-dasharray 0.6s ease; }
.stp-donut-label { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.stp-donut-pct { font-size: 18px; font-weight: 700; letter-spacing: -0.03em; color: var(--color-text-primary); }
.stp-donut-sub { font-size: 10px; color: var(--color-text-muted); }
.stp-donut-legend { display: flex; flex-direction: column; gap: var(--space-2); }
.stp-legend-row { display: flex; align-items: center; gap: var(--space-2); font-size: 12px; }
.stp-legend-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.stp-legend-text { color: var(--color-text-muted); flex: 1; }
.stp-legend-val { font-weight: 600; color: var(--color-text-primary); }

/* ── Chips ── */
.stp-chip-list { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-2); padding: var(--space-3); }
.stp-chip { display: flex; align-items: center; gap: var(--space-2); padding: var(--space-2); background: var(--color-bg); border: 1px solid var(--color-border); border-radius: var(--radius-sm); overflow: hidden; min-width: 0; }
.stp-chip-icon { width: 32px; height: 22px; border-radius: 3px; background: var(--color-bg-tertiary); display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0; }
.stp-chip-img { width: 100%; height: 100%; object-fit: cover; display: block; }
.stp-chip-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.stp-chip-name { font-size: 11.5px; font-weight: 500; color: var(--color-text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.stp-chip-sub { font-size: 10px; color: var(--color-text-muted); white-space: nowrap; }

/* ── Collection rows ── */
.stp-coll-list { padding: var(--space-1) 0; }
.stp-coll-row { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-2) var(--space-4); width: 100%; text-align: left; cursor: pointer; border: none; background: none; transition: background var(--transition-fast); }
.stp-coll-row:hover { background: var(--color-bg-secondary); }
.stp-coll-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.stp-coll-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.stp-coll-name { font-size: 13px; font-weight: 500; color: var(--color-text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.stp-coll-playtime { display: flex; align-items: center; gap: 3px; font-size: 10.5px; color: var(--color-text-muted); }
.stp-coll-track { width: 80px; height: 4px; background: var(--color-border); border-radius: 2px; overflow: hidden; flex-shrink: 0; }
.stp-coll-fill { height: 100%; border-radius: 2px; }
.stp-coll-count { font-size: 11px; color: var(--color-text-muted); min-width: 22px; text-align: right; flex-shrink: 0; }
.stp-coll-arrow { color: var(--color-text-muted); flex-shrink: 0; }

/* ── Tags ── */
.stp-tags-wrap { display: flex; flex-wrap: wrap; gap: var(--space-2); padding: var(--space-3) var(--space-4); }
.stp-tag { display: inline-flex; align-items: center; gap: 5px; padding: 3px var(--space-2); border-radius: var(--radius-sm); border: 1px solid; font-size: 12px; }
.stp-tag-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.stp-tag-name { color: var(--color-text-primary); }
.stp-tag-count { font-weight: 600; font-size: 11px; }

/* ── Empty ── */
.stp-empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--space-3); padding: var(--space-8) 0; color: var(--color-text-muted); font-size: 13px; text-align: center; }
.stp-empty-inline { color: var(--color-text-muted); font-size: 12.5px; padding: var(--space-3) var(--space-4); }

/* ── Steam mid ── */
.stp-steam-mid { display: grid; grid-template-columns: auto 1fr; gap: var(--space-4); }

/* ── Steam scan wait ── */
.stp-scan-wait { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--space-3); padding: var(--space-8); }
.stp-scan-pulse { width: 32px; height: 32px; border-radius: 50%; background: var(--color-accent); opacity: 0.5; animation: stp-pulse 1.2s ease-in-out infinite; }
.stp-scan-text { font-size: 14px; font-weight: 600; color: var(--color-text-primary); }
.stp-scan-sub { font-size: 12px; color: var(--color-text-muted); }

/* ── Steam meta ── */
.stp-meta-list { padding: var(--space-2) 0; }
.stp-meta-row { display: flex; align-items: baseline; gap: var(--space-3); padding: var(--space-2) var(--space-4); font-size: 12.5px; border-bottom: 1px solid var(--color-border-subtle); }
.stp-meta-row:last-child { border-bottom: none; }
.stp-meta-key { color: var(--color-text-muted); min-width: 90px; flex-shrink: 0; }
.stp-meta-val { color: var(--color-text-primary); flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.stp-meta-val--mono { font-family: ui-monospace, monospace; font-size: 11.5px; }
`;
