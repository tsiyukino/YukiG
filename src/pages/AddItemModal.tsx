/**
 * Multi-step modal for adding a new item to a collection.
 *
 * The modal has two modes in one unified container:
 * - "item" mode: pick a file/folder, name it, choose a strategy (multi-step)
 * - "groups" mode: create a virtual folder or group (organisational items)
 *
 * A thin tab strip on the right edge of the modal lets the user switch between
 * the two modes. The content slides horizontally on transition.
 */
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import {
  FolderOpen, FileText, X, ChevronRight, ChevronLeft,
  Plus, Check, Layers, FolderClosed,
} from "lucide-react";
import {
  itemCreate,
  strategyList,
  strategyGetMetadataSchema,
  strategyUpsertMetadata,
  collectionGetAll,
  gameSuggestPaths,
  GameSuggestions,
  StrategyEntry,
} from "@/services/tauriCommands";
import { MetadataField } from "@/types/strategy";
import SmartSuggestPicker from "@/components/common/SmartSuggestPicker";

interface AddItemModalProps {
  collectionId: string;
  defaultStrategy?: string;
  /** If set, new items are created as children of this parent (virtual_folder or virtual_group). */
  parentId?: string | null;
  /**
   * Pre-filled path (e.g. from a drag-and-drop). When provided the modal skips
   * the "pick" step and opens directly on the "details" step.
   */
  initialPath?: string;
  onSuccess: (itemId: string, strategyType: string) => void;
  onClose: () => void;
}

type Step = "pick" | "details" | "metadata";
type PickMode = "folder" | "file";
type ModalMode = "item" | "groups";
type GroupsView = "menu" | "virtual_folder" | "virtual_group";

export default function AddItemModal({
  collectionId: collectionIdProp,
  defaultStrategy = "",
  parentId = null,
  initialPath,
  onSuccess,
  onClose,
}: AddItemModalProps) {
  const [mode, setMode] = useState<ModalMode>("item");
  const [groupsView, setGroupsView] = useState<GroupsView>("menu");
  const [step, setStep] = useState<Step>(() => (initialPath ? "details" : "pick"));
  const [pickMode, setPickMode] = useState<PickMode>("folder");
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
  const mouseDownOnOverlay = useRef(false);

  /** Derives display name, pick mode, and strategy from a file/folder path. */
  function derivedFromPath(path: string): { name: string; mode: PickMode; strategy: string } {
    const parts = path.replace(/\\/g, "/").split("/");
    const rawName = parts[parts.length - 1] || path;
    const hasExtension = /\.[^./]+$/.test(rawName);
    if (hasExtension) {
      return { name: rawName.replace(/\.[^.]+$/, ""), mode: "file", strategy: "file" };
    }
    return { name: rawName, mode: "folder", strategy: defaultStrategy };
  }

  const [name, setName] = useState<string>(() => {
    if (initialPath) return derivedFromPath(initialPath).name;
    return "";
  });
  const [strategyType, setStrategyType] = useState<string>(() => {
    if (initialPath) return derivedFromPath(initialPath).strategy;
    return defaultStrategy;
  });

  // Sync pickMode from initialPath on first render.
  useEffect(() => {
    if (initialPath) {
      setPickMode(derivedFromPath(initialPath).mode);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  async function handleLoadMoreSuggestions() {
    if (!folderPath || suggestLoadingMore || suggestMaxDepth) return;
    const nextDepth = suggestDepth + 1;
    if (nextDepth > 4) { setSuggestMaxDepth(true); return; }
    setSuggestLoadingMore(true);
    try {
      const more = await gameSuggestPaths(folderPath, nextDepth);
      setSuggestDepth(nextDepth);
      if (nextDepth >= 4) setSuggestMaxDepth(true);
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

  async function handlePick(m: PickMode) {
    setError(null);
    try {
      const selected = await openDialog({ directory: m === "folder", multiple: false });
      if (typeof selected === "string" && selected) {
        setPickMode(m);
        setFolderPath(selected);
        const parts = selected.replace(/\\/g, "/").split("/");
        const rawName = parts[parts.length - 1] || selected;
        // For files, strip the extension from the display name and auto-set strategy.
        const displayName = m === "file"
          ? rawName.replace(/\.[^.]+$/, "")
          : rawName;
        setName(displayName);
        if (m === "file") {
          setStrategyType("file");
        }
        setStep("details");
      }
    } catch (e) { setError(String(e)); }
  }

  function handleDetailsNext() {
    if (!collectionId) { setError("Select a collection."); return; }
    if (!name.trim()) { setError("Name is required."); return; }
    // File pickMode auto-sets strategyType to "file" — no dropdown shown.
    if (pickMode !== "file" && !strategyType) { setError("Select a type."); return; }
    setError(null);
    if (schema.length > 0) setStep("metadata");
    else handleSubmit();
  }

  async function handleSubmit() {
    setError(null);
    for (const field of schema) {
      if (field.required && !metaValues[field.key]?.trim()) {
        setError(`"${field.label}" is required.`);
        return;
      }
    }
    setSubmitting(true);
    try {
      const item = await itemCreate(
        collectionId,
        name.trim(),
        folderPath,
        strategyType,
        "",
        parentId,
      );
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

  function switchMode(next: ModalMode) {
    setError(null);
    setMode(next);
    if (next === "item") setGroupsView("menu");
  }

  const steps: { key: Step; label: string }[] = [
    { key: "pick", label: pickMode === "file" && folderPath ? "File" : "Folder" },
    { key: "details", label: "Details" },
    ...(schema.length > 0 ? [{ key: "metadata" as Step, label: "Config" }] : []),
  ];
  const currentStepIndex = steps.findIndex((s) => s.key === step);

  return createPortal(
    <div
      className="aim-overlay"
      onMouseDown={(e) => { mouseDownOnOverlay.current = e.target === e.currentTarget; }}
      onMouseUp={(e) => { if (mouseDownOnOverlay.current && e.target === e.currentTarget) onClose(); }}
    >
      <div className="aim-shell" onMouseDown={(e) => e.stopPropagation()}>

        {/* ── Mode tab bar (top) ── */}
        <div className="aim-tab-bar">
          <button className={`aim-tab${mode === "item" ? " aim-tab--active" : ""}`} onClick={() => switchMode("item")}>
            Add Item
          </button>
          <button className={`aim-tab${mode === "groups" ? " aim-tab--active" : ""}`} onClick={() => switchMode("groups")}>
            Organise
          </button>
          <div className="aim-tab-bar-close">
            <button className="aim-close" onClick={onClose}><X size={14} /></button>
          </div>
        </div>

        {/* ── Main content area (slides) ── */}
        <div className={`aim-panels ${mode === "groups" ? "aim-panels--groups" : ""}`}>

          {/* Item panel */}
          <div className="aim-panel aim-panel--item">
            {/* Header */}
            <div className="aim-header">
              <div className="aim-title">Add Item</div>
              <div className="aim-subtitle">
                {step === "pick" && "Choose a folder or file"}
                {step === "details" && "Name and type"}
                {step === "metadata" && "Configure settings"}
              </div>
            </div>

            {/* Step bar */}
            <div className="aim-stepbar">
              {steps.map((s, i) => {
                const done = i < currentStepIndex;
                const active = i === currentStepIndex;
                return (
                  <div key={s.key} className="aim-stepbar-item">
                    <div className={`aim-step-dot${active ? " active" : ""}${done ? " done" : ""}`}>
                      {done ? <Check size={9} strokeWidth={3} /> : i + 1}
                    </div>
                    <span className={`aim-step-lbl${active ? " active" : ""}`}>{s.label}</span>
                    {i < steps.length - 1 && <div className={`aim-step-line${done ? " done" : ""}`} />}
                  </div>
                );
              })}
            </div>

            {/* Body */}
            <div className="aim-body">
              {step === "pick" && <PickStep folderPath={folderPath} pickMode={pickMode} onPick={handlePick} />}
              {step === "details" && (
                <DetailsStep folderPath={folderPath} pickMode={pickMode} name={name}
                  onNameChange={setName} strategyType={strategyType}
                  onStrategyChange={setStrategyType} strategies={strategies}
                  collectionId={collectionId} onCollectionChange={setCollectionId} />
              )}
              {step === "metadata" && (
                <MetadataStep schema={schema} values={metaValues}
                  onChange={(k, v) => setMetaValues((p) => ({ ...p, [k]: v }))}
                  basePath={folderPath} gameSuggestions={gameSuggestions ?? undefined}
                  onLoadMoreSuggestions={handleLoadMoreSuggestions}
                  loadingMoreSuggestions={suggestLoadingMore}
                  noMoreSuggestions={suggestMaxDepth} />
              )}
            </div>

            {error && mode === "item" && <div className="aim-error"><span>{error}</span></div>}

            {/* Footer */}
            <div className="aim-footer">
              {step !== "pick"
                ? <button className="aim-btn-ghost" onClick={() => {
                    setError(null);
                    if (step === "metadata") setStep("details");
                    else setStep("pick");
                  }} disabled={submitting}>
                    <ChevronLeft size={13} />Back
                  </button>
                : <span />
              }
              <div style={{ display: "flex", gap: 8 }}>
                {step === "pick" && folderPath && (
                  <button className="aim-btn-primary" onClick={() => setStep("details")}>
                    Continue <ChevronRight size={13} />
                  </button>
                )}
                {step === "details" && (
                  <button className="aim-btn-primary" onClick={handleDetailsNext} disabled={submitting}>
                    {schema.length > 0
                      ? <>Continue <ChevronRight size={13} /></>
                      : <><Plus size={13} /> Add Item</>}
                  </button>
                )}
                {step === "metadata" && (
                  <button className="aim-btn-primary" onClick={handleSubmit} disabled={submitting}>
                    <Plus size={13} /> {submitting ? "Adding…" : "Add Item"}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Groups panel */}
          <div className="aim-panel aim-panel--groups">
            <div className="aim-header">
              <div className="aim-title">
                {groupsView === "menu" ? "Organise" : groupsView === "virtual_folder" ? "New Folder" : "New Group"}
              </div>
              <div className="aim-subtitle">
                {groupsView === "menu" ? "Create a structural item" : groupsView === "virtual_folder" ? "Virtual sub-category" : "Inline expandable group"}
              </div>
            </div>

            <div className="aim-body">
              {groupsView === "menu" && (
                <GroupsMenu
                  onFolder={() => setGroupsView("virtual_folder")}
                  onGroup={() => setGroupsView("virtual_group")}
                />
              )}
              {(groupsView === "virtual_folder" || groupsView === "virtual_group") && (
                <VirtualForm
                  key={groupsView}
                  label={groupsView === "virtual_folder" ? "Folder" : "Group"}
                  placeholder={groupsView === "virtual_folder" ? "e.g. Action Games, 2024 Papers" : "e.g. Favorites, In Progress"}
                  strategyType={groupsView}
                  collectionId={collectionId}
                  parentId={parentId}
                  onBack={() => { setGroupsView("menu"); setError(null); }}
                  onCreated={onSuccess}
                  submitting={submitting}
                  setSubmitting={setSubmitting}
                  setError={setError}
                />
              )}
            </div>

            {error && mode === "groups" && groupsView !== "menu" && (
              <div className="aim-error"><span>{error}</span></div>
            )}

            {groupsView === "menu" && (
              <div className="aim-footer">
                <span />
                <span />
              </div>
            )}
          </div>
        </div>


      </div>

      <style>{`
        /* ── Overlay ── */
        .aim-overlay {
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.4);
          display: flex; align-items: center; justify-content: center;
          z-index: 100;
          backdrop-filter: blur(3px);
        }

        /* ── Shell: single column ── */
        .aim-shell {
          display: flex;
          flex-direction: column;
          width: 440px;
          max-width: calc(100vw - 32px);
          border-radius: var(--radius-lg);
          box-shadow: 0 24px 64px rgba(0,0,0,0.18), 0 8px 24px rgba(0,0,0,0.1);
          overflow: hidden;
          background: var(--color-bg);
          border: 1px solid var(--color-border);
        }

        /* ── Top tab bar ── */
        .aim-tab-bar {
          display: flex;
          align-items: center;
          padding: 10px 12px 0;
          gap: 2px;
          background: var(--color-bg-secondary);
          border-bottom: 1px solid var(--color-border);
          flex-shrink: 0;
        }
        .aim-tab {
          padding: 6px 14px;
          border-radius: var(--radius-sm) var(--radius-sm) 0 0;
          font-size: 12.5px;
          font-weight: 500;
          color: var(--color-text-muted);
          cursor: pointer;
          transition: color var(--transition-fast), background var(--transition-fast);
          border: 1px solid transparent;
          border-bottom: none;
          position: relative;
          bottom: -1px;
        }
        .aim-tab:hover { color: var(--color-text-primary); background: var(--color-bg-tertiary); }
        .aim-tab--active {
          background: var(--color-bg);
          color: var(--color-text-primary);
          border-color: var(--color-border);
          font-weight: 600;
        }
        .aim-tab-bar-close {
          margin-left: auto;
          padding-bottom: 1px;
        }
        .aim-close {
          width: 26px; height: 26px; border-radius: var(--radius-sm);
          display: flex; align-items: center; justify-content: center;
          color: var(--color-text-muted);
          transition: color var(--transition-fast), background var(--transition-fast);
        }
        .aim-close:hover { color: var(--color-text-primary); background: var(--color-bg-tertiary); }

        /* ── Sliding panels wrapper ── */
        .aim-panels {
          width: 440px;
          display: flex;
          flex-shrink: 0;
          transition: transform 240ms cubic-bezier(0.4, 0, 0.2, 1);
        }
        .aim-panel {
          min-width: 440px;
          background: var(--color-bg);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .aim-panels--groups { transform: translateX(-440px); }

        /* ── Header (inside each panel) ── */
        .aim-header {
          padding: 18px 20px 0;
          flex-shrink: 0;
        }
        .aim-title { font-size: 15px; font-weight: 650; color: var(--color-text-primary); letter-spacing: -0.02em; }
        .aim-subtitle { font-size: 12px; color: var(--color-text-muted); margin-top: 2px; }

        /* ── Step bar ── */
        .aim-stepbar {
          display: flex; align-items: center;
          padding: 16px 20px 0;
          flex-shrink: 0;
        }
        .aim-stepbar-item { display: flex; align-items: center; gap: 6px; }
        .aim-step-dot {
          width: 20px; height: 20px; border-radius: 50%;
          background: var(--color-bg-tertiary); border: 1.5px solid var(--color-border);
          display: flex; align-items: center; justify-content: center;
          font-size: 9px; font-weight: 700; color: var(--color-text-muted);
          flex-shrink: 0; transition: all 200ms;
        }
        .aim-step-dot.active, .aim-step-dot.done {
          background: var(--color-accent); border-color: var(--color-accent); color: #fff;
        }
        .aim-step-lbl { font-size: 11px; font-weight: 500; color: var(--color-text-muted); white-space: nowrap; }
        .aim-step-lbl.active { color: var(--color-accent); }
        .aim-step-line {
          height: 1.5px; background: var(--color-border); margin: 0 8px; min-width: 24px; flex: 1;
          transition: background 200ms;
        }
        .aim-step-line.done { background: var(--color-accent); }

        /* ── Body ── */
        .aim-body {
          flex: 1; padding: 16px 20px;
          display: flex; flex-direction: column; gap: 12px;
          border-top: 1px solid var(--color-border-subtle);
          border-bottom: 1px solid var(--color-border-subtle);
          margin-top: 14px;
          min-height: 180px; overflow-y: auto;
        }

        /* ── Error ── */
        .aim-error {
          padding: 8px 20px; font-size: 12px;
          color: var(--color-danger); background: var(--color-danger-light);
          border-top: 1px solid #fecaca; flex-shrink: 0;
        }

        /* ── Footer ── */
        .aim-footer {
          display: flex; align-items: center; justify-content: space-between;
          padding: 12px 20px; flex-shrink: 0;
        }
        .aim-btn-primary {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 7px 14px; border-radius: var(--radius-sm);
          background: var(--color-accent); color: #fff;
          font-size: 13px; font-weight: 500;
          transition: background var(--transition-fast), opacity var(--transition-fast);
        }
        .aim-btn-primary:hover:not(:disabled) { background: var(--color-accent-hover); }
        .aim-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
        .aim-btn-ghost {
          display: inline-flex; align-items: center; gap: 4px;
          padding: 7px 10px; border-radius: var(--radius-sm);
          color: var(--color-text-secondary); font-size: 13px;
          transition: background var(--transition-fast), color var(--transition-fast);
        }
        .aim-btn-ghost:hover:not(:disabled) { background: var(--color-bg-secondary); color: var(--color-text-primary); }
        .aim-btn-ghost:disabled { opacity: 0.5; cursor: not-allowed; }

        /* ── Shared form elements ── */
        .aim-field { display: flex; flex-direction: column; gap: 5px; }
        .aim-label { font-size: 12px; font-weight: 500; color: var(--color-text-secondary); }
        .aim-input {
          width: 100%; padding: 8px 10px;
          border: 1px solid var(--color-border); border-radius: var(--radius-sm);
          font-size: 13px; background: var(--color-bg); color: var(--color-text-primary);
          outline: none; transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
        }
        .aim-input:focus { border-color: var(--color-accent); box-shadow: 0 0 0 3px rgba(99,102,241,0.1); }
        .aim-input::placeholder { color: var(--color-text-muted); }
        .aim-hint { font-size: 11px; color: var(--color-text-muted); }
        .aim-path-picker {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 12px;
          border: 1.5px dashed var(--color-border); border-radius: var(--radius-md);
          background: var(--color-bg-secondary); cursor: pointer;
          transition: all var(--transition-fast); width: 100%; text-align: left;
        }
        .aim-path-picker:hover:not(:disabled) { border-color: var(--color-accent); background: var(--color-accent-light); }
        .aim-path-picker--selected { border-style: solid; border-color: var(--color-accent); background: var(--color-accent-light); }
        .aim-path-picker:disabled { opacity: 0.6; cursor: not-allowed; }
        .aim-path-picker-icon {
          width: 30px; height: 30px; border-radius: var(--radius-sm);
          background: var(--color-bg-tertiary);
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
          transition: background var(--transition-fast);
        }
        .aim-path-picker-icon--selected { background: var(--color-accent); }
        .aim-path-picker-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
        .aim-path-picker-label { font-size: 12.5px; font-weight: 500; color: var(--color-text-secondary); }
        .aim-path-picker--selected .aim-path-picker-label { color: var(--color-accent); }
        .aim-path-picker-path { font-size: 10.5px; font-family: var(--font-mono); color: var(--color-text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

      `}</style>
    </div>,
    document.body
  );
}

// ─── PickStep ─────────────────────────────────────────────────────────────────

function PickStep({ folderPath, pickMode, onPick }: {
  folderPath: string;
  pickMode: PickMode;
  onPick: (mode: PickMode) => void;
}) {
  const selFolder = folderPath && pickMode === "folder";
  const selFile = folderPath && pickMode === "file";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <p style={{ fontSize: 12.5, color: "var(--color-text-secondary)", lineHeight: 1.5, marginBottom: 2 }}>
        Choose what you want to add to this collection.
      </p>
      {(["folder", "file"] as PickMode[]).map((m) => {
        const active = m === "folder" ? selFolder : selFile;
        return (
          <button key={m} className={`aim-path-picker${active ? " aim-path-picker--selected" : ""}`} onClick={() => onPick(m)}>
            <div className={`aim-path-picker-icon${active ? " aim-path-picker-icon--selected" : ""}`}>
              {m === "folder"
                ? <FolderOpen size={16} color={active ? "#fff" : "var(--color-text-muted)"} />
                : <FileText size={16} color={active ? "#fff" : "var(--color-text-muted)"} />
              }
            </div>
            <div className="aim-path-picker-text">
              <span className="aim-path-picker-label">
                {active ? (m === "folder" ? "Folder selected" : "File selected") : (m === "folder" ? "Add Folder" : "Add File")}
              </span>
              <span className="aim-path-picker-path">
                {active ? folderPath : (m === "folder" ? "Browse for a folder" : "Browse for a single file")}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ─── DetailsStep ──────────────────────────────────────────────────────────────

function DetailsStep({ folderPath, pickMode, name, onNameChange, strategyType, onStrategyChange, strategies,
  collectionId, onCollectionChange }: {
  folderPath: string; pickMode: PickMode; name: string; onNameChange: (v: string) => void;
  strategyType: string; onStrategyChange: (v: string) => void; strategies: StrategyEntry[];
  /** Empty string = not yet in a collection context; show a selector. */
  collectionId: string; onCollectionChange: (id: string) => void;
}) {
  const [collections, setCollections] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (collectionId) return; // already have a collection, no need to load
    collectionGetAll().then((cols) => setCollections(cols)).catch(() => {});
  }, [collectionId]);

  return (
    <>
      {!collectionId && (
        <div className="aim-field">
          <label className="aim-label" htmlFor="aim-collection">Add to collection</label>
          <select id="aim-collection" className="aim-input"
            value=""
            onChange={(e) => onCollectionChange(e.target.value)}>
            <option value="" disabled>Select a collection…</option>
            {collections.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      )}
      <div className="aim-field">
        <span className="aim-label">{pickMode === "file" ? "Selected file" : "Selected folder"}</span>
        <div style={{
          fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--color-text-muted)",
          wordBreak: "break-all", padding: "6px 10px",
          background: "var(--color-bg-secondary)", borderRadius: "var(--radius-sm)",
          border: "1px solid var(--color-border-subtle)", lineHeight: 1.5,
        }}>{folderPath}</div>
      </div>
      <div className="aim-field">
        <label className="aim-label" htmlFor="aim-name">Display name</label>
        <input id="aim-name" className="aim-input" value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="e.g. My Game, Chemistry Notes" autoFocus />
      </div>
      {pickMode !== "file" && (
        <div className="aim-field">
          <label className="aim-label" htmlFor="aim-strategy">Type</label>
          <StrategySelect
            id="aim-strategy"
            value={strategyType}
            onChange={onStrategyChange}
            strategies={strategies}
            pickMode={pickMode}
          />
        </div>
      )}
      {pickMode === "file" && (
        <p className="aim-hint">Single file — strategy is set automatically.</p>
      )}
    </>
  );
}

// ─── MetadataStep ─────────────────────────────────────────────────────────────

function MetadataStep({ schema, values, onChange, basePath, gameSuggestions,
  onLoadMoreSuggestions, loadingMoreSuggestions, noMoreSuggestions }: {
  schema: MetadataField[]; values: Record<string, string>; onChange: (k: string, v: string) => void;
  basePath?: string;
  gameSuggestions?: GameSuggestions;
  /** Called when the user wants to scan one depth layer deeper. */
  onLoadMoreSuggestions?: () => void;
  loadingMoreSuggestions?: boolean;
  noMoreSuggestions?: boolean;
}) {
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
          <div key={field.key} className="aim-field">
            <label className="aim-label">
              {field.label}
              {field.required && <span style={{ color: "var(--color-danger)", marginLeft: 3 }}>*</span>}
            </label>
            {isPath ? (
              <button type="button"
                className={`aim-path-picker${val ? " aim-path-picker--selected" : ""}`}
                onClick={() => handlePick(field)} disabled={picking === field.key}>
                <div className={`aim-path-picker-icon${val ? " aim-path-picker-icon--selected" : ""}`}>
                  {field.field_type === "file_path"
                    ? <FileIcon size={15} color={val ? "#fff" : "var(--color-text-muted)"} />
                    : <FolderOpen size={15} color={val ? "#fff" : "var(--color-text-muted)"} />}
                </div>
                <div className="aim-path-picker-text">
                  <span className="aim-path-picker-label">
                    {val ? (field.field_type === "file_path" ? "File selected" : "Folder selected")
                         : (field.field_type === "file_path" ? "Click to select a file" : "Click to select a folder")}
                  </span>
                  {val && <span className="aim-path-picker-path">{val}</span>}
                </div>
              </button>
            ) : (
              <input className="aim-input" value={val}
                onChange={(e) => onChange(field.key, e.target.value)} placeholder="Enter value" />
            )}
            {!field.required && <span className="aim-hint">Optional</span>}
          </div>
        );
      })}
    </>
  );
}

// ─── GroupsMenu ───────────────────────────────────────────────────────────────

function GroupsMenu({ onFolder, onGroup }: { onFolder: () => void; onGroup: () => void }) {
  const opts = [
    {
      icon: <FolderClosed size={17} />,
      label: "Folder",
      desc: "Virtual sub-category. Click in to browse contents.",
      color: "#f97316",
      onClick: onFolder,
    },
    {
      icon: <Layers size={17} />,
      label: "Group",
      desc: "Shows all contents inline — no need to open.",
      color: "#8b5cf6",
      onClick: onGroup,
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <p style={{ fontSize: 12.5, color: "var(--color-text-secondary)", lineHeight: 1.5, marginBottom: 2 }}>
        Structural items to organise your collection.
      </p>
      {opts.map((o) => (
        <button key={o.label} className="gm-card" onClick={o.onClick}
          style={{ "--gm-color": o.color } as React.CSSProperties}>
          <div className="gm-icon" style={{ background: `color-mix(in srgb, ${o.color} 15%, var(--color-bg-secondary))`, color: o.color }}>{o.icon}</div>
          <div className="gm-text">
            <span className="gm-label">{o.label}</span>
            <span className="gm-desc">{o.desc}</span>
          </div>
          <ChevronRight size={13} style={{ color: "var(--color-text-muted)", flexShrink: 0, opacity: 0.5 }} />
        </button>
      ))}
      <style>{`
        .gm-card {
          display: flex; align-items: center; gap: 12px;
          padding: 12px; width: 100%; text-align: left;
          border: 1px solid var(--color-border); border-radius: var(--radius-md);
          background: var(--color-bg); cursor: pointer;
          transition: border-color var(--transition-fast), background var(--transition-fast), box-shadow var(--transition-fast);
        }
        .gm-card:hover {
          border-color: var(--gm-color);
          background: color-mix(in srgb, var(--gm-color) 10%, var(--color-bg));
          box-shadow: 0 2px 8px rgba(0,0,0,0.06);
        }
        .gm-icon {
          width: 36px; height: 36px; border-radius: var(--radius-sm);
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .gm-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
        .gm-label { font-size: 13px; font-weight: 600; color: var(--color-text-primary); }
        .gm-desc { font-size: 11.5px; color: var(--color-text-muted); line-height: 1.4; }
      `}</style>
    </div>
  );
}

// ─── VirtualForm ──────────────────────────────────────────────────────────────

function VirtualForm({ label, placeholder, strategyType, collectionId, parentId, onBack, onCreated, submitting, setSubmitting, setError }: {
  label: string; placeholder: string; strategyType: "virtual_folder" | "virtual_group";
  collectionId: string; parentId?: string | null; onBack: () => void; onCreated: (id: string, strategyType: string) => void;
  submitting: boolean; setSubmitting: (v: boolean) => void; setError: (v: string | null) => void;
}) {
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  async function handleCreate() {
    if (!name.trim()) { setError("Name is required."); return; }
    setError(null);
    setSubmitting(true);
    try {
      const item = await itemCreate(collectionId, name.trim(), "", strategyType, "", parentId);
      onCreated(item.id, strategyType);
    } catch (e) {
      setError(String(e));
      setSubmitting(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="aim-field">
        <label className="aim-label" htmlFor="vf-name">Name</label>
        <input id="vf-name" ref={inputRef} className="aim-input" value={name}
          onChange={(e) => setName(e.target.value)} placeholder={placeholder}
          onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") onBack(); }} />
      </div>
      <div className="aim-footer" style={{ padding: 0, marginTop: 4 }}>
        <button className="aim-btn-ghost" onClick={onBack} disabled={submitting}>
          <ChevronLeft size={13} /> Back
        </button>
        <button className="aim-btn-primary" onClick={handleCreate} disabled={submitting || !name.trim()}>
          <Plus size={13} /> {submitting ? "Creating…" : `Create ${label}`}
        </button>
      </div>
    </div>
  );
}

// ─── StrategySelect ───────────────────────────────────────────────────────────

/** Allowed strategy types for folder pickMode. */
const FOLDER_STRATEGY_TYPES = ["game"];

/**
 * Flat strategy type picker.
 *
 * When `pickMode` is `"folder"`, only the folder-compatible strategies are shown
 * (game, code, document, folder). File pickMode never shows this component.
 */
function StrategySelect({ id, value, onChange, strategies, pickMode }: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  strategies: StrategyEntry[];
  pickMode: PickMode;
}) {
  const filtered = pickMode === "folder"
    ? strategies.filter((s) => FOLDER_STRATEGY_TYPES.includes(s.strategy_type))
    : strategies.filter((s) => !s.group);

  return (
    <select id={id} className="aim-input" value={value}
      onChange={(e) => onChange(e.target.value)} style={{ cursor: "pointer" }}>
      <option value="">Select a type…</option>
      {filtered.map((s) => (
        <option key={s.strategy_type} value={s.strategy_type}>{s.display_name}</option>
      ))}
    </select>
  );
}

function FileIcon({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}
