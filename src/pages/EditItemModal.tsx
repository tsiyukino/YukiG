/**
 * Modal for editing an existing item's name, description, strategy type,
 * and — for game items — play status and game type flags.
 *
 * @param item - The item being edited
 * @param onSave - Called with the updated item after a successful save
 * @param onClose - Called when the modal is dismissed
 */
import { useState, FormEvent, useEffect } from "react";
import { X } from "lucide-react";
import {
  itemUpdate,
  strategyList,
  StrategyEntry,
  gameStatusGet,
  gameStatusSet,
  strategyGetMetadata,
  strategyUpsertMetadata,
  GameStatus,
  StoryStatus,
  OnlineStatus,
} from "@/services/tauriCommands";
import { Item } from "@/types/item";
import Modal from "@/components/common/Modal";
import GroupedStrategySelect from "@/components/common/GroupedStrategySelect";
import GameEditFields from "@/components/detail/GameEditFields";
import form from "@/styles/form.module.css";
import styles from "./EditItemModal.module.css";

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
      // Initialize the game-type checkboxes from stored metadata — saving
      // writes all three flags, so starting from false would wipe them.
      strategyGetMetadata(item.id)
        .then((meta) => {
          setHasStory(meta.has_story === "true");
          setHasPvp(meta.has_pvp === "true");
          setIsLiveService(meta.is_live_service === "true");
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

  return (
    <Modal width={460} onClose={onClose}>
      <div className={styles.header}>
        <div>
          <span className={styles.title}>Edit Item</span>
          <span className={styles.subtitle}>{item.name}</span>
        </div>
        <button className={styles.close} onClick={onClose}><X size={15} /></button>
      </div>

      <form onSubmit={handleSubmit} className={form.form}>
        <label className={form.label}>
          Display name
          <input
            className={form.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
          />
        </label>
        <label className={form.label}>
          Description
          <input
            className={form.input}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description"
          />
        </label>
        <label className={form.label}>
          Type
          <GroupedStrategySelect
            className={form.input}
            value={strategyType}
            onChange={(e) => setStrategyType(e.target.value)}
            strategies={strategies}
          />
        </label>
        <div className={form.label}>
          Folder Path
          <div className={styles.path}>{item.folder_path}</div>
        </div>

        {IS_GAME(item.strategy_type) && (
          <GameEditFields
            storyStatus={storyStatus}
            onStoryStatusChange={setStoryStatus}
            onlineStatus={onlineStatus}
            onOnlineStatusChange={setOnlineStatus}
            hasStory={hasStory}
            onHasStoryChange={setHasStory}
            hasPvp={hasPvp}
            onHasPvpChange={setHasPvp}
            isLiveService={isLiveService}
            onIsLiveServiceChange={setIsLiveService}
          />
        )}

        {error && <div className={styles.errorBox}>{error}</div>}

        <div className={styles.footer}>
          <button type="button" className={`${form.btn} ${form.btnCancel}`} onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button type="submit" className={`${form.btn} ${form.btnPrimary}`} disabled={submitting || !name.trim()}>
            {submitting ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
