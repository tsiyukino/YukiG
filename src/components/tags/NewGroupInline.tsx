import { useState } from "react";
import { Plus, Check, X } from "lucide-react";

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
      <button className="ng-btn" onClick={() => setOpen(true)}>
        <Plus size={13} /> New Group
      </button>
    );
  }

  return (
    <div className="ng-form">
      <input className="ng-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Group name" autoFocus onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setOpen(false); }} />
      <input className="ng-input ng-input--prefix" value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="Prefix (e.g. chem:)" onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setOpen(false); }} />
      <button className="ng-confirm" onClick={handleSave} disabled={saving || !name.trim()}><Check size={13} /> Create</button>
      <button className="ng-cancel" onClick={() => setOpen(false)}><X size={13} /></button>
      <style>{`
        .ng-btn { display: inline-flex; align-items: center; gap: var(--space-1); padding: 7px 14px; background: var(--color-accent); color: white; border-radius: var(--radius-sm); font-size: 13px; font-weight: 500; transition: background var(--transition-fast); white-space: nowrap; flex-shrink: 0; }
        .ng-btn:hover { background: var(--color-accent-hover); }
        .ng-form { display: flex; align-items: center; gap: var(--space-2); padding: var(--space-2) var(--space-3); background: var(--color-bg-secondary); border: 1px solid var(--color-border); border-radius: var(--radius-md); }
        .ng-input { height: 30px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); padding: 0 var(--space-2); font-size: 13px; background: var(--color-bg); outline: none; width: 160px; transition: border-color var(--transition-fast); }
        .ng-input:focus { border-color: var(--color-accent); }
        .ng-input--prefix { width: 130px; font-family: var(--font-mono); font-size: 12px; }
        .ng-confirm { display: inline-flex; align-items: center; gap: 5px; padding: 5px 12px; border-radius: var(--radius-sm); background: var(--color-accent); color: white; font-size: 12.5px; font-weight: 500; transition: background var(--transition-fast); }
        .ng-confirm:hover:not(:disabled) { background: var(--color-accent-hover); }
        .ng-confirm:disabled { opacity: 0.4; cursor: not-allowed; }
        .ng-cancel { display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: var(--radius-sm); color: var(--color-text-muted); transition: color var(--transition-fast), background var(--transition-fast); }
        .ng-cancel:hover { color: var(--color-danger); background: var(--color-danger-light); }
      `}</style>
    </div>
  );
}
