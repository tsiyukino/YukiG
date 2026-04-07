import { useState } from "react";
import { Plus, Check, X } from "lucide-react";

/** Preset colors for new tags. */
const TAG_COLORS = [
  "#6366f1","#8b5cf6","#ec4899","#ef4444","#f97316",
  "#eab308","#22c55e","#14b8a6","#06b6d4","#3b82f6",
];

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
  const [color, setColor] = useState(TAG_COLORS[0]);
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
      <button className="nt-add-btn" onClick={() => setOpen(true)}>
        <Plus size={11} /> Add tag
      </button>
    );
  }

  return (
    <div className="nt-form">
      <input
        className="nt-input"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Tag name"
        autoFocus
        onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setOpen(false); }}
      />
      <div className="nt-colors">
        {TAG_COLORS.map((c) => (
          <button key={c} className={`nt-color ${color === c ? "nt-color--active" : ""}`} style={{ background: c }} onClick={() => setColor(c)} />
        ))}
      </div>
      <button className="nt-confirm" onClick={handleSave} disabled={saving || !name.trim()}><Check size={12} /></button>
      <button className="nt-cancel" onClick={() => setOpen(false)}><X size={12} /></button>
      <style>{`
        .nt-add-btn { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: var(--radius-full); font-size: 12px; color: var(--color-text-muted); border: 1px dashed var(--color-border); transition: color var(--transition-fast), border-color var(--transition-fast); }
        .nt-add-btn:hover { color: var(--color-accent); border-color: var(--color-accent); }
        .nt-form { display: flex; align-items: center; gap: var(--space-1); flex-wrap: wrap; }
        .nt-input { height: 28px; width: 120px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); padding: 0 var(--space-2); font-size: 12.5px; background: var(--color-bg); outline: none; transition: border-color var(--transition-fast); }
        .nt-input:focus { border-color: var(--color-accent); }
        .nt-colors { display: flex; gap: 4px; }
        .nt-color { width: 16px; height: 16px; border-radius: 50%; cursor: pointer; border: 2px solid transparent; transition: transform var(--transition-fast); }
        .nt-color:hover { transform: scale(1.15); }
        .nt-color--active { border-color: var(--color-text-primary); }
        .nt-confirm, .nt-cancel { display: flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: var(--radius-sm); color: var(--color-text-muted); transition: color var(--transition-fast), background var(--transition-fast); }
        .nt-confirm:hover:not(:disabled) { color: var(--color-success); }
        .nt-cancel:hover { color: var(--color-danger); }
        .nt-confirm:disabled { opacity: 0.4; cursor: not-allowed; }
      `}</style>
    </div>
  );
}
