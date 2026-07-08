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
import s from "@/components/status/status.module.css";

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = "overall" | "local" | "steam";

interface LocalItem extends Item {
  playtime_seconds: number;
  playtime_minutes: number;
  last_launched: number;
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

      const allIds = allItems.map((i) => i.id);
      const playtimeMap = allIds.length > 0 ? await strategyGetPlaytimeBulk(allIds) : {};

      const allLocalItems: LocalItem[] = allItems.map((item) => {
        const pt = playtimeMap[item.id] ?? {};
        const secs = parseInt(pt["total_playtime_seconds"] ?? "0", 10) || 0;
        const mins = parseInt(pt["total_playtime_minutes"] ?? "0", 10) || 0;
        return {
          ...item,
          playtime_seconds: secs,
          playtime_minutes: mins,
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
    <div className={s.root}>
      <div className={s.header}>
        <div className={s.headerTop}>
          <h1 className={s.title}>Status</h1>
          <button
            className={s.refreshBtn}
            onClick={loadDb}
            disabled={loading}
            title="Refresh"
          >
            <RefreshCw size={13} className={loading ? s.spin : ""} />
          </button>
        </div>
        <div className={s.seg}>
          {(["overall", "local", "steam"] as Tab[]).map((t) => (
            <button
              key={t}
              className={tab === t ? `${s.segBtn} ${s.segActive}` : s.segBtn}
              onClick={() => setTab(t)}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      <div className={s.body}>
        {error && <div className={s.error}>{error}</div>}
        {!error && loading && <div className={s.loading}>Loading statistics…</div>}
        {!error && !loading && db && tab === "overall" && <OverallTab db={db} steam={steam} />}
        {!error && !loading && db && tab === "local" && <LocalTab db={db} />}
        {!error && !loading && tab === "steam" && <SteamTab steam={steam} />}
      </div>
    </div>
  );
}
