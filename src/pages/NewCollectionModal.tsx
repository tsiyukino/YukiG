/**
 * Modal for creating or editing a collection.
 *
 * Used for both "New Collection" (no initial values) and "Edit Collection"
 * (pre-populated from existing collection data).
 */
import { useState, FormEvent, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { NewCollection } from "@/types/collection";
import { strategyList, StrategyEntry } from "@/services/tauriCommands";

/** Preset color options for collection cards. */
const PRESET_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444", "#f97316",
  "#eab308", "#22c55e", "#14b8a6", "#3b82f6", "#64748b",
];

interface CollectionModalProps {
  /** Pre-populated values when editing an existing collection. */
  initial?: {
    name: string;
    description: string;
    color: string;
    default_strategy: string;
  };
  /** Label for the submit button. */
  submitLabel?: string;
  /** Called with the collection input when the user confirms. */
  onConfirm: (input: NewCollection) => Promise<void>;
  /** Called when the user cancels. */
  onCancel: () => void;
}

/**
 * Modal overlay for collection creation and editing.
 */
export default function CollectionModal({
  initial,
  submitLabel = "Create",
  onConfirm,
  onCancel,
}: CollectionModalProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [color, setColor] = useState(initial?.color ?? PRESET_COLORS[0]);
  const [defaultStrategy, setDefaultStrategy] = useState(initial?.default_strategy ?? "default");
  const [strategies, setStrategies] = useState<StrategyEntry[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Track whether the mousedown that started a click originated on the overlay itself.
  // This prevents closing the modal when the user drags text selection out of an input.
  const mouseDownOnOverlay = useRef(false);

  useEffect(() => {
    strategyList().then(setStrategies).catch(() => {});
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm({
        name: name.trim(),
        description: description.trim(),
        color,
        icon: "folder",
        default_strategy: defaultStrategy,
      });
    } catch (err) {
      setError(String(err));
      setSubmitting(false);
    }
  }

  return createPortal(
    <div
      className="modal-overlay"
      onMouseDown={(e) => { mouseDownOnOverlay.current = e.target === e.currentTarget; }}
      onMouseUp={(e) => { if (mouseDownOnOverlay.current && e.target === e.currentTarget) onCancel(); }}
    >
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <h2 className="modal-title">{initial ? "Edit Collection" : "New Collection"}</h2>
        <form onSubmit={handleSubmit} className="modal-form">
          <label className="modal-label">
            Name
            <input
              className="modal-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Games, Anime, Research"
              required
              autoFocus
              maxLength={100}
            />
          </label>
          <label className="modal-label">
            Description
            <input
              className="modal-input"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              maxLength={300}
            />
          </label>
          <label className="modal-label">
            Default Item Type
            <select
              className="modal-input"
              value={defaultStrategy}
              onChange={(e) => setDefaultStrategy(e.target.value)}
            >
              {strategies.map((s) => (
                <option key={s.strategy_type} value={s.strategy_type}>
                  {s.display_name}
                </option>
              ))}
            </select>
            <span className="modal-hint">
              Pre-selects this type when adding items. Can still be changed per item.
            </span>
          </label>
          <div className="modal-label">
            Color
            <div className="color-picker">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`color-swatch ${color === c ? "color-swatch--selected" : ""}`}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                  title={c}
                />
              ))}
            </div>
          </div>
          {error && <p className="modal-error">{error}</p>}
          <div className="modal-actions">
            <button type="button" className="modal-btn modal-btn--cancel" onClick={onCancel} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="modal-btn modal-btn--primary" disabled={submitting || !name.trim()}>
              {submitting ? "Saving…" : submitLabel}
            </button>
          </div>
        </form>
      </div>
      <style>{`
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          backdrop-filter: blur(2px);
        }
        .modal {
          background: var(--color-bg);
          border-radius: var(--radius-md);
          padding: var(--space-6);
          width: 420px;
          max-width: calc(100vw - 32px);
          box-shadow: 0 20px 60px rgba(0,0,0,0.15), 0 8px 24px rgba(0,0,0,0.08);
        }
        .modal-title {
          font-size: 16px;
          font-weight: 600;
          letter-spacing: -0.01em;
          margin-bottom: var(--space-5);
        }
        .modal-form {
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
        }
        .modal-label {
          display: flex;
          flex-direction: column;
          gap: var(--space-1);
          font-size: 12px;
          font-weight: 500;
          color: var(--color-text-secondary);
        }
        .modal-input {
          padding: 8px 12px;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          font-size: 13px;
          color: var(--color-text-primary);
          background: var(--color-bg);
          transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
          outline: none;
        }
        .modal-input:focus {
          border-color: var(--color-accent);
          box-shadow: 0 0 0 3px rgba(99,102,241,0.1);
        }
        .modal-hint {
          font-size: 11px;
          color: var(--color-text-muted);
          font-weight: 400;
        }
        .color-picker {
          display: flex;
          flex-wrap: wrap;
          gap: var(--space-2);
          margin-top: var(--space-1);
        }
        .color-swatch {
          width: 26px;
          height: 26px;
          border-radius: var(--radius-full);
          border: 2px solid transparent;
          transition: transform var(--transition-fast), border-color var(--transition-fast);
        }
        .color-swatch:hover { transform: scale(1.15); }
        .color-swatch--selected {
          border-color: var(--color-text-primary);
          transform: scale(1.15);
        }
        .modal-error { font-size: 12px; color: var(--color-danger); }
        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: var(--space-2);
          margin-top: var(--space-2);
        }
        .modal-btn {
          padding: 8px 16px;
          border-radius: var(--radius-sm);
          font-size: 13px;
          font-weight: 500;
          transition: background var(--transition-fast), opacity var(--transition-fast);
        }
        .modal-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .modal-btn--cancel {
          background: var(--color-bg-secondary);
          color: var(--color-text-secondary);
          border: 1px solid var(--color-border);
        }
        .modal-btn--cancel:hover:not(:disabled) { background: var(--color-bg-tertiary); }
        .modal-btn--primary { background: var(--color-accent); color: white; }
        .modal-btn--primary:hover:not(:disabled) { background: var(--color-accent-hover); }
      `}</style>
    </div>,
    document.body
  );
}
