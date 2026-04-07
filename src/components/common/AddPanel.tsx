/**
 * Slide-in panel for choosing what kind of item to add to a collection.
 *
 * Shows three options:
 * - Item: file/folder backed item (opens AddItemModal flow)
 * - Folder: virtual sub-category folder (navigable, no file system path needed)
 * - Group: inline group that shows all children expanded without needing to open
 *
 * Folder and Group are created as items with strategy_type "virtual_folder" / "virtual_group".
 */
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, FolderOpen, Layers, FileStack, ChevronRight, Check } from "lucide-react";
import { itemCreate } from "@/services/tauriCommands";

interface AddPanelProps {
  /** The collection this panel is adding into. */
  collectionId: string;
  /** Called when the user chooses to add a file/folder item — opens the full AddItemModal. */
  onAddItem: () => void;
  /** Called after a virtual folder or group is successfully created. */
  onCreated: (itemId: string) => void;
  /** Called when the panel is dismissed. */
  onClose: () => void;
}

type PanelView = "menu" | "virtual_folder" | "virtual_group";

/**
 * Animated slide-in panel anchored to the right side of the viewport.
 */
export default function AddPanel({ collectionId, onAddItem, onCreated, onClose }: AddPanelProps) {
  const [view, setView] = useState<PanelView>("menu");
  const [visible, setVisible] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Trigger entrance animation on mount
  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 220);
  }

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === overlayRef.current) handleClose();
  }

  return createPortal(
    <div
      className="ap-overlay"
      ref={overlayRef}
      onClick={handleOverlayClick}
    >
      <div className={`ap-panel ${visible ? "ap-panel--in" : ""}`}>
        <div className="ap-header">
          <div className="ap-header-text">
            <span className="ap-title">Add</span>
            <span className="ap-subtitle">
              {view === "menu" && "Choose what to add"}
              {view === "virtual_folder" && "New virtual folder"}
              {view === "virtual_group" && "New group"}
            </span>
          </div>
          <button className="ap-close" onClick={handleClose} title="Close">
            <X size={15} />
          </button>
        </div>

        <div className="ap-body">
          {view === "menu" && (
            <MenuView
              onItem={() => { handleClose(); setTimeout(onAddItem, 220); }}
              onFolder={() => setView("virtual_folder")}
              onGroup={() => setView("virtual_group")}
            />
          )}
          {view === "virtual_folder" && (
            <VirtualItemForm
              label="Folder"
              description="A virtual sub-category. Click into it to see its contents."
              placeholder="e.g. Action Games, 2024 Papers"
              strategyType="virtual_folder"
              collectionId={collectionId}
              onBack={() => setView("menu")}
              onCreated={onCreated}
            />
          )}
          {view === "virtual_group" && (
            <VirtualItemForm
              label="Group"
              description="Displays all contents inline — no need to open it to see everything."
              placeholder="e.g. Favorites, In Progress"
              strategyType="virtual_group"
              collectionId={collectionId}
              onBack={() => setView("menu")}
              onCreated={onCreated}
            />
          )}
        </div>
      </div>

      <style>{`
        .ap-overlay {
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.35);
          z-index: 100;
          backdrop-filter: blur(1px);
        }
        .ap-panel {
          position: absolute; top: 0; right: 0; bottom: 0;
          width: 300px;
          background: var(--color-bg);
          border-left: 1px solid var(--color-border);
          display: flex; flex-direction: column;
          box-shadow: -8px 0 32px rgba(0,0,0,0.12);
          transform: translateX(100%);
          transition: transform 220ms cubic-bezier(0.22, 1, 0.36, 1);
        }
        .ap-panel--in { transform: translateX(0); }
        .ap-header {
          display: flex; align-items: flex-start; justify-content: space-between;
          padding: var(--space-5) var(--space-4) var(--space-4);
          border-bottom: 1px solid var(--color-border-subtle);
          flex-shrink: 0;
        }
        .ap-header-text { display: flex; flex-direction: column; gap: 2px; }
        .ap-title { font-size: 16px; font-weight: 600; color: var(--color-text-primary); letter-spacing: -0.01em; }
        .ap-subtitle { font-size: 12px; color: var(--color-text-muted); }
        .ap-close {
          color: var(--color-text-muted); padding: 6px;
          border-radius: var(--radius-sm);
          transition: color var(--transition-fast), background var(--transition-fast);
          margin-top: -2px; flex-shrink: 0;
        }
        .ap-close:hover { color: var(--color-text-primary); background: var(--color-bg-secondary); }
        .ap-body { flex: 1; overflow-y: auto; padding: var(--space-4); display: flex; flex-direction: column; gap: var(--space-3); }
      `}</style>
    </div>,
    document.body
  );
}

// ─── Menu view ────────────────────────────────────────────────────────────────

interface MenuViewProps {
  onItem: () => void;
  onFolder: () => void;
  onGroup: () => void;
}

function MenuView({ onItem, onFolder, onGroup }: MenuViewProps) {
  const options = [
    {
      icon: <FileStack size={18} color="var(--color-text-muted)" />,
      label: "Item",
      desc: "Add a file or folder as a tracked item",
      onClick: onItem,
      chevron: true,
    },
    {
      icon: <FolderOpen size={18} color="var(--color-text-muted)" />,
      label: "Folder",
      desc: "Virtual sub-category — click in to browse contents",
      onClick: onFolder,
      chevron: false,
    },
    {
      icon: <Layers size={18} color="var(--color-text-muted)" />,
      label: "Group",
      desc: "Inline group — shows all contents without opening",
      onClick: onGroup,
      chevron: false,
    },
  ];

  return (
    <>
      {options.map((opt) => (
        <button key={opt.label} className="mv-option" onClick={opt.onClick}>
          <div className="mv-option-icon">{opt.icon}</div>
          <div className="mv-option-text">
            <span className="mv-option-label">{opt.label}</span>
            <span className="mv-option-desc">{opt.desc}</span>
          </div>
          <ChevronRight size={14} color="var(--color-text-muted)" className="mv-chevron" />
        </button>
      ))}
      <style>{`
        .mv-option {
          display: flex; align-items: center; gap: var(--space-3);
          padding: var(--space-3) var(--space-3);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          background: var(--color-bg);
          cursor: pointer; text-align: left; width: 100%;
          transition: background var(--transition-fast), border-color var(--transition-fast);
        }
        .mv-option:hover { background: var(--color-bg-secondary); border-color: var(--color-accent); }
        .mv-option:hover .mv-option-icon svg { color: var(--color-accent) !important; }
        .mv-option-icon {
          width: 36px; height: 36px; border-radius: var(--radius-sm);
          background: var(--color-bg-secondary);
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
          transition: background var(--transition-fast);
        }
        .mv-option:hover .mv-option-icon { background: var(--color-accent-light); }
        .mv-option-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
        .mv-option-label { font-size: 13px; font-weight: 600; color: var(--color-text-primary); }
        .mv-option-desc { font-size: 11.5px; color: var(--color-text-muted); line-height: 1.4; }
        .mv-chevron { flex-shrink: 0; opacity: 0.4; }
      `}</style>
    </>
  );
}

// ─── VirtualItemForm ──────────────────────────────────────────────────────────

interface VirtualItemFormProps {
  label: string;
  description: string;
  placeholder: string;
  strategyType: "virtual_folder" | "virtual_group";
  collectionId: string;
  onBack: () => void;
  onCreated: (itemId: string) => void;
}

/**
 * Shared inline form for creating a virtual folder or group.
 * Just needs a name — no file path required.
 */
function VirtualItemForm({
  label, description, placeholder, strategyType, collectionId, onBack, onCreated,
}: VirtualItemFormProps) {
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  async function handleCreate() {
    if (!name.trim()) { setError("Name is required."); return; }
    setError(null);
    setSubmitting(true);
    try {
      // Virtual items use an empty string for folder_path — no real path needed.
      const item = await itemCreate(collectionId, name.trim(), "", strategyType, "");
      onCreated(item.id);
    } catch (e) {
      setError(String(e));
      setSubmitting(false);
    }
  }

  return (
    <div className="vf-root">
      <p className="vf-desc">{description}</p>
      <div className="vf-field">
        <label className="vf-label">Name</label>
        <input
          ref={inputRef}
          className="vf-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={placeholder}
          onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") onBack(); }}
        />
      </div>
      {error && <p className="vf-error">{error}</p>}
      <div className="vf-actions">
        <button className="vf-back" onClick={onBack} disabled={submitting}>Back</button>
        <button className="vf-create" onClick={handleCreate} disabled={submitting || !name.trim()}>
          <Check size={13} />
          {submitting ? "Creating…" : `Create ${label}`}
        </button>
      </div>
      <style>{`
        .vf-root { display: flex; flex-direction: column; gap: var(--space-3); }
        .vf-desc { font-size: 12.5px; color: var(--color-text-secondary); line-height: 1.5; }
        .vf-field { display: flex; flex-direction: column; gap: var(--space-1); }
        .vf-label { font-size: 12px; font-weight: 500; color: var(--color-text-secondary); }
        .vf-input {
          width: 100%; padding: 8px 12px;
          border: 1px solid var(--color-border); border-radius: var(--radius-sm);
          font-size: 13px; background: var(--color-bg); color: var(--color-text-primary);
          outline: none; transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
        }
        .vf-input:focus { border-color: var(--color-accent); box-shadow: 0 0 0 3px rgba(99,102,241,0.1); }
        .vf-input::placeholder { color: var(--color-text-muted); }
        .vf-error { font-size: 12px; color: var(--color-danger); }
        .vf-actions { display: flex; gap: var(--space-2); justify-content: flex-end; padding-top: var(--space-1); }
        .vf-back {
          padding: 7px 12px; border-radius: var(--radius-sm);
          font-size: 13px; color: var(--color-text-secondary);
          transition: background var(--transition-fast), color var(--transition-fast);
        }
        .vf-back:hover:not(:disabled) { background: var(--color-bg-secondary); color: var(--color-text-primary); }
        .vf-create {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 7px 14px; border-radius: var(--radius-sm);
          background: var(--color-accent); color: white;
          font-size: 13px; font-weight: 500;
          transition: background var(--transition-fast), opacity var(--transition-fast);
        }
        .vf-create:hover:not(:disabled) { background: var(--color-accent-hover); }
        .vf-create:disabled { opacity: 0.5; cursor: not-allowed; }
        .vf-back:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>
    </div>
  );
}
