/**
 * Modal for editing an existing item's name, description, strategy type,
 * and — for game items — play status and game type flags.
 *
 * @param item - The item being edited
 * @param onSave - Called with the updated item after a successful save
 * @param onClose - Called when the modal is dismissed
 */
import { useState, FormEvent, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import {
  itemUpdate,
  strategyList,
  StrategyEntry,
  gameStatusGet,
  gameStatusSet,
  strategyUpsertMetadata,
  GameStatus,
  StoryStatus,
  OnlineStatus,
} from "@/services/tauriCommands";
import { Item } from "@/types/item";

interface EditItemModalProps {
  item: Item;
  onSave: (updated: Item) => void;
  onClose: () => void;
}

const IS_GAME = (s: string) => s === "game" || s === "steam_game";

/** Modal overlay for editing an item's details. */
export default function EditItemModal({ item, onSave, onClose }: EditItemModalProps) {
  const [name, setName] = useState(item.name);
  const [description, setDescription] = useState(item.description);
  const [strategyType, setStrategyType] = useState(item.strategy_type);
  const [strategies, setStrategies] = useState<StrategyEntry[]>([]);

  // Game status fields — only loaded/shown for game strategy types.
  const [storyStatus, setStoryStatus] = useState<StoryStatus>("unplayed");
  const [onlineStatus, setOnlineStatus] = useState<OnlineStatus>("inactive");
  const [snoozeUntil, setSnoozeUntil] = useState<string | null>(null);
  // Game type flags stored in strategy_metadata.
  const [hasStory, setHasStory] = useState(false);
  const [hasPvp, setHasPvp] = useState(false);
  const [isLiveService, setIsLiveService] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mouseDownOnOverlay = useRef(false);

  useEffect(() => {
    strategyList().then(setStrategies).catch(() => {});

    if (IS_GAME(item.strategy_type)) {
      gameStatusGet(item.id)
        .then((gs: GameStatus) => {
          setStoryStatus(gs.story_status as StoryStatus);
          setOnlineStatus(gs.online_status as OnlineStatus);
          setSnoozeUntil(gs.snooze_until ?? null);
        })
        .catch(() => {});
    }
  }, [item.id, item.strategy_type]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const updated = await itemUpdate(
        item.id,
        name.trim() !== item.name ? name.trim() : undefined,
        description.trim() !== item.description ? description.trim() : undefined,
        strategyType !== item.strategy_type ? strategyType : undefined,
      );

      if (IS_GAME(item.strategy_type)) {
        await gameStatusSet(item.id, storyStatus, onlineStatus, snoozeUntil);
        await strategyUpsertMetadata(item.id, {
          has_story: hasStory ? "true" : "false",
          has_pvp: hasPvp ? "true" : "false",
          is_live_service: isLiveService ? "true" : "false",
        });
      }

      onSave(updated);
    } catch (err) {
      setError(String(err));
      setSubmitting(false);
    }
  }

  return createPortal(
    <div
      className="eim-overlay"
      onMouseDown={(e) => { mouseDownOnOverlay.current = e.target === e.currentTarget; }}
      onMouseUp={(e) => { if (mouseDownOnOverlay.current && e.target === e.currentTarget) onClose(); }}
    >
      <div className="eim-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="eim-header">
          <div>
            <span className="eim-title">Edit Item</span>
            <span className="eim-subtitle">{item.name}</span>
          </div>
          <button className="eim-close" onClick={onClose}><X size={15} /></button>
        </div>

        <form onSubmit={handleSubmit} className="eim-body">
          {/* Basic fields */}
          <div className="eim-field">
            <label className="eim-label" htmlFor="eim-name">Display name</label>
            <input
              id="eim-name"
              className="eim-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="eim-field">
            <label className="eim-label" htmlFor="eim-desc">Description</label>
            <input
              id="eim-desc"
              className="eim-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
            />
          </div>
          <div className="eim-field">
            <label className="eim-label" htmlFor="eim-type">Type</label>
            <GroupedStrategySelect
              id="eim-type"
              className="eim-input"
              value={strategyType}
              onChange={(e) => setStrategyType(e.target.value)}
              strategies={strategies}
            />
          </div>
          <div className="eim-field">
            <label className="eim-label">Folder Path</label>
            <div className="eim-path">{item.folder_path}</div>
          </div>

          {/* Game-specific fields */}
          {IS_GAME(item.strategy_type) && (
            <>
              <div className="eim-divider" />

              <div className="eim-section-label">Play Status</div>

              <div className="eim-row">
                <div className="eim-field">
                  <label className="eim-label" htmlFor="eim-story">Story status</label>
                  <select
                    id="eim-story"
                    className="eim-input"
                    value={storyStatus}
                    onChange={(e) => setStoryStatus(e.target.value as StoryStatus)}
                  >
                    <option value="unplayed">Unplayed</option>
                    <option value="playing">Playing</option>
                    <option value="on_hold">On Hold</option>
                    <option value="completed">Completed</option>
                    <option value="abandoned">Abandoned</option>
                    <option value="snoozed">Snoozed</option>
                  </select>
                </div>
                <div className="eim-field">
                  <label className="eim-label" htmlFor="eim-online">Online status</label>
                  <select
                    id="eim-online"
                    className="eim-input"
                    value={onlineStatus}
                    onChange={(e) => setOnlineStatus(e.target.value as OnlineStatus)}
                  >
                    <option value="inactive">Inactive</option>
                    <option value="active">Active</option>
                    <option value="snoozed">Snoozed</option>
                  </select>
                </div>
              </div>

              <div className="eim-section-label">Game Type</div>

              <div className="eim-checkboxes">
                <label className="eim-check">
                  <input
                    type="checkbox"
                    checked={hasStory}
                    onChange={(e) => setHasStory(e.target.checked)}
                  />
                  Has story / campaign
                </label>
                <label className="eim-check">
                  <input
                    type="checkbox"
                    checked={hasPvp}
                    onChange={(e) => setHasPvp(e.target.checked)}
                  />
                  Has PvP / competitive mode
                </label>
                <label className="eim-check">
                  <input
                    type="checkbox"
                    checked={isLiveService}
                    onChange={(e) => setIsLiveService(e.target.checked)}
                  />
                  Live-service / ongoing seasons
                </label>
              </div>
            </>
          )}

          {error && <div className="eim-error">{error}</div>}

          <div className="eim-footer">
            <button type="button" className="eim-btn-ghost" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="eim-btn-primary" disabled={submitting || !name.trim()}>
              {submitting ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>

      <style>{`
        .eim-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.45);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
          backdrop-filter: blur(2px);
        }
        .eim-modal {
          background: var(--color-bg);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          width: 460px;
          max-width: calc(100vw - 32px);
          max-height: calc(100vh - 48px);
          overflow-y: auto;
          box-shadow: 0 20px 60px rgba(0,0,0,0.15), 0 8px 24px rgba(0,0,0,0.08);
        }
        .eim-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          padding: var(--space-5);
          border-bottom: 1px solid var(--color-border-subtle);
          position: sticky;
          top: 0;
          background: var(--color-bg);
          z-index: 1;
        }
        .eim-title {
          display: block;
          font-size: 15px;
          font-weight: 600;
          color: var(--color-text-primary);
          letter-spacing: -0.01em;
        }
        .eim-subtitle {
          display: block;
          font-size: 12px;
          color: var(--color-text-muted);
          margin-top: 2px;
        }
        .eim-close {
          color: var(--color-text-muted);
          padding: 5px;
          border-radius: var(--radius-sm);
          transition: color var(--transition-fast), background var(--transition-fast);
        }
        .eim-close:hover {
          color: var(--color-text-primary);
          background: var(--color-bg-secondary);
        }
        .eim-body {
          padding: var(--space-5);
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
        }
        .eim-field {
          display: flex;
          flex-direction: column;
          gap: var(--space-1);
        }
        .eim-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--space-3);
        }
        .eim-label {
          font-size: 12px;
          font-weight: 500;
          color: var(--color-text-secondary);
        }
        .eim-input {
          padding: 8px 12px;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          font-size: 13px;
          background: var(--color-bg);
          color: var(--color-text-primary);
          outline: none;
          transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
        }
        .eim-input:focus {
          border-color: var(--color-accent);
          box-shadow: 0 0 0 3px rgba(99,102,241,0.1);
        }
        .eim-path {
          font-size: 11.5px;
          font-family: var(--font-mono);
          color: var(--color-text-muted);
          padding: 6px 10px;
          background: var(--color-bg-secondary);
          border: 1px solid var(--color-border-subtle);
          border-radius: var(--radius-sm);
          word-break: break-all;
        }
        .eim-divider {
          border: none;
          border-top: 1px solid var(--color-border-subtle);
          margin: var(--space-1) 0;
        }
        .eim-section-label {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--color-text-muted);
        }
        .eim-checkboxes {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }
        .eim-check {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          font-size: 13px;
          color: var(--color-text-secondary);
          cursor: pointer;
        }
        .eim-check input[type="checkbox"] {
          width: 14px;
          height: 14px;
          accent-color: var(--color-accent);
          cursor: pointer;
        }
        .eim-error {
          font-size: 12px;
          color: var(--color-danger);
          padding: var(--space-2) var(--space-3);
          background: var(--color-danger-light);
          border-radius: var(--radius-sm);
        }
        .eim-footer {
          display: flex;
          justify-content: flex-end;
          gap: var(--space-2);
          padding-top: var(--space-2);
          border-top: 1px solid var(--color-border-subtle);
        }
        .eim-btn-primary {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          background: var(--color-accent);
          color: white;
          border-radius: var(--radius-sm);
          font-size: 13px;
          font-weight: 500;
          transition: background var(--transition-fast);
        }
        .eim-btn-primary:hover:not(:disabled) { background: var(--color-accent-hover); }
        .eim-btn-primary:disabled { opacity: 0.55; cursor: not-allowed; }
        .eim-btn-ghost {
          display: inline-flex;
          align-items: center;
          padding: 8px 12px;
          color: var(--color-text-secondary);
          border-radius: var(--radius-sm);
          font-size: 13px;
          transition: background var(--transition-fast);
        }
        .eim-btn-ghost:hover:not(:disabled) { background: var(--color-bg-secondary); }
      `}</style>
    </div>,
    document.body
  );
}

// ─── GroupedStrategySelect ────────────────────────────────────────────────────

/**
 * Grouped `<select>` for strategy types.
 * Sub-strategies (group != "") are collected into an `<optgroup>`.
 */
function GroupedStrategySelect({ id, className, value, onChange, strategies }: {
  id: string;
  className?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  strategies: StrategyEntry[];
}) {
  const topLevel = strategies.filter((s) => !s.group);
  const groups = Array.from(new Set(strategies.filter((s) => s.group).map((s) => s.group)));

  return (
    <select id={id} className={className} value={value} onChange={onChange} style={{ cursor: "pointer" }}>
      {topLevel.map((s) => (
        <option key={s.strategy_type} value={s.strategy_type}>{s.display_name}</option>
      ))}
      {groups.map((group) => {
        const parent = strategies.find((s) => s.strategy_type === group);
        const children = strategies.filter((s) => s.group === group);
        const groupLabel = group.charAt(0).toUpperCase() + group.slice(1);
        return (
          <optgroup key={group} label={groupLabel}>
            {parent && <option value={parent.strategy_type}>{parent.display_name}</option>}
            {children.map((s) => (
              <option key={s.strategy_type} value={s.strategy_type}>{s.display_name}</option>
            ))}
          </optgroup>
        );
      })}
    </select>
  );
}
