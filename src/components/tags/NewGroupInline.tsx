import { useState } from "react";
import { Plus, Check, X } from "lucide-react";
import styles from "./NewGroupInline.module.css";

interface NewGroupInlineProps {
  /** Called with group name and prefix when the user confirms. */
  onCreate: (name: string, prefix: string) => Promise<void>;
}

/**
 * "New Group" button that expands inline into a form with name and prefix inputs.
 * Cancellable with Escape or the X button.
 */
export default function NewGroupInline({ onCreate }: NewGroupInlineProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [prefix, setPrefix] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    await onCreate(name.trim(), prefix.trim());
    setName("");
    setPrefix("");
    setSaving(false);
    setOpen(false);
  }

  if (!open) {
    return (
      <button className={styles.btn} onClick={() => setOpen(true)}>
        <Plus size={13} /> New Group
      </button>
    );
  }

  return (
    <div className={styles.form}>
      <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Group name" autoFocus onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setOpen(false); }} />
      <input className={`${styles.input} ${styles.prefix}`} value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="Prefix (e.g. chem:)" onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setOpen(false); }} />
      <button className={styles.confirm} onClick={handleSave} disabled={saving || !name.trim()}><Check size={13} /> Create</button>
      <button className={styles.cancel} onClick={() => setOpen(false)}><X size={13} /></button>
    </div>
  );
}
