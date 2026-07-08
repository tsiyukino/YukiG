/**
 * Modal for creating or editing a collection.
 *
 * Used for both "New Collection" (no initial values) and "Edit Collection"
 * (pre-populated from existing collection data).
 */
import { useState, FormEvent, useEffect } from "react";
import { NewCollection } from "@/types/collection";
import { strategyList, StrategyEntry } from "@/services/tauriCommands";
import { COLLECTION_COLORS } from "@/utils/colorPalettes";
import Modal from "@/components/common/Modal";
import form from "@/styles/form.module.css";
import styles from "./NewCollectionModal.module.css";

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
  const [color, setColor] = useState(initial?.color ?? COLLECTION_COLORS[0]);
  const [defaultStrategy, setDefaultStrategy] = useState(initial?.default_strategy ?? "default");
  const [strategies, setStrategies] = useState<StrategyEntry[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <Modal title={initial ? "Edit Collection" : "New Collection"} onClose={onCancel}>
      <form onSubmit={handleSubmit} className={form.form}>
        <label className={form.label}>
          Name
          <input
            className={form.input}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Games, Anime, Research"
            required
            autoFocus
            maxLength={100}
          />
        </label>
        <label className={form.label}>
          Description
          <input
            className={form.input}
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description"
            maxLength={300}
          />
        </label>
        <label className={form.label}>
          Default Item Type
          <select
            className={form.input}
            value={defaultStrategy}
            onChange={(e) => setDefaultStrategy(e.target.value)}
          >
            {strategies.map((s) => (
              <option key={s.strategy_type} value={s.strategy_type}>
                {s.display_name}
              </option>
            ))}
          </select>
          <span className={form.hint}>
            Pre-selects this type when adding items. Can still be changed per item.
          </span>
        </label>
        <div className={form.label}>
          Color
          <div className={styles.colorPicker}>
            {COLLECTION_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={color === c ? `${styles.swatch} ${styles.swatchSelected}` : styles.swatch}
                style={{ background: c }}
                onClick={() => setColor(c)}
                title={c}
              />
            ))}
          </div>
        </div>
        {error && <p className={form.error}>{error}</p>}
        <div className={form.actions}>
          <button type="button" className={`${form.btn} ${form.btnCancel}`} onClick={onCancel} disabled={submitting}>
            Cancel
          </button>
          <button type="submit" className={`${form.btn} ${form.btnPrimary}`} disabled={submitting || !name.trim()}>
            {submitting ? "Saving…" : submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}
