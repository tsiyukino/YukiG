/**
 * Filter bar for the Play page — play-mode segmented control,
 * installed-only toggle, and mood tag chips.
 */
import { HardDrive } from "lucide-react";
import { Tag } from "@/types/tag";
import { PlayModeFilter } from "@/hooks/usePlayPage";
import styles from "./PlayFilters.module.css";

const MODE_LABELS: Record<PlayModeFilter, string> = {
  all: "All",
  continue: "Continue",
  new: "Start New",
  online: "Online",
};

interface PlayFiltersProps {
  playMode: PlayModeFilter;
  onPlayModeChange: (mode: PlayModeFilter) => void;
  installedOnly: boolean;
  onInstalledOnlyChange: (value: boolean) => void;
  /** Available mood tags; the chip row is hidden when empty. */
  moodTags: Tag[];
  selectedMoodTagId: string | null;
  onMoodTagChange: (tagId: string | null) => void;
}

/**
 * Renders the Play page's pool filters.
 */
export default function PlayFilters({
  playMode,
  onPlayModeChange,
  installedOnly,
  onInstalledOnlyChange,
  moodTags,
  selectedMoodTagId,
  onMoodTagChange,
}: PlayFiltersProps) {
  return (
    <>
      <div className={styles.filters}>
        <div className={styles.seg}>
          {(Object.keys(MODE_LABELS) as PlayModeFilter[]).map((mode) => (
            <button
              key={mode}
              className={playMode === mode ? `${styles.segBtn} ${styles.segOn}` : styles.segBtn}
              onClick={() => onPlayModeChange(mode)}
            >
              {MODE_LABELS[mode]}
            </button>
          ))}
        </div>

        <button
          className={installedOnly ? `${styles.toggle} ${styles.toggleOn}` : styles.toggle}
          onClick={() => onInstalledOnlyChange(!installedOnly)}
          title={installedOnly ? "Showing installed games only" : "Showing all games"}
        >
          <HardDrive size={13} />
          Installed only
        </button>
      </div>

      {moodTags.length > 0 && (
        <div className={styles.moods}>
          <button
            className={!selectedMoodTagId ? `${styles.chip} ${styles.chipOn}` : styles.chip}
            onClick={() => onMoodTagChange(null)}
          >All moods</button>
          {moodTags.map((t) => (
            <button
              key={t.id}
              className={selectedMoodTagId === t.id ? `${styles.chip} ${styles.chipOn}` : styles.chip}
              style={selectedMoodTagId === t.id
                ? { background: t.color + "22", color: t.color, borderColor: t.color }
                : {}}
              onClick={() => onMoodTagChange(selectedMoodTagId === t.id ? null : t.id)}
            >{t.name}</button>
          ))}
        </div>
      )}
    </>
  );
}
