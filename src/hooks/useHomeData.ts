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
  collectionGetAll,
  itemGetByCollection,
  itemGetAllFavorites,
  tagGetAll,
} from "@/services/tauriCommands";

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
      const [collections, tags, allFavorites] = await Promise.all([
        collectionGetAll(),
        tagGetAll(),
        itemGetAllFavorites(),
      ]);

      const userCollections = collections.filter((c) => c.default_strategy !== "steam_game");
      const steamCollections = collections.filter((c) => c.default_strategy === "steam_game");

      // Fetch items for every collection, user and Steam alike. Steam games are
      // first-class library items now, so they belong in allItems — the
      // now-playing banner and any all-games consumer resolve against it.
      const [userItemResults, ...steamItemResults] = await Promise.all([
        Promise.all(userCollections.map((c) => itemGetByCollection(c.id))),
        ...steamCollections.map((c) => itemGetByCollection(c.id)),
      ]);
      const userItems = (userItemResults as FavoriteItem[][]).flat();
      const steamItems = (steamItemResults as FavoriteItem[][]).flat();
      const allItems = [...userItems, ...steamItems];

      const stats = {
        collections: userCollections.length + steamCollections.length,
        games: allItems.length,
        favorites: allFavorites.length,
        tags: tags.length,
      };

      setData({
        collections: userCollections,
        allItems,
        allFavorites,
        tags,
        steamGameCount: steamItems.length,
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
