import { useState } from "react";
import { Plus, Check, X } from "lucide-react";
import { TAG_COLORS } from "@/utils/colorPalettes";
import styles from "./NewTagInline.module.css";

interface NewTagInlineProps {
  /** Called with the chosen name and color when the user confirms. */
  onCreate: (name: string, color: string) => Promise<void>;
}

/**
 * Inline "Add tag" button that expands into a small form with a name input
 * and a color picker. Cancellable with Escape or the X button.
 */
export default function NewTagInline({ onCreate }: NewTagInlineProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(TAG_COLORS[0]);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    await onCreate(name.trim(), color);
    setName("");
    setColor(TAG_COLORS[0]);
    setSaving(false);
    setOpen(false);
  }

  if (!open) {
    return (
      <button className={styles.addBtn} onClick={() => setOpen(true)}>
        <Plus size={11} /> Add tag
      </button>
    );
  }

  return (
    <div className={styles.form}>
      <input
        className={styles.input}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Tag name"
        autoFocus
        onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setOpen(false); }}
      />
      <div className={styles.colors}>
        {TAG_COLORS.map((c) => (
          <button key={c} className={color === c ? `${styles.color} ${styles.colorActive}` : styles.color} style={{ background: c }} onClick={() => setColor(c)} />
        ))}
      </div>
      <button className={styles.confirm} onClick={handleSave} disabled={saving || !name.trim()}><Check size={12} /></button>
      <button className={styles.cancel} onClick={() => setOpen(false)}><X size={12} /></button>
    </div>
  );
}
