/**
 * Compact smart-suggest picker used in the game metadata step.
 *
 * Shows a ranked list of path candidates (executables, mod folders,
 * screenshot folders). The top N items are shown immediately; a
 * "Show more" toggle reveals the rest. The user can also click
 * "Browse…" to pick manually via the OS dialog.
 */
import { useState } from "react";
import { ChevronDown, ChevronUp, FolderOpen, FileText, Check } from "lucide-react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { PathSuggestion } from "@/services/tauriCommands";
import { formatFileSize } from "@/utils/formatFileSize";
import styles from "./SmartSuggestPicker.module.css";

/** How many suggestions to show before the expand button. */
const INITIAL_VISIBLE = 3;

interface SmartSuggestPickerProps {
  /** Label shown above the picker (e.g. "Executable (.exe)"). */
  label: string;
  /** Whether a selection is required. */
  required: boolean;
  /** Field type: "file_path" or "folder_path". */
  fieldType: "file_path" | "folder_path";
  /** Sorted suggestion list from the backend. */
  suggestions: PathSuggestion[];
  /** Currently selected path (empty string = none). Ignored in multi-select mode. */
  value: string;
  /**
   * Multi-select mode: paths currently chosen elsewhere. Items in this set
   * render checked and stay in the list; every click reports the path via
   * `onChange` and the parent toggles membership.
   */
  selectedPaths?: string[];
  /** Base path passed to the OS dialog as the starting directory. */
  basePath?: string;
  onChange: (path: string) => void;
  /** Called to scan one layer deeper. If absent, no load-more button is shown. */
  onLoadMore?: () => void;
  /** True while the deeper scan is in progress. */
  loadingMore?: boolean;
  /** True when the maximum scan depth has been reached. */
  noMore?: boolean;
}

/**
 * Renders a compact suggestion list with an expand toggle and a manual browse fallback.
 */
export default function SmartSuggestPicker({
  label, required, fieldType, suggestions, value, selectedPaths, basePath, onChange,
  onLoadMore, loadingMore, noMore,
}: SmartSuggestPickerProps) {
  const multi = selectedPaths !== undefined;
  const [expanded, setExpanded] = useState(false);
  const [picking, setPicking] = useState(false);

  const visible = expanded ? suggestions : suggestions.slice(0, INITIAL_VISIBLE);
  const hasMore = suggestions.length > INITIAL_VISIBLE;
  const isFile = fieldType === "file_path";

  async function handleBrowse() {
    setPicking(true);
    try {
      const selected = await openDialog({
        directory: !isFile,
        multiple: false,
        defaultPath: basePath || undefined,
        filters: isFile ? [{ name: "Executable", extensions: ["exe"] }] : undefined,
      });
      if (typeof selected === "string" && selected) onChange(selected);
    } catch { /* cancelled */ } finally { setPicking(false); }
  }

  /** Formats the display path: strip the base path prefix for brevity. */
  function shortPath(p: string): string {
    if (basePath && p.startsWith(basePath)) {
      return "." + p.slice(basePath.length).replace(/\\/g, "/");
    }
    return p;
  }

  return (
    <div className={styles.root}>
      <div className={styles.labelRow}>
        <span className={styles.label}>
          {label}
          {required && <span style={{ color: "var(--color-danger)", marginLeft: 3 }}>*</span>}
        </span>
        <button type="button" className={styles.browseBtn} onClick={handleBrowse} disabled={picking}>
          {isFile
            ? <><FileText size={11} /> Browse…</>
            : <><FolderOpen size={11} /> Browse…</>}
        </button>
      </div>

      {suggestions.length === 0 ? (
        <div className={styles.empty}>
          No {isFile ? "executables" : "folders"} found automatically.
          {value && <span className={styles.manualVal}>{shortPath(value)}</span>}
        </div>
      ) : (
        <div className={styles.list}>
          {visible.map((s) => {
            const selected = multi ? selectedPaths.includes(s.path) : value === s.path;
            return (
              <button
                key={s.path}
                type="button"
                className={selected ? `${styles.item} ${styles.itemSelected}` : styles.item}
                onClick={() => onChange(multi ? s.path : selected ? "" : s.path)}
                title={s.path}
              >
                <div className={styles.check}>{selected && <Check size={10} strokeWidth={3} />}</div>
                <span className={styles.name}>{s.name}</span>
                <span className={styles.meta}>
                  {s.depth === 0 ? "root" : `depth ${s.depth}`}
                  {s.size_bytes > 0 && <> · {formatFileSize(s.size_bytes)}</>}
                </span>
              </button>
            );
          })}

          {/* If value was set manually (not in suggestions list) show it */}
          {value && !suggestions.some((s) => s.path === value) && (
            <button
              type="button"
              className={`${styles.item} ${styles.itemSelected}`}
              onClick={() => onChange("")}
              title={value}
            >
              <div className={styles.check}><Check size={10} strokeWidth={3} /></div>
              <span className={styles.name} style={{ fontStyle: "italic" }}>
                {value.split(/[/\\]/).pop() ?? value}
              </span>
              <span className={styles.meta}>manual</span>
            </button>
          )}

          {hasMore && (
            <button type="button" className={styles.expand} onClick={() => setExpanded((v) => !v)}>
              {expanded
                ? <><ChevronUp size={11} /> Show less</>
                : <><ChevronDown size={11} /> Show {suggestions.length - INITIAL_VISIBLE} more</>}
            </button>
          )}

          {onLoadMore && !noMore && (
            <button
              type="button"
              className={`${styles.expand} ${styles.loadDeeper}`}
              onClick={onLoadMore}
              disabled={loadingMore}
            >
              {loadingMore
                ? <><span className={styles.spinner} /> Scanning…</>
                : <><ChevronDown size={11} /> Search deeper</>}
            </button>
          )}
          {onLoadMore && noMore && (
            <span className={styles.noMore}>All layers scanned</span>
          )}
        </div>
      )}
    </div>
  );
}
