/**
 * Hook that loads all data needed by the Home page dashboard in parallel.
 *
 * Uses `item_get_all_favorites` to fetch favourites from the DB directly —
 * this covers both local items and Steam games (whose `is_favorite` flag is
 * set by steam_sync when they belong to the Steam "Favorites" collection).
 * The Steam scan runs concurrently for the overview panel mosaic and counts.
 */
import { useState, useEffect, useCallback } from "react";
import { Collection } from "@/types/collection";
import { FavoriteItem } from "@/types/item";
import { Tag } from "@/types/tag";
import {
  tagGetGrouping,
  itemGetAllFavorites,
  itemGetAllGamesFull,
  tagGetAll,
} from "@/services/tauriCommands";
import { groupingTagToCollection } from "@/utils/groupingTag";

export interface HomeData {
  /** User-created (non-Steam) collections. */
  collections: Collection[];
  /** All items across user collections, flattened. */
  allItems: FavoriteItem[];
  /** All favourited items across every collection (local + Steam), with header_image. */
  allFavorites: FavoriteItem[];
  tags: Tag[];
  /** Number of Steam game items in the DB (from steam collections). */
  steamGameCount: number;

  /** Combined stats including Steam. */
  stats: {
    collections: number;
    games: number;
    favorites: number;
    tags: number;
  };
}

interface UseHomeDataReturn {
  data: HomeData | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Loads all dashboard data (local + Steam) in parallel.
 *
 * @returns Unified data, loading, and error state for the Home page.
 */
export function useHomeData(): UseHomeDataReturn {
  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [groupingTags, allTags, allFavorites, allGames] = await Promise.all([
        tagGetGrouping(),
        tagGetAll(),
        itemGetAllFavorites(),
        itemGetAllGamesFull(),
      ]);

      const collections = groupingTags.map(groupingTagToCollection);
      const userCollections = collections.filter((c) => c.default_strategy !== "steam_game");

      // allItems is the deduplicated set of every game. Walking each grouping's
      // members would count a game once per group it belongs to (a game can be
      // in several groups now), so we read the whole-library list instead.
      const allItems = allGames;
      const steamGameCount = allGames.filter((g) => g.strategy_type === "steam_game").length;

      // Tag stat excludes grouping tags (they are shown as collections, not tags).
      const nonGroupingTags = allTags.filter((t) => t.tag_type !== "grouping");

      const stats = {
        collections: collections.length,
        games: allItems.length,
        favorites: allFavorites.length,
        tags: nonGroupingTags.length,
      };

      setData({
        collections: userCollections,
        allItems,
        allFavorites,
        tags: nonGroupingTags,
        steamGameCount,
        stats,
      });
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}
