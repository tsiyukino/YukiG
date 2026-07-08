/**
 * Second add-item step: collection (when opened without context),
 * chosen path, display name, and strategy type.
 */
import { useState, useEffect } from "react";
import { collectionGetAll, StrategyEntry } from "@/services/tauriCommands";
import { PickMode } from "@/hooks/useAddItemFlow";
import form from "@/styles/form.module.css";

/** Allowed strategy types for folder pickMode. */
const FOLDER_STRATEGY_TYPES = ["game"];

interface DetailsStepProps {
  folderPath: string;
  pickMode: PickMode;
  name: string;
  onNameChange: (v: string) => void;
  strategyType: string;
  onStrategyChange: (v: string) => void;
  strategies: StrategyEntry[];
  /** Empty string = not yet in a collection context; show a selector. */
  collectionId: string;
  onCollectionChange: (id: string) => void;
}

/**
 * Renders the name/type form for the picked path.
 */
export default function DetailsStep({
  folderPath, pickMode, name, onNameChange, strategyType, onStrategyChange, strategies,
  collectionId, onCollectionChange,
}: DetailsStepProps) {
  const [collections, setCollections] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (collectionId) return; // already have a collection, no need to load
    collectionGetAll().then(setCollections).catch(() => {});
  }, [collectionId]);

  const filteredStrategies = pickMode === "folder"
    ? strategies.filter((s) => FOLDER_STRATEGY_TYPES.includes(s.strategy_type))
    : strategies.filter((s) => !s.group);

  return (
    <>
      {!collectionId && (
        <label className={form.label}>
          Add to collection
          <select className={form.input} value="" onChange={(e) => onCollectionChange(e.target.value)}>
            <option value="" disabled>Select a collection…</option>
            {collections.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
      )}
      <div className={form.label}>
        {pickMode === "file" ? "Selected file" : "Selected folder"}
        <div className={form.pathBox}>{folderPath}</div>
      </div>
      <label className={form.label}>
        Display name
        <input
          className={form.input}
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="e.g. My Game"
          autoFocus
        />
      </label>
      {pickMode !== "file" ? (
        <label className={form.label}>
          Type
          <select
            className={form.input}
            value={strategyType}
            onChange={(e) => onStrategyChange(e.target.value)}
            style={{ cursor: "pointer" }}
          >
            <option value="">Select a type…</option>
            {filteredStrategies.map((s) => (
              <option key={s.strategy_type} value={s.strategy_type}>{s.display_name}</option>
            ))}
          </select>
        </label>
      ) : (
        <p className={form.hint}>Single file — strategy is set automatically.</p>
      )}
    </>
  );
}
