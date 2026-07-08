/**
 * Data hook for the Play page.
 *
 * Loads all local + Steam game items, their game status rows, playtime
 * metadata, mood tags, and per-item mood-tag assignments.
 *
 * Randomisation — "weighted shuffle deck":
 *   All eligible candidates are shuffled upfront with weights inversely
 *   proportional to playtime (neglected games surface first). The user walks
 *   through the deck in sequence so every game appears once before any repeat.
 *
 * Mood filtering:
 *   Mood tags (tag_type = 'mood') are shown as filter chips. Selecting one
 *   restricts the pool to items that have that tag assigned. The deck is
 *   rebuilt whenever the filtered pool changes.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { Item } from "@/types/item";
import { Tag } from "@/types/tag";
import {
  itemGetAllGames,
  strategyGetPlaytimeBulk,
  gameStatusGetAll,
  gameStatusSet,
  gameStatusBulkInit,
  tagGetAll,
  tagGetByItemsBulk,
  GameStatus,
  StoryStatus,
  OnlineStatus,
} from "@/services/tauriCommands";

/** An item enriched with status + playtime for Play-page rendering. */
export interface PlayCandidate {
  item: Item;
  status: GameStatus;
  totalPlayMinutes: number;
  lastLaunched: number | null;
  /** Tag ids assigned to this item — used for mood filtering. */
  tagIds: Set<string>;
  /** Mood tags assigned to this item — used for display. */
  moodTags: Array<{ id: string; name: string; color: string }>;
  /** Whether the game is currently installed (Steam games only — local games are always true). */
  isInstalled: boolean;
  /**
   * Steam app type ("game", "application", "tool", "dlc", etc.).
   * `null` for local (non-Steam) games, which are always included.
   * An empty string means the Steam item has no type field — treated as non-game.
   */
  appType: string | null;
}

/**
 * Play mode filter — which games to surface:
 * - "all": all eligible games
 * - "continue": games with story_status "playing" or "on_hold"
 * - "new": games with story_status "unplayed"
 * - "online": games with online_status "active"
 */
export type PlayModeFilter = "all" | "continue" | "new" | "online";

export const SNOOZE_OPTIONS = [
  { label: "1 week",    days: 7  },
  { label: "2 weeks",   days: 14 },
  { label: "1 month",   days: 30 },
  { label: "3 months",  days: 90 },
] as const;

const ACTIVE_STORY_STATUSES: StoryStatus[] = ["unplayed", "playing", "on_hold"];

export interface UsePlayPageReturn {
  loading: boolean;
  error: string | null;
  moodTags: Tag[];
  selectedMoodTagId: string | null;
  setSelectedMoodTagId: (id: string | null) => void;
  playMode: PlayModeFilter;
  setPlayMode: (mode: PlayModeFilter) => void;
  installedOnly: boolean;
  setInstalledOnly: (v: boolean) => void;
  featured: PlayCandidate | null;
  candidates: PlayCandidate[];
  skip: () => void;
  setStoryStatus: (itemId: string, status: StoryStatus) => Promise<void>;
  snooze: (itemId: string, days: number) => Promise<void>;
  featureCandidate: (candidate: PlayCandidate) => void;
  reload: () => void;
}

// ---------------------------------------------------------------------------
// Weighted shuffle deck (Efraimidis-Spirakis)
// ---------------------------------------------------------------------------

function candidateWeight(c: PlayCandidate): number {
  const mins = c.totalPlayMinutes;
  if (mins === 0) return 10;
  return Math.max(1, Math.round(10 / Math.sqrt(mins / 60)));
}

/**
 * Returns a shuffled ordering of 0..pool.length-1 where higher-weight
 * candidates tend to appear earlier. Every index appears exactly once.
 */
function buildDeck(pool: PlayCandidate[]): number[] {
  const keyed = pool.map((c, i) => ({
    i,
    key: Math.pow(Math.random(), 1 / candidateWeight(c)),
  }));
  keyed.sort((a, b) => b.key - a.key);
  return keyed.map((x) => x.i);
}

// ---------------------------------------------------------------------------
// Eligibility
// ---------------------------------------------------------------------------

function isEligible(c: PlayCandidate): boolean {
  // Exclude non-game Steam items (DLC, tools, applications, soundtracks, etc.).
  // null = local game (no steam_app_type key) → always included.
  // "" = Steam item with no type in appinfo.vdf → treat as non-game and exclude.
  if (c.appType !== null && c.appType !== "game") return false;

  const { story_status, online_status, snooze_until } = c.status;
  const storyOk = ACTIVE_STORY_STATUSES.includes(story_status as StoryStatus);
  const onlineOk = online_status === "active";
  if (!storyOk && !onlineOk) return false;
  if (snooze_until && Date.now() < new Date(snooze_until).getTime()) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePlayPage(): UsePlayPageReturn {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /** All game items with enriched data — the full unfiltered pool. */
  const [allCandidates, setAllCandidates] = useState<PlayCandidate[]>([]);
  const [moodTags, setMoodTags] = useState<Tag[]>([]);
  const [selectedMoodTagId, setSelectedMoodTagId] = useState<string | null>(null);
  const [playMode, setPlayMode] = useState<PlayModeFilter>("all");
  const [installedOnly, setInstalledOnly] = useState(false);

  /**
   * The eligible, mood-filtered pool stored in state so effects have a
   * stable, up-to-date reference (unlike inline-derived arrays).
   */
  const [pool, setPool] = useState<PlayCandidate[]>([]);

  const [version, setVersion] = useState(0);

  // Shuffle deck: indices into `pool`.
  const deckRef    = useRef<number[]>([]);
  const deckPosRef = useRef<number>(0);

  // Maps synthetic merged mood IDs to the real tag-ID sets they represent.
  const mergedMoodBucketsRef = useRef<{
    coopIds: Set<string>;
    pvpIds: Set<string>;
    singleIds: Set<string>;
  }>({ coopIds: new Set(), pvpIds: new Set(), singleIds: new Set() });

  // Index into `pool` of the currently featured game.
  const [featuredIndex, setFeaturedIndex] = useState<number | null>(null);

  // -------------------------------------------------------------------------
  // Load from backend
  // -------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        await gameStatusBulkInit();

        const [items, statuses, allTags] = await Promise.all([
          itemGetAllGames(),
          gameStatusGetAll(),
          tagGetAll(),
        ]);

        if (cancelled) return;

        const ids = items.map((it) => it.id);
        const [playtimeMap, itemTagRows] = await Promise.all([
          ids.length > 0
            ? strategyGetPlaytimeBulk(ids)
            : Promise.resolve({} as Record<string, Record<string, string>>),
          ids.length > 0 ? tagGetByItemsBulk(ids) : Promise.resolve([]),
        ]);

        if (cancelled) return;

        // Build item → tag-id set map and item → mood-tag objects map.
        const itemTagMap = new Map<string, Set<string>>();
        const itemMoodTagsMap = new Map<string, Array<{ id: string; name: string; color: string }>>();
        for (const row of itemTagRows) {
          if (!itemTagMap.has(row.item_id)) itemTagMap.set(row.item_id, new Set());
          itemTagMap.get(row.item_id)!.add(row.tag_id);
          if (row.tag_type === "mood") {
            if (!itemMoodTagsMap.has(row.item_id)) itemMoodTagsMap.set(row.item_id, []);
            itemMoodTagsMap.get(row.item_id)!.push({ id: row.tag_id, name: row.tag_name, color: row.tag_color });
          }
        }

        const statusMap: Record<string, GameStatus> = {};
        for (const s of statuses) statusMap[s.item_id] = s;

        const candidates: PlayCandidate[] = items.map((item) => {
          const pt = playtimeMap[item.id] ?? {};
          // is_installed: Steam games set this flag; local games are always installed.
          const isInstalledRaw = pt.is_installed;
          const isInstalled = isInstalledRaw === undefined || isInstalledRaw === "true";
          return {
            item,
            status: statusMap[item.id] ?? {
              item_id: item.id,
              story_status: "unplayed",
              online_status: "inactive",
              snooze_until: null,
            },
            totalPlayMinutes: parseInt(pt.total_playtime_minutes ?? "0", 10) || 0,
            lastLaunched: pt.last_launched ? parseInt(pt.last_launched, 10) : null,
            tagIds: itemTagMap.get(item.id) ?? new Set(),
            moodTags: itemMoodTagsMap.get(item.id) ?? [],
            isInstalled,
            appType: "steam_app_type" in pt ? (pt.steam_app_type ?? "") : null,
          };
        });

        // ── Merge subdivided mood tags into three play-page groups ──────────
        // The DB stores granular tags (Online PvP, Local Co-op, etc.) for the
        // detail page. On the Play page we collapse them into three buckets so
        // the filter bar stays clean.
        const COOP_NAMES   = new Set(["Co-op", "Online Co-op", "Local Co-op", "Shared/Split Screen"]);
        const PVP_NAMES    = new Set(["PvP", "Online PvP", "Multiplayer", "Local Multiplayer"]);
        const SINGLE_NAMES = new Set(["Single-player"]);

        // Collect the real tag IDs that belong to each bucket.
        const coopIds:   Set<string> = new Set();
        const pvpIds:    Set<string> = new Set();
        const singleIds: Set<string> = new Set();
        for (const t of allTags) {
          if (t.tag_type !== "mood") continue;
          if (COOP_NAMES.has(t.name))   coopIds.add(t.id);
          else if (PVP_NAMES.has(t.name))    pvpIds.add(t.id);
          else if (SINGLE_NAMES.has(t.name)) singleIds.add(t.id);
        }

        // Synthetic merged tag objects. Use a stable fake ID so selection state
        // survives re-renders. Only include a bucket if at least one real tag
        // from it exists in the library.
        const mergedMoods: Tag[] = [];
        const synthetic = { group_id: null, icon: "", description: "", sort_order: 0 } as const;
        if (singleIds.size > 0) mergedMoods.push({ id: "__single", name: "Single-player", color: "#6366f1", tag_type: "mood", ...synthetic });
        if (coopIds.size   > 0) mergedMoods.push({ id: "__coop",   name: "Co-op",         color: "#22c55e", tag_type: "mood", ...synthetic });
        if (pvpIds.size    > 0) mergedMoods.push({ id: "__pvp",    name: "PvP",            color: "#ef4444", tag_type: "mood", ...synthetic });

        // Other mood tags that don't fall into the three buckets pass through unchanged.
        const otherMoods = allTags.filter(
          (t) => t.tag_type === "mood" &&
                 !COOP_NAMES.has(t.name) && !PVP_NAMES.has(t.name) && !SINGLE_NAMES.has(t.name)
        );

        // Store the bucket→real-id mapping so the filter effect can use it.
        mergedMoodBucketsRef.current = { coopIds, pvpIds, singleIds };

        setAllCandidates(candidates);
        setMoodTags([...mergedMoods, ...otherMoods]);
        // pool + deck will be rebuilt by the effect below.
      } catch (err) {
        if (!cancelled) setError(String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [version]);

  // -------------------------------------------------------------------------
  // Recompute pool whenever allCandidates or any filter changes
  // -------------------------------------------------------------------------
  useEffect(() => {
    let filtered = allCandidates.filter(isEligible);

    if (selectedMoodTagId) {
      const { coopIds, pvpIds, singleIds } = mergedMoodBucketsRef.current;
      const bucketIds =
        selectedMoodTagId === "__coop"   ? coopIds :
        selectedMoodTagId === "__pvp"    ? pvpIds :
        selectedMoodTagId === "__single" ? singleIds : null;
      if (bucketIds) {
        filtered = filtered.filter((c) => [...bucketIds].some((id) => c.tagIds.has(id)));
      } else {
        filtered = filtered.filter((c) => c.tagIds.has(selectedMoodTagId));
      }
    }

    if (installedOnly) {
      filtered = filtered.filter((c) => c.isInstalled);
    }

    if (playMode === "continue") {
      filtered = filtered.filter((c) =>
        c.status.story_status === "playing" || c.status.story_status === "on_hold"
      );
    } else if (playMode === "new") {
      filtered = filtered.filter((c) => c.status.story_status === "unplayed");
    } else if (playMode === "online") {
      filtered = filtered.filter((c) => c.status.online_status === "active");
    }

    setPool(filtered);
  }, [allCandidates, selectedMoodTagId, installedOnly, playMode]);

  // -------------------------------------------------------------------------
  // Rebuild deck whenever pool changes
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (pool.length === 0) {
      deckRef.current    = [];
      deckPosRef.current = 0;
      setFeaturedIndex(null);
      return;
    }

    const deck = buildDeck(pool);
    deckRef.current    = deck;
    deckPosRef.current = 0;
    setFeaturedIndex(deck[0]);
  }, [pool]);

  // -------------------------------------------------------------------------
  // Derived featured + candidate list
  // -------------------------------------------------------------------------
  const featured =
    featuredIndex !== null && featuredIndex < pool.length
      ? pool[featuredIndex]
      : null;

  const candidates = pool.filter((_, i) => i !== featuredIndex);

  // -------------------------------------------------------------------------
  // Deck advance — shared by skip / status changes
  // -------------------------------------------------------------------------
  const advanceDeck = useCallback(
    (currentPool: PlayCandidate[], excludeId?: string) => {
      const effective = excludeId
        ? currentPool.filter((c) => c.item.id !== excludeId)
        : currentPool;

      if (effective.length === 0) {
        setFeaturedIndex(null);
        return;
      }

      // Rebuild deck on the effective pool and start from 0.
      const newDeck = buildDeck(effective);

      // Map effective indices back to currentPool indices.
      const remapped = newDeck.map((effIdx) => {
        const id = effective[effIdx].item.id;
        return currentPool.findIndex((c) => c.item.id === id);
      });

      deckRef.current    = remapped;
      deckPosRef.current = 0;
      setFeaturedIndex(remapped[0] ?? null);
    },
    []
  );

  const skip = useCallback(() => {
    if (pool.length <= 1) return;

    let pos = deckPosRef.current + 1;

    if (pos >= deckRef.current.length) {
      // End of deck — rebuild, avoiding immediate repeat.
      const currentId = featured?.item.id;
      const newDeck = buildDeck(pool);
      if (
        newDeck.length > 1 &&
        currentId &&
        pool[newDeck[0]]?.item.id === currentId
      ) {
        [newDeck[0], newDeck[1]] = [newDeck[1], newDeck[0]];
      }
      deckRef.current = newDeck;
      pos = 0;
    }

    deckPosRef.current = pos;
    setFeaturedIndex(deckRef.current[pos]);
  }, [pool, featured]);

  // -------------------------------------------------------------------------
  // Status / snooze actions
  // -------------------------------------------------------------------------

  const setStoryStatus = useCallback(
    async (itemId: string, newStatus: StoryStatus) => {
      const current = allCandidates.find((c) => c.item.id === itemId)?.status;
      if (!current) return;

      await gameStatusSet(
        itemId,
        newStatus,
        current.online_status as OnlineStatus,
        current.snooze_until
      );

      setAllCandidates((prev) =>
        prev.map((c) =>
          c.item.id === itemId
            ? { ...c, status: { ...c.status, story_status: newStatus } }
            : c
        )
      );

      if (["completed", "abandoned", "snoozed"].includes(newStatus)) {
        advanceDeck(pool, itemId);
      }
    },
    [allCandidates, pool, advanceDeck]
  );

  const snooze = useCallback(
    async (itemId: string, days: number) => {
      const current = allCandidates.find((c) => c.item.id === itemId)?.status;
      if (!current) return;

      const expiry = new Date();
      expiry.setDate(expiry.getDate() + days);
      const snoozeUntil = expiry.toISOString();

      await gameStatusSet(
        itemId,
        "snoozed",
        current.online_status as OnlineStatus,
        snoozeUntil
      );

      setAllCandidates((prev) =>
        prev.map((c) =>
          c.item.id === itemId
            ? { ...c, status: { ...c.status, story_status: "snoozed", snooze_until: snoozeUntil } }
            : c
        )
      );

      advanceDeck(pool, itemId);
    },
    [allCandidates, pool, advanceDeck]
  );

  const featureCandidate = useCallback(
    (candidate: PlayCandidate) => {
      const idx = pool.findIndex((c) => c.item.id === candidate.item.id);
      if (idx === -1) return;
      const deckIdx = deckRef.current.indexOf(idx);
      if (deckIdx !== -1) deckPosRef.current = deckIdx;
      setFeaturedIndex(idx);
    },
    [pool]
  );

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  return {
    loading,
    error,
    moodTags,
    selectedMoodTagId,
    setSelectedMoodTagId,
    playMode,
    setPlayMode,
    installedOnly,
    setInstalledOnly,
    featured,
    candidates,
    skip,
    setStoryStatus,
    snooze,
    featureCandidate,
    reload,
  };
}
