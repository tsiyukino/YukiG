/**
 * Collapsible achievements section: lazy-loaded list with hidden-achievement
 * masking and an edit mode that writes unlock states back to Steam.
 * Reports its unlocked/total summary upward for the hero pill.
 */
import { useState, useEffect } from "react";
import {
  Trophy, Pencil, Eye, EyeOff, Save, RefreshCw, AlertCircle, Check, CheckCircle2, Lock,
} from "lucide-react";
import { steamGetAchievements, steamSetAchievements } from "@/services/tauriCommands";
import { SteamGame, SteamAchievement, AchievementEdit } from "@/types/steam";
import { fmtDate } from "@/utils/steamFormatters";
import { useLazySection } from "@/hooks/useLazySection";
import AchIcon from "../AchIcon";
import DetailSection from "../DetailSection";

interface AchievementsSectionProps {
  game: SteamGame;
  /** Reports the unlocked/total counts once loaded. */
  onSummary: (summary: { unlocked: number; total: number }) => void;
}

/**
 * Renders the achievements DetailSection.
 */
export default function AchievementsSection({ game, onSummary }: AchievementsSectionProps) {
  const section = useLazySection<SteamAchievement>(() => steamGetAchievements(game.app_id));
  const achievements = section.items;
  const [showHidden, setShowHidden] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editDraft, setEditDraft] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const achPct = achievements.length > 0 ? Math.round((unlockedCount / achievements.length) * 100) : 0;

  useEffect(() => {
    if (section.loaded) onSummary({ unlocked: unlockedCount, total: achievements.length });
  }, [section.loaded, unlockedCount, achievements.length, onSummary]);

  function toggleEditMode() {
    if (editMode) {
      setEditDraft({});
      setSaveError(null);
    } else {
      // Seed draft from current achievement states
      const draft: Record<string, boolean> = {};
      for (const a of achievements) draft[a.api_name] = a.unlocked;
      setEditDraft(draft);
    }
    setEditMode((v) => !v);
  }

  async function saveAchievements() {
    const edits: AchievementEdit[] = achievements
      .filter((a) => editDraft[a.api_name] !== undefined && editDraft[a.api_name] !== a.unlocked)
      .map((a) => ({ api_name: a.api_name, unlocked: editDraft[a.api_name] }));
    if (edits.length === 0) { setEditMode(false); return; }
    setSaving(true);
    setSaveError(null);
    try {
      await steamSetAchievements(game.app_id, edits);
      // Reflect changes locally without re-fetching
      section.setItems((prev) =>
        prev.map((a) =>
          editDraft[a.api_name] !== undefined
            ? { ...a, unlocked: editDraft[a.api_name], unlock_time: editDraft[a.api_name] ? Math.floor(Date.now() / 1000) : 0 }
            : a,
        ),
      );
      setEditDraft({});
      setEditMode(false);
    } catch (e) {
      setSaveError(String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <DetailSection
      icon={<Trophy size={13} />}
      title="Achievements"
      badge={section.loaded && achievements.length > 0
        ? <span className="sdt-badge">{unlockedCount}/{achievements.length} · {achPct}%</span>
        : undefined}
      onToggle={section.toggle}
      expanded={section.expanded}
      loading={section.loading}
    >
      {achievements.length > 0 && (
        <div className="sdt-ach-toolbar">
          <div className="sdt-ach-progress-wrap" style={{ flex: 1 }}>
            <div className="sdt-ach-progress-bar" style={{ width: `${achPct}%` }} />
          </div>
          <button
            className={`sdt-ach-tool-btn ${showHidden ? "sdt-ach-tool-btn--on" : ""}`}
            onClick={() => setShowHidden((v) => !v)}
            title={showHidden ? "Hide hidden achievements" : "Show hidden achievements"}
          >
            {showHidden ? <Eye size={12} /> : <EyeOff size={12} />}
            {showHidden ? "Shown" : "Hidden"}
          </button>
          <button
            className={`sdt-ach-tool-btn ${editMode ? "sdt-ach-tool-btn--edit" : ""}`}
            onClick={toggleEditMode}
            title={editMode ? "Cancel editing" : "Edit achievement unlock states"}
          >
            <Pencil size={12} />
            {editMode ? "Cancel" : "Edit"}
          </button>
        </div>
      )}

      {editMode && (
        <div className="sdt-ach-save-bar">
          {saveError && <span className="sdt-ach-save-error"><AlertCircle size={11} />{saveError}</span>}
          <button className="sdt-ach-save-btn" onClick={saveAchievements} disabled={saving}>
            {saving ? <><RefreshCw size={11} className="sp-spin" />Saving…</> : <><Save size={11} />Save Changes</>}
          </button>
        </div>
      )}

      {section.loaded && achievements.length === 0 ? (
        <div className="sdt-empty"><Trophy size={18} /><span>No achievement data found.</span></div>
      ) : (
        <div className="sdt-ach-list">
          {achievements.map((a) => {
            // Mask hidden achievements as ??? when showHidden is off
            const masked = a.hidden && !a.unlocked && !showHidden;
            const displayUnlocked = editMode ? (editDraft[a.api_name] ?? a.unlocked) : a.unlocked;
            const iconUrl = a.icon || "";
            return (
              <div
                key={a.api_name}
                className={`sdt-ach-item ${displayUnlocked ? "sdt-ach-item--on" : ""} ${editMode ? "sdt-ach-item--editable" : ""}`}
                onClick={editMode ? () => setEditDraft((d) => ({ ...d, [a.api_name]: !d[a.api_name] })) : undefined}
                title={editMode ? (displayUnlocked ? "Click to lock" : "Click to unlock") : undefined}
              >
                <div className="sdt-ach-img-wrap">
                  {masked ? (
                    <div className="sdt-ach-icon-fb sdt-ach-icon-fb--hidden"><Lock size={10} /></div>
                  ) : iconUrl ? (
                    <AchIcon src={iconUrl} unlocked={displayUnlocked} />
                  ) : (
                    <div className={`sdt-ach-icon-fb ${displayUnlocked ? "sdt-ach-icon-fb--on" : ""}`}>
                      {displayUnlocked ? <Check size={10} /> : <Lock size={10} />}
                    </div>
                  )}
                </div>
                <div className="sdt-ach-info">
                  <span className="sdt-ach-name">
                    {masked ? "???" : (a.name || a.api_name)}
                  </span>
                  {!masked && a.description && (
                    <span className="sdt-ach-desc">{a.description}</span>
                  )}
                  {masked ? (
                    <span className="sdt-ach-sub">Hidden achievement</span>
                  ) : (
                    <span className="sdt-ach-sub">
                      {displayUnlocked && a.unlock_time > 0
                        ? `Unlocked ${fmtDate(a.unlock_time)}`
                        : `${a.global_pct.toFixed(1)}% of players`}
                    </span>
                  )}
                </div>
                {editMode ? (
                  <div className={`sdt-ach-edit-check ${displayUnlocked ? "sdt-ach-edit-check--on" : ""}`}>
                    {displayUnlocked ? <Check size={11} /> : <Lock size={11} />}
                  </div>
                ) : (
                  displayUnlocked && <CheckCircle2 size={13} className="sdt-ach-check" />
                )}
              </div>
            );
          })}
        </div>
      )}
    </DetailSection>
  );
}
