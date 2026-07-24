/**
 * Edit-modal step for a game's folder paths: executable, mod / screenshots /
 * saves folders, and extra executables. Executable and mod/screenshot folders
 * draw from the scanned suggestions; saves is browse-only (no scan category).
 * Shown for both local and Steam games so either can point at local content.
 */
import SmartSuggestPicker from "@/components/common/SmartSuggestPicker";
import ExtraExesEditor from "@/components/detail/ExtraExesEditor";
import { ExtraExe } from "@/utils/extraExes";
import { useGameSuggestions } from "@/hooks/useGameSuggestions";
import form from "@/styles/form.module.css";

interface GamePathsStepProps {
  /** Game folder — the scan root and the Browse dialog's start directory. */
  basePath: string;
  exePath: string; onExeChange: (v: string) => void;
  modFolder: string; onModChange: (v: string) => void;
  screenshotFolder: string; onScreenshotChange: (v: string) => void;
  saveFolder: string; onSaveChange: (v: string) => void;
  extraExes: ExtraExe[]; onExtraExesChange: (v: ExtraExe[]) => void;
}

/**
 * Renders the paths step.
 */
export default function GamePathsStep({
  basePath,
  exePath, onExeChange,
  modFolder, onModChange,
  screenshotFolder, onScreenshotChange,
  saveFolder, onSaveChange,
  extraExes, onExtraExesChange,
}: GamePathsStepProps) {
  const suggest = useGameSuggestions(basePath || null);
  const s = suggest.suggestions;

  return (
    <div className={form.form}>
      <SmartSuggestPicker
        label="Executable (.exe)"
        required={false}
        fieldType="file_path"
        suggestions={s?.executables ?? []}
        value={exePath}
        basePath={basePath}
        onChange={onExeChange}
        onLoadMore={suggest.loadMore}
        loadingMore={suggest.loadingMore}
        noMore={suggest.maxDepthReached}
      />
      <SmartSuggestPicker
        label="Mod Folder"
        required={false}
        fieldType="folder_path"
        suggestions={s?.mod_folders ?? []}
        value={modFolder}
        basePath={basePath}
        onChange={onModChange}
      />
      <SmartSuggestPicker
        label="Screenshots Folder"
        required={false}
        fieldType="folder_path"
        suggestions={s?.screenshot_folders ?? []}
        value={screenshotFolder}
        basePath={basePath}
        onChange={onScreenshotChange}
      />
      <SmartSuggestPicker
        label="Saves Folder"
        required={false}
        fieldType="folder_path"
        suggestions={[]}
        value={saveFolder}
        basePath={basePath}
        onChange={onSaveChange}
      />

      <div className={form.label}>
        <span>Extra executables</span>
        <ExtraExesEditor
          value={extraExes}
          onChange={onExtraExesChange}
          suggestions={s?.executables ?? []}
          basePath={basePath}
          onLoadMore={suggest.loadMore}
          loadingMore={suggest.loadingMore}
          noMore={suggest.maxDepthReached}
        />
      </div>
    </div>
  );
}
