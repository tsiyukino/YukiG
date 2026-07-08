/**
 * Editable notes card, backed by the DB item's description field.
 */
import { useState, useEffect } from "react";
import { Edit3, Pencil, Check, RefreshCw } from "lucide-react";
import { itemUpdate, itemGetById } from "@/services/tauriCommands";

interface NotesCardProps {
  /** DB item id for this Steam game. */
  itemId: string;
  onError: (msg: string) => void;
}

/**
 * Renders the Notes card with inline editing.
 */
export default function NotesCard({ itemId, onError }: NotesCardProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  // Load the stored description — otherwise editing would start from an
  // empty draft and saving would overwrite existing notes.
  useEffect(() => {
    itemGetById(itemId)
      .then((item) => setValue(item.description))
      .catch(() => {});
  }, [itemId]);

  async function handleSave() {
    setSaving(true);
    try {
      await itemUpdate(itemId, undefined, value);
      setEditing(false);
    } catch (e) {
      onError(String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="sdt-card sdt-card--static">
      <div className="sdt-card-header sdt-card-header--static">
        <span className="sdt-card-title"><span className="sdt-card-icon"><Edit3 size={13} /></span>Notes</span>
        {!editing && (
          <button className="sdt-card-edit-btn" onClick={() => setEditing(true)}><Pencil size={11} />Edit</button>
        )}
      </div>
      <div className="sdt-card-body">
        {editing ? (
          <div className="sdt-desc-edit">
            <textarea className="sdt-desc-textarea" value={value} onChange={(e) => setValue(e.target.value)}
              placeholder="Add notes…" rows={4} autoFocus />
            <div className="sdt-desc-actions">
              <button className="sdt-desc-save" onClick={handleSave} disabled={saving}>
                {saving ? <><RefreshCw size={11} className="sp-spin" />Saving…</> : <><Check size={11} />Save</>}
              </button>
              <button className="sdt-desc-cancel" onClick={() => setEditing(false)}>Cancel</button>
            </div>
          </div>
        ) : (
          <span className="sdt-field-value">{value || <em className="sdt-field-placeholder">No notes yet.</em>}</span>
        )}
      </div>
    </div>
  );
}
