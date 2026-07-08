/**
 * Play page — "what should I play tonight?"
 *
 * Full-width layout that fills the content area:
 *  header (title · pool count · filters) → FeaturedCard hero → "Up next" row.
 */
import { useCallback } from "react";
import { Dices } from "lucide-react";
import { usePlayPage, PlayCandidate } from "@/hooks/usePlayPage";
import { StoryStatus } from "@/services/commands/play";
import { strategyExecuteLaunchTracked } from "@/services/tauriCommands";
import FeaturedCard from "@/components/play/FeaturedCard";
import CandidateList from "@/components/play/CandidateList";
import PlayFilters from "@/components/play/PlayFilters";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import styles from "./PlayPage.module.css";

export default function PlayPage() {
  const {
    loading, error,
    moodTags, selectedMoodTagId, setSelectedMoodTagId,
    playMode, setPlayMode,
    installedOnly, setInstalledOnly,
    featured, candidates,
    skip, setStoryStatus, snooze, featureCandidate,
  } = usePlayPage();

  const handleLaunch = useCallback(async (candidate: PlayCandidate) => {
    const { item } = candidate;
    try {
      await strategyExecuteLaunchTracked(item.id);
      if (candidate.status.story_status === "unplayed") {
        await setStoryStatus(item.id, "playing");
      }
    } catch (err) {
      console.error("Launch failed:", err);
    }
  }, [setStoryStatus]);

  if (loading) return <div className={styles.fill}><LoadingSpinner /></div>;
  if (error) return <div className={styles.fill}><p className={styles.error}>{error}</p></div>;

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <Dices size={17} />
          <h1 className={styles.title}>Play</h1>
          {featured && (
            <span className={styles.count}>{candidates.length + 1} in pool</span>
          )}
        </div>

        <PlayFilters
          playMode={playMode}
          onPlayModeChange={setPlayMode}
          installedOnly={installedOnly}
          onInstalledOnlyChange={setInstalledOnly}
          moodTags={moodTags}
          selectedMoodTagId={selectedMoodTagId}
          onMoodTagChange={setSelectedMoodTagId}
        />
      </div>

      {featured ? (
        <FeaturedCard
          candidate={featured}
          onLaunch={() => handleLaunch(featured)}
          onSkip={skip}
          onSetStatus={(s: StoryStatus) => setStoryStatus(featured.item.id, s)}
          onSnooze={(days) => snooze(featured.item.id, days)}
        />
      ) : (
        <div className={styles.empty}>
          <Dices size={44} strokeWidth={1.5} color="var(--color-text-muted)" />
          <p className={styles.emptyTitle}>Nothing to play right now</p>
          <p className={styles.emptyHint}>
            Add games to a library, or clear completed&nbsp;/&nbsp;abandoned status to bring them back.
          </p>
        </div>
      )}

      {featured && candidates.length > 0 && (
        <section className={styles.next}>
          <h2 className={styles.nextLabel}>Up next</h2>
          <CandidateList candidates={candidates} onSelect={featureCandidate} />
        </section>
      )}
    </div>
  );
}
