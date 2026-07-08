/**
 * Name form for creating a virtual folder or virtual group.
 */
import { useState, useEffect, useRef } from "react";
import { ChevronLeft, Plus } from "lucide-react";
import { itemCreate } from "@/services/tauriCommands";
import form from "@/styles/form.module.css";
import styles from "./VirtualForm.module.css";

interface VirtualFormProps {
  /** Display label, e.g. "Folder" or "Group". */
  label: string;
  placeholder: string;
  strategyType: "virtual_folder" | "virtual_group";
  collectionId: string;
  parentId?: string | null;
  onBack: () => void;
  onCreated: (id: string, strategyType: string) => void;
  submitting: boolean;
  setSubmitting: (v: boolean) => void;
  setError: (v: string | null) => void;
}

/**
 * Renders the create form for a structural item.
 */
export default function VirtualForm({
  label, placeholder, strategyType, collectionId, parentId,
  onBack, onCreated, submitting, setSubmitting, setError,
}: VirtualFormProps) {
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
    <div className={styles.stack}>
      <label className={form.label}>
        Name
        <input
          ref={inputRef}
          className={form.input}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={placeholder}
          onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") onBack(); }}
        />
      </label>
      <div className={styles.footer}>
        <button className={`${form.btn} ${form.btnGhost}`} onClick={onBack} disabled={submitting}>
          <ChevronLeft size={13} /> Back
        </button>
        <button className={`${form.btn} ${form.btnPrimary}`} onClick={handleCreate} disabled={submitting || !name.trim()}>
          <Plus size={13} /> {submitting ? "Creating…" : `Create ${label}`}
        </button>
      </div>
    </div>
  );
}
