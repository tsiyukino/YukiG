/**
 * Game-specific fields for the edit-item modal: story/online status
 * selects and the game-type flag checkboxes.
 */
import { StoryStatus, OnlineStatus } from "@/services/tauriCommands";
import form from "@/styles/form.module.css";
import styles from "@/pages/EditItemModal.module.css";

interface GameEditFieldsProps {
  storyStatus: StoryStatus;
  onStoryStatusChange: (v: StoryStatus) => void;
  onlineStatus: OnlineStatus;
  onOnlineStatusChange: (v: OnlineStatus) => void;
  hasStory: boolean;
  onHasStoryChange: (v: boolean) => void;
  hasPvp: boolean;
  onHasPvpChange: (v: boolean) => void;
  isLiveService: boolean;
  onIsLiveServiceChange: (v: boolean) => void;
}

/**
 * Renders the play-status selects and game-type checkboxes.
 */
export default function GameEditFields({
  storyStatus, onStoryStatusChange,
  onlineStatus, onOnlineStatusChange,
  hasStory, onHasStoryChange,
  hasPvp, onHasPvpChange,
  isLiveService, onIsLiveServiceChange,
}: GameEditFieldsProps) {
  return (
    <>
      <div className={styles.divider} />
      <div className={styles.sectionLabel}>Play Status</div>

      <div className={styles.row}>
        <label className={form.label}>
          Story status
          <select
            className={form.input}
            value={storyStatus}
            onChange={(e) => onStoryStatusChange(e.target.value as StoryStatus)}
          >
            <option value="unplayed">Unplayed</option>
            <option value="playing">Playing</option>
            <option value="on_hold">On Hold</option>
            <option value="completed">Completed</option>
            <option value="abandoned">Abandoned</option>
            <option value="snoozed">Snoozed</option>
          </select>
        </label>
        <label className={form.label}>
          Online status
          <select
            className={form.input}
            value={onlineStatus}
            onChange={(e) => onOnlineStatusChange(e.target.value as OnlineStatus)}
          >
            <option value="inactive">Inactive</option>
            <option value="active">Active</option>
            <option value="snoozed">Snoozed</option>
          </select>
        </label>
      </div>

      <div className={styles.sectionLabel}>Game Type</div>

      <div className={styles.checkboxes}>
        <label className={styles.check}>
          <input type="checkbox" checked={hasStory} onChange={(e) => onHasStoryChange(e.target.checked)} />
          Has story / campaign
        </label>
        <label className={styles.check}>
          <input type="checkbox" checked={hasPvp} onChange={(e) => onHasPvpChange(e.target.checked)} />
          Has PvP / competitive mode
        </label>
        <label className={styles.check}>
          <input type="checkbox" checked={isLiveService} onChange={(e) => onIsLiveServiceChange(e.target.checked)} />
          Live-service / ongoing seasons
        </label>
      </div>
    </>
  );
}
