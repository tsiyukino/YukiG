/**
 * Tag assignment card for a Steam game's DB item: chips with inline
 * picker and on-the-fly tag creation.
 */
import { useState, useEffect } from "react";
import { Globe } from "lucide-react";
import { tagGetAll, tagGetByItem, tagAssign, tagRemove, tagCreate } from "@/services/tauriCommands";
import { Tag } from "@/types/tag";
import { randomTagColor } from "@/utils/colorPalettes";

/**
 * Renders the Tags card with picker.
 */
export default function TagsCard({ itemId }: { itemId: string }) {
  const [itemTags, setItemTags] = useState<Tag[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [newTagName, setNewTagName] = useState("");

  useEffect(() => {
    tagGetByItem(itemId).then(setItemTags).catch(() => {});
    tagGetAll().then(setAllTags).catch(() => {});
  }, [itemId]);

  async function handleAssign(tagId: string) {
    await tagAssign(itemId, tagId);
    setItemTags((prev) => {
      if (prev.some((t) => t.id === tagId)) return prev;
      const tag = allTags.find((t) => t.id === tagId);
      return tag ? [...prev, tag] : prev;
    });
  }

  async function handleRemove(tagId: string) {
    await tagRemove(itemId, tagId);
    setItemTags((prev) => prev.filter((t) => t.id !== tagId));
  }

  async function handleCreate() {
    if (!newTagName.trim()) return;
    try {
      const tag = await tagCreate(newTagName.trim(), randomTagColor());
      setAllTags((prev) => [...prev, tag]);
      await handleAssign(tag.id);
      setNewTagName("");
    } catch {
      // Non-fatal — the input keeps its value for a retry.
    }
  }

  return (
    <div className="sdt-card sdt-card--static">
      <div className="sdt-card-header sdt-card-header--static">
        <span className="sdt-card-title"><span className="sdt-card-icon"><Globe size={13} /></span>Tags</span>
        <button className="sdt-card-edit-btn" onClick={() => setPickerOpen((v) => !v)}>
          {pickerOpen ? "Done" : "Edit"}
        </button>
      </div>
      <div className="sdt-card-body">
        <div className="sdt-tag-chips">
          {itemTags.map((t) => (
            <span key={t.id} className="sdt-tag-chip" style={{ background: t.color + "22", color: t.color, borderColor: t.color + "55" }}>
              {t.tag_type === "mood" && <span className="sdt-tag-mood-dot" style={{ background: t.color }} />}
              {t.name}
              {pickerOpen && (
                <button className="sdt-tag-remove" onClick={() => handleRemove(t.id)}>×</button>
              )}
            </span>
          ))}
          {itemTags.length === 0 && !pickerOpen && (
            <span className="sdt-field-placeholder">No tags yet.</span>
          )}
        </div>
        {pickerOpen && (
          <div className="sdt-tag-picker">
            <div className="sdt-tag-picker-list">
              {allTags
                .filter((t) => !itemTags.some((it) => it.id === t.id))
                .map((t) => (
                  <button key={t.id} className="sdt-tag-picker-item" onClick={() => handleAssign(t.id)}>
                    {t.tag_type === "mood" && <span className="sdt-tag-mood-dot" style={{ background: t.color }} />}
                    <span style={{ color: t.color }}>{t.name}</span>
                  </button>
                ))
              }
            </div>
            <div className="sdt-tag-new">
              <input
                className="sdt-tag-new-input"
                placeholder="New tag name…"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
              />
              <button className="sdt-tag-new-btn" onClick={handleCreate} disabled={!newTagName.trim()}>
                Add
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
