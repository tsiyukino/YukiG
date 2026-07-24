/**
 * State and save logic for the multi-step edit-item modal.
 *
 * Loads the item's current values (general fields, game status/flags, and the
 * four folder paths) and exposes setters plus a single `save`. Splitting this
 * out keeps EditItemModal to step wiring. Folder paths apply to both local and
 * Steam games — a Steam game can point at hand-installed mods and local saves.
 */
import { useState, useEffect, useCallback } from "react";
import {
  itemUpdate,
  gameStatusGet,
  gameStatusSet,
  strategyGetMetadata,
  strategyUpsertMetadata,
  GameStatus,
  StoryStatus,
  OnlineStatus,
} from "@/services/tauriCommands";
import { Item } from "@/types/item";
import { ExtraExe, parseExtraExes, serializeExtraExes } from "@/utils/extraExes";

/** True for strategy types that carry game status, flags, and folder paths. */
export const IS_GAME = (s: string) => s === "game" || s === "steam_game";

export interface EditItemFlow {
  // General
  name: string; setName: (v: string) => void;
  description: string; setDescription: (v: string) => void;
  strategyType: string; setStrategyType: (v: string) => void;
  // Game status / flags
  storyStatus: StoryStatus; setStoryStatus: (v: StoryStatus) => void;
  onlineStatus: OnlineStatus; setOnlineStatus: (v: OnlineStatus) => void;
  hasStory: boolean; setHasStory: (v: boolean) => void;
  hasPvp: boolean; setHasPvp: (v: boolean) => void;
  isLiveService: boolean; setIsLiveService: (v: boolean) => void;
  // Paths
  exePath: string; setExePath: (v: string) => void;
  modFolder: string; setModFolder: (v: string) => void;
  screenshotFolder: string; setScreenshotFolder: (v: string) => void;
  saveFolder: string; setSaveFolder: (v: string) => void;
  extraExes: ExtraExe[]; setExtraExes: (v: ExtraExe[]) => void;
  // Meta
  isGame: boolean;
  submitting: boolean;
  error: string | null;
  setError: (v: string | null) => void;
  /** Persists all changes; resolves with the updated item on success. */
  save: () => Promise<Item | null>;
}

/**
 * Owns the edit modal's fields and the save routine for a single item.
 */
export function useEditItemFlow(item: Item): EditItemFlow {
  const isGame = IS_GAME(item.strategy_type);

  const [name, setName] = useState(item.name);
  const [description, setDescription] = useState(item.description);
  const [strategyType, setStrategyType] = useState(item.strategy_type);

  const [storyStatus, setStoryStatus] = useState<StoryStatus>("unplayed");
  const [onlineStatus, setOnlineStatus] = useState<OnlineStatus>("inactive");
  const [snoozeUntil, setSnoozeUntil] = useState<string | null>(null);
  const [hasStory, setHasStory] = useState(false);
  const [hasPvp, setHasPvp] = useState(false);
  const [isLiveService, setIsLiveService] = useState(false);

  const [exePath, setExePath] = useState("");
  const [modFolder, setModFolder] = useState("");
  const [screenshotFolder, setScreenshotFolder] = useState("");
  const [saveFolder, setSaveFolder] = useState("");
  const [extraExes, setExtraExes] = useState<ExtraExe[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isGame) return;
    gameStatusGet(item.id)
      .then((gs: GameStatus) => {
        setStoryStatus(gs.story_status as StoryStatus);
        setOnlineStatus(gs.online_status as OnlineStatus);
        setSnoozeUntil(gs.snooze_until ?? null);
      })
      .catch(() => {});
    // Initialize flags and paths from stored metadata; saving writes all of
    // them, so starting from empty would wipe existing values.
    strategyGetMetadata(item.id)
      .then((meta) => {
        setHasStory(meta.has_story === "true");
        setHasPvp(meta.has_pvp === "true");
        setIsLiveService(meta.is_live_service === "true");
        setExePath(meta.exe_path ?? "");
        setModFolder(meta.mod_folder ?? "");
        setScreenshotFolder(meta.screenshot_folder ?? "");
        setSaveFolder(meta.save_folder ?? "");
        setExtraExes(parseExtraExes(meta.extra_exes));
      })
      .catch(() => {});
  }, [item.id, isGame]);

  const save = useCallback(async (): Promise<Item | null> => {
    if (!name.trim()) return null;
    setSubmitting(true);
    setError(null);
    try {
      const updated = await itemUpdate(
        item.id,
        name.trim() !== item.name ? name.trim() : undefined,
        description.trim() !== item.description ? description.trim() : undefined,
        strategyType !== item.strategy_type ? strategyType : undefined,
      );

      if (isGame) {
        await gameStatusSet(item.id, storyStatus, onlineStatus, snoozeUntil);
        await strategyUpsertMetadata(item.id, {
          has_story: hasStory ? "true" : "false",
          has_pvp: hasPvp ? "true" : "false",
          is_live_service: isLiveService ? "true" : "false",
          exe_path: exePath,
          mod_folder: modFolder,
          screenshot_folder: screenshotFolder,
          save_folder: saveFolder,
          extra_exes: serializeExtraExes(extraExes),
        });
      }
      return updated;
    } catch (err) {
      setError(String(err));
      return null;
    } finally {
      setSubmitting(false);
    }
  }, [
    item, name, description, strategyType, isGame,
    storyStatus, onlineStatus, snoozeUntil, hasStory, hasPvp, isLiveService,
    exePath, modFolder, screenshotFolder, saveFolder, extraExes,
  ]);

  return {
    name, setName, description, setDescription, strategyType, setStrategyType,
    storyStatus, setStoryStatus, onlineStatus, setOnlineStatus,
    hasStory, setHasStory, hasPvp, setHasPvp, isLiveService, setIsLiveService,
    exePath, setExePath, modFolder, setModFolder,
    screenshotFolder, setScreenshotFolder, saveFolder, setSaveFolder,
    extraExes, setExtraExes,
    isGame, submitting, error, setError, save,
  };
}
