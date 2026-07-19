/**
 * Editable list of a game's extra executables (server, config tool, …), shared
 * by the add-item flow and the edit-item modal. Each row is a name + exe path;
 * new rows are added by picking from the scanned exe suggestions (or Browse),
 * the same way the main exe is chosen. The main exe is not managed here.
 */
import { PathSuggestion } from "@/services/tauriCommands";
import { ExtraExe } from "@/utils/extraExes";
import SmartSuggestPicker from "@/components/common/SmartSuggestPicker";
import { X } from "lucide-react";
import form from "@/styles/form.module.css";
import styles from "./ExtraExesEditor.module.css";

interface ExtraExesEditorProps {
  value: ExtraExe[];
  onChange: (next: ExtraExe[]) => void;
  /** Scanned exe suggestions for the game folder (same source as the main exe). */
  suggestions: PathSuggestion[];
  /** Game folder, used as the Browse dialog's starting directory. */
  basePath?: string;
  /** Scan one directory layer deeper. */
  onLoadMore?: () => void;
  loadingMore?: boolean;
  noMore?: boolean;
}

/** Derives a default label from an exe path ("SkyrimServer.exe" → "SkyrimServer"). */
function labelFromPath(path: string): string {
  const file = path.replace(/\\/g, "/").split("/").pop() ?? path;
  return file.replace(/\.[^.]+$/, "");
}

/**
 * Renders the extra-executables rows plus a suggestion-based add affordance.
 */
export default function ExtraExesEditor({
  value, onChange, suggestions, basePath, onLoadMore, loadingMore, noMore,
}: ExtraExesEditorProps) {
  const chosenPaths = value.map((e) => e.path);

  /** Multi-select toggle: clicking a chosen exe removes it, an unchosen adds it. */
  function togglePath(path: string) {
    if (!path) return;
    if (chosenPaths.includes(path)) {
      onChange(value.filter((e) => e.path !== path));
    } else {
      onChange([...value, { label: labelFromPath(path), path }]);
    }
  }

  function renameRow(index: number, label: string) {
    onChange(value.map((e, i) => (i === index ? { ...e, label } : e)));
  }

  function removeRow(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  return (
    <div className={styles.editor}>
      {value.map((exe, i) => (
        <div key={`${exe.path}-${i}`} className={styles.row}>
          <input
            className={`${form.input} ${styles.labelInput}`}
            value={exe.label}
            onChange={(e) => renameRow(i, e.target.value)}
            placeholder="Label"
            title="Display label for this executable"
          />
          <span className={styles.path} title={exe.path}>{exe.path}</span>
          <button
            type="button"
            className={`${styles.iconBtn} ${styles.remove}`}
            onClick={() => removeRow(i)}
            title="Remove"
          >
            <X size={13} />
          </button>
        </div>
      ))}

      {/* Multi-select suggestion list: chosen exes stay visible and checked;
          clicking toggles membership. Browse… also routes through the toggle. */}
      <SmartSuggestPicker
        label="Select executables"
        required={false}
        fieldType="file_path"
        suggestions={suggestions}
        value=""
        selectedPaths={chosenPaths}
        basePath={basePath}
        onChange={togglePath}
        onLoadMore={onLoadMore}
        loadingMore={loadingMore}
        noMore={noMore}
      />
    </div>
  );
}
