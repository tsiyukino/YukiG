/**
 * State machine for the add-item flow: pick → details → metadata,
 * plus exe-path suggestions for game items and the final create call.
 */
import { useState, useEffect } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import {
  itemCreate,
  strategyList,
  strategyGetMetadataSchema,
  strategyUpsertMetadata,
  gameSuggestPaths,
  GameSuggestions,
  StrategyEntry,
} from "@/services/tauriCommands";
import { MetadataField } from "@/types/strategy";

export type Step = "pick" | "details" | "metadata";
export type PickMode = "folder" | "file";

/** Deepest directory level the suggestion scan will walk. */
const MAX_SUGGEST_DEPTH = 4;

interface AddItemFlowArgs {
  /** Collection to file under, or null to add to the library ungrouped. */
  collectionId: string | null;
  defaultStrategy: string;
  parentId: string | null;
  /** Pre-filled path (drag-and-drop) — skips the pick step. */
  initialPath?: string;
  onSuccess: (itemId: string, strategyType: string) => void;
}

/** Derives display name, pick mode, and strategy from a file/folder path. */
function derivedFromPath(path: string, defaultStrategy: string): { name: string; mode: PickMode; strategy: string } {
  const parts = path.replace(/\\/g, "/").split("/");
  const rawName = parts[parts.length - 1] || path;
  const hasExtension = /\.[^./]+$/.test(rawName);
  if (hasExtension) {
    return { name: rawName.replace(/\.[^.]+$/, ""), mode: "file", strategy: "file" };
  }
  return { name: rawName, mode: "folder", strategy: defaultStrategy };
}

/**
 * Owns the add-item wizard state and submission.
 */
export function useAddItemFlow({ collectionId: collectionIdProp, defaultStrategy, parentId, initialPath, onSuccess }: AddItemFlowArgs) {
  const [step, setStep] = useState<Step>(() => (initialPath ? "details" : "pick"));
  const [pickMode, setPickMode] = useState<PickMode>(
    () => (initialPath ? derivedFromPath(initialPath, defaultStrategy).mode : "folder")
  );
  const [folderPath, setFolderPath] = useState(initialPath ?? "");
  // When opened via drag-drop without a collection context, the user picks one inline.
  const [collectionId, setCollectionId] = useState(collectionIdProp);
  const [strategies, setStrategies] = useState<StrategyEntry[]>([]);
  const [schema, setSchema] = useState<MetadataField[]>([]);
  const [metaValues, setMetaValues] = useState<Record<string, string>>({});
  const [gameSuggestions, setGameSuggestions] = useState<GameSuggestions | null>(null);
  const [suggestDepth, setSuggestDepth] = useState(0);
  const [suggestLoadingMore, setSuggestLoadingMore] = useState(false);
  const [suggestMaxDepth, setSuggestMaxDepth] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(() => (initialPath ? derivedFromPath(initialPath, defaultStrategy).name : ""));
  const [strategyType, setStrategyType] = useState(
    () => (initialPath ? derivedFromPath(initialPath, defaultStrategy).strategy : defaultStrategy)
  );

  useEffect(() => { strategyList().then(setStrategies).catch(() => {}); }, []);

  // Fetch root-level suggestions (depth 0) only — fast, covers 99% of games.
  useEffect(() => {
    if (strategyType !== "game" || !folderPath) {
      setGameSuggestions(null);
      setSuggestDepth(0);
      setSuggestMaxDepth(false);
      return;
    }
    gameSuggestPaths(folderPath, 0).then(setGameSuggestions).catch(() => setGameSuggestions(null));
    setSuggestDepth(0);
    setSuggestMaxDepth(false);
  }, [strategyType, folderPath]);

  useEffect(() => {
    if (!strategyType) return;
    strategyGetMetadataSchema(strategyType)
      .then((fields) => {
        setSchema(fields);
        const init: Record<string, string> = {};
        fields.forEach((f) => { init[f.key] = ""; });
        setMetaValues(init);
      })
      .catch(() => setSchema([]));
  }, [strategyType]);

  async function loadMoreSuggestions() {
    if (!folderPath || suggestLoadingMore || suggestMaxDepth) return;
    const nextDepth = suggestDepth + 1;
    if (nextDepth > MAX_SUGGEST_DEPTH) { setSuggestMaxDepth(true); return; }
    setSuggestLoadingMore(true);
    try {
      const more = await gameSuggestPaths(folderPath, nextDepth);
      setSuggestDepth(nextDepth);
      if (nextDepth >= MAX_SUGGEST_DEPTH) setSuggestMaxDepth(true);
      // Append new results to existing suggestions.
      setGameSuggestions((prev) => prev ? {
        executables: [...prev.executables, ...more.executables],
        mod_folders: [...prev.mod_folders, ...more.mod_folders],
        screenshot_folders: [...prev.screenshot_folders, ...more.screenshot_folders],
      } : more);
    } catch { /* non-fatal */ } finally {
      setSuggestLoadingMore(false);
    }
  }

  async function pick(m: PickMode) {
    setError(null);
    try {
      const selected = await openDialog({ directory: m === "folder", multiple: false });
      if (typeof selected === "string" && selected) {
        setPickMode(m);
        setFolderPath(selected);
        const parts = selected.replace(/\\/g, "/").split("/");
        const rawName = parts[parts.length - 1] || selected;
        // For files, strip the extension from the display name and auto-set strategy.
        setName(m === "file" ? rawName.replace(/\.[^.]+$/, "") : rawName);
        if (m === "file") setStrategyType("file");
        setStep("details");
      }
    } catch (e) { setError(String(e)); }
  }

  function detailsNext() {
    // A null collectionId is valid: the item is added to the library ungrouped.
    if (!name.trim()) { setError("Name is required."); return; }
    // File pickMode auto-sets strategyType to "file" — no dropdown shown.
    if (pickMode !== "file" && !strategyType) { setError("Select a type."); return; }
    setError(null);
    if (schema.length > 0) setStep("metadata");
    else submit();
  }

  async function submit() {
    setError(null);
    for (const field of schema) {
      if (field.required && !metaValues[field.key]?.trim()) {
        setError(`"${field.label}" is required.`);
        return;
      }
    }
    setSubmitting(true);
    try {
      const item = await itemCreate(collectionId, name.trim(), folderPath, strategyType, "", parentId);
      const filledMeta: Record<string, string> = {};
      for (const [key, val] of Object.entries(metaValues)) {
        if (val.trim()) filledMeta[key] = val.trim();
      }
      if (Object.keys(filledMeta).length > 0) {
        await strategyUpsertMetadata(item.id, filledMeta);
      }
      onSuccess(item.id, strategyType);
    } catch (e) {
      setError(String(e));
      setSubmitting(false);
    }
  }

  function back() {
    setError(null);
    setStep(step === "metadata" ? "details" : "pick");
  }

  return {
    step, setStep, back,
    pickMode, folderPath, pick,
    collectionId, setCollectionId,
    name, setName,
    strategyType, setStrategyType, strategies,
    schema, metaValues, setMetaValue: (k: string, v: string) => setMetaValues((p) => ({ ...p, [k]: v })),
    gameSuggestions, loadMoreSuggestions, suggestLoadingMore, suggestMaxDepth,
    submitting, setSubmitting, error, setError,
    detailsNext, submit,
  };
}
