/**
 * Final add-item step: strategy metadata fields. Path fields with game
 * suggestions render the SmartSuggestPicker; other path fields use the
 * shared PathPickerButton; plain fields are text inputs.
 */
import { useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { File, FolderOpen } from "lucide-react";
import { GameSuggestions } from "@/services/tauriCommands";
import { MetadataField } from "@/types/strategy";
import SmartSuggestPicker from "@/components/common/SmartSuggestPicker";
import PathPickerButton from "./PathPickerButton";
import form from "@/styles/form.module.css";

interface MetadataStepProps {
  schema: MetadataField[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  basePath?: string;
  gameSuggestions?: GameSuggestions;
  /** Called when the user wants to scan one depth layer deeper. */
  onLoadMoreSuggestions?: () => void;
  loadingMoreSuggestions?: boolean;
  noMoreSuggestions?: boolean;
}

/**
 * Renders the strategy's metadata form.
 */
export default function MetadataStep({
  schema, values, onChange, basePath, gameSuggestions,
  onLoadMoreSuggestions, loadingMoreSuggestions, noMoreSuggestions,
}: MetadataStepProps) {
  const [picking, setPicking] = useState<string | null>(null);

  async function handlePick(field: MetadataField) {
    setPicking(field.key);
    try {
      const isFile = field.field_type === "file_path";
      const selected = await openDialog({
        directory: !isFile,
        multiple: false,
        defaultPath: basePath || undefined,
        filters: isFile ? [{ name: "Executable", extensions: ["exe"] }] : undefined,
      });
      if (typeof selected === "string" && selected) onChange(field.key, selected);
    } catch { /* cancelled */ } finally { setPicking(null); }
  }

  /** Map game metadata keys to the right suggestion list. */
  function getSuggestions(key: string) {
    if (!gameSuggestions) return null;
    if (key === "exe_path") return gameSuggestions.executables;
    if (key === "mod_folder") return gameSuggestions.mod_folders;
    if (key === "screenshot_folder") return gameSuggestions.screenshot_folders;
    return null;
  }

  return (
    <>
      {schema.map((field) => {
        const isPath = field.field_type === "file_path" || field.field_type === "folder_path";
        const isFile = field.field_type === "file_path";
        const val = values[field.key] ?? "";
        const suggestions = getSuggestions(field.key);

        if (isPath && suggestions !== null) {
          // Only the first path field shows the "load deeper" button to avoid redundancy.
          const isFirstPathField = field.key === "exe_path";
          return (
            <SmartSuggestPicker
              key={field.key}
              label={field.label}
              required={field.required}
              fieldType={field.field_type as "file_path" | "folder_path"}
              suggestions={suggestions}
              value={val}
              basePath={basePath}
              onChange={(p) => onChange(field.key, p)}
              onLoadMore={isFirstPathField ? onLoadMoreSuggestions : undefined}
              loadingMore={isFirstPathField ? loadingMoreSuggestions : undefined}
              noMore={isFirstPathField ? noMoreSuggestions : undefined}
            />
          );
        }

        return (
          <div key={field.key} className={form.label}>
            <span>
              {field.label}
              {field.required && <span style={{ color: "var(--color-danger)", marginLeft: 3 }}>*</span>}
            </span>
            {isPath ? (
              <PathPickerButton
                icon={isFile ? <File size={15} /> : <FolderOpen size={15} />}
                idleLabel={isFile ? "Click to select a file" : "Click to select a folder"}
                selectedLabel={isFile ? "File selected" : "Folder selected"}
                value={val}
                disabled={picking === field.key}
                onClick={() => handlePick(field)}
              />
            ) : (
              <input
                className={form.input}
                value={val}
                onChange={(e) => onChange(field.key, e.target.value)}
                placeholder="Enter value"
              />
            )}
            {!field.required && <span className={form.hint}>Optional</span>}
          </div>
        );
      })}
    </>
  );
}
