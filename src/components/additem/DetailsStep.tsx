/**
 * Second add-item step: chosen path, display name, and strategy type.
 */
import { StrategyEntry } from "@/services/tauriCommands";
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
}

/**
 * Renders the name/type form for the picked path.
 *
 * Games are added ungrouped; the user files them into groups afterward from a
 * group page, so there is no collection picker here.
 */
export default function DetailsStep({
  folderPath, pickMode, name, onNameChange, strategyType, onStrategyChange, strategies,
}: DetailsStepProps) {
  const filteredStrategies = pickMode === "folder"
    ? strategies.filter((s) => FOLDER_STRATEGY_TYPES.includes(s.strategy_type))
    : strategies.filter((s) => !s.group);

  return (
    <>
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
