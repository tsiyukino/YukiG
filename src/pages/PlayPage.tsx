/**
 * Play page — "what should I play tonight?"
 *
 * Full-width layout that fills the content area:
 *  ┌─────────────────────────────────────────────────────┐
 *  │ Header: title · pool count · mood filter chips      │
 *  ├─────────────────────────────────────────────────────┤
 *  │ FeaturedCard — cinematic hero, full width           │
 *  ├─────────────────────────────────────────────────────┤
 *  │ "Up next" · horizontal candidate scroll row         │
 *  └─────────────────────────────────────────────────────┘
 */
import { useCallback } from "react";
import { Dices, HardDrive } from "lucide-react";
import { usePlayPage, PlayCandidate, PlayModeFilter } from "@/hooks/usePlayPage";
import { StoryStatus } from "@/services/commands/play";
import { strategyExecuteLaunchTracked } from "@/services/tauriCommands";
import FeaturedCard from "@/components/play/FeaturedCard";
import CandidateList from "@/components/play/CandidateList";
import LoadingSpinner from "@/components/common/LoadingSpinner";

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
      await strategyExecuteLaunchTracked(item.id, item.folder_path, item.strategy_type);
      if (candidate.status.story_status === "unplayed") {
        await setStoryStatus(item.id, "playing");
      }
    } catch (err) {
      console.error("Launch failed:", err);
    }
  }, [setStoryStatus]);

  if (loading) return (
    <div className="pp-fill pp-center"><LoadingSpinner /></div>
  );
  if (error) return (
    <div className="pp-fill pp-center"><p className="pp-error">{error}</p></div>
  );

  return (
    <div className="pp-root">

      {/* ── Header ── */}
      <div className="pp-header">
        <div className="pp-title-row">
          <Dices size={17} />
          <h1 className="pp-title">Play</h1>
          {featured && (
            <span className="pp-count">{candidates.length + 1} in pool</span>
          )}
        </div>

        {/* Filter bar — play mode + installed toggle */}
        <div className="pp-filters">
          {/* Play mode segmented control */}
          <div className="pp-seg">
            {(["all", "continue", "new", "online"] as PlayModeFilter[]).map((mode) => {
              const labels: Record<PlayModeFilter, string> = {
                all:      "All",
                continue: "Continue",
                new:      "Start New",
                online:   "Online",
              };
              return (
                <button
                  key={mode}
                  className={`pp-seg-btn${playMode === mode ? " pp-seg-btn--on" : ""}`}
                  onClick={() => setPlayMode(mode)}
                >
                  {labels[mode]}
                </button>
              );
            })}
          </div>

          {/* Installed only toggle */}
          <button
            className={`pp-toggle${installedOnly ? " pp-toggle--on" : ""}`}
            onClick={() => setInstalledOnly(!installedOnly)}
            title={installedOnly ? "Showing installed games only" : "Showing all games"}
          >
            <HardDrive size={13} />
            Installed only
          </button>
        </div>

        {/* Mood chips */}
        {moodTags.length > 0 && (
          <div className="pp-moods">
            <button
              className={`pp-chip${!selectedMoodTagId ? " pp-chip--on" : ""}`}
              onClick={() => setSelectedMoodTagId(null)}
            >All moods</button>
            {moodTags.map((t) => (
              <button
                key={t.id}
                className={`pp-chip${selectedMoodTagId === t.id ? " pp-chip--on" : ""}`}
                style={selectedMoodTagId === t.id
                  ? { background: t.color + "22", color: t.color, borderColor: t.color }
                  : {}}
                onClick={() => setSelectedMoodTagId(selectedMoodTagId === t.id ? null : t.id)}
              >{t.name}</button>
            ))}
          </div>
        )}
      </div>

      {/* ── Hero ── */}
      {featured ? (
        <FeaturedCard
          candidate={featured}
          onLaunch={() => handleLaunch(featured)}
          onSkip={skip}
          onSetStatus={(s: StoryStatus) => setStoryStatus(featured.item.id, s)}
          onSnooze={(days) => snooze(featured.item.id, days)}
        />
      ) : (
        <div className="pp-empty">
          <Dices size={44} strokeWidth={1.5} color="var(--color-text-muted)" />
          <p className="pp-empty-title">Nothing to play right now</p>
          <p className="pp-empty-hint">
            Add games to a library, or clear completed&nbsp;/&nbsp;abandoned status to bring them back.
          </p>
        </div>
      )}

      {/* ── Up next ── */}
      {featured && candidates.length > 0 && (
        <section className="pp-next">
          <h2 className="pp-next-label">Up next</h2>
          <CandidateList candidates={candidates} onSelect={featureCandidate} />
        </section>
      )}

      <style>{`
        .pp-root {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: var(--space-5);
        }
        .pp-fill {
          width: 100%;
          height: 100%;
        }
        .pp-center {
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .pp-error { color: var(--color-danger); font-size: 14px; }

        /* header */
        .pp-header {
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
        }
        .pp-title-row {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          color: var(--color-text-primary);
        }
        .pp-title {
          font-size: 20px;
          font-weight: 700;
          color: var(--color-text-primary);
        }
        .pp-count {
          font-size: 12px;
          color: var(--color-text-muted);
          font-weight: 400;
          margin-left: 4px;
        }

        /* filter bar */
        .pp-filters {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          flex-wrap: wrap;
        }

        /* segmented control */
        .pp-seg {
          display: flex;
          background: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          padding: 2px;
          gap: 2px;
        }
        .pp-seg-btn {
          padding: 4px 12px;
          border-radius: calc(var(--radius-md) - 2px);
          border: none;
          background: transparent;
          color: var(--color-text-muted);
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: background .12s, color .12s;
          white-space: nowrap;
        }
        .pp-seg-btn:hover {
          background: var(--color-bg-tertiary);
          color: var(--color-text-primary);
        }
        .pp-seg-btn--on {
          background: var(--color-bg);
          color: var(--color-text-primary);
          font-weight: 600;
          box-shadow: 0 1px 3px rgba(0,0,0,.12);
        }

        /* installed toggle */
        .pp-toggle {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 5px 12px;
          border-radius: var(--radius-md);
          border: 1px solid var(--color-border);
          background: transparent;
          color: var(--color-text-muted);
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: background .12s, color .12s, border-color .12s;
          white-space: nowrap;
        }
        .pp-toggle:hover {
          background: var(--color-bg-tertiary);
          color: var(--color-text-primary);
        }
        .pp-toggle--on {
          background: var(--color-accent-light);
          color: var(--color-accent);
          border-color: var(--color-accent);
        }

        /* mood chips */
        .pp-moods {
          display: flex;
          gap: var(--space-2);
          flex-wrap: wrap;
        }
        .pp-chip {
          padding: 3px 11px;
          border-radius: var(--radius-full);
          border: 1px solid var(--color-border);
          background: transparent;
          color: var(--color-text-muted);
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: background .12s, color .12s, border-color .12s;
        }
        .pp-chip:hover {
          background: var(--color-bg-tertiary);
          color: var(--color-text-primary);
        }
        .pp-chip--on {
          background: var(--color-accent-light);
          color: var(--color-accent);
          border-color: var(--color-accent-light);
        }

        /* empty state */
        .pp-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--space-3);
          padding: 80px 0;
          text-align: center;
        }
        .pp-empty-title {
          font-size: 16px;
          font-weight: 600;
          color: var(--color-text-secondary);
          margin-top: var(--space-2);
        }
        .pp-empty-hint {
          font-size: 13px;
          color: var(--color-text-muted);
          max-width: 340px;
          line-height: 1.6;
        }

        /* up next section */
        .pp-next {
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
        }
        .pp-next-label {
          font-size: 11px;
          font-weight: 700;
          color: var(--color-text-muted);
          text-transform: uppercase;
          letter-spacing: .08em;
        }
      `}</style>
    </div>
  );
}
