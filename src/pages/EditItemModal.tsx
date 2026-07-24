/**
 * Multi-step modal for editing an item.
 *
 * Step 1 (General): name, description, type — always shown.
 * Step 2 (Game): play status and game-type flags — games only.
 * Step 3 (Paths): executable, mod / screenshots / saves folders, extra exes —
 *   games only; applies to both local and Steam games.
 *
 * Non-game items have only the General step and save directly. Field state and
 * the save routine live in useEditItemFlow.
 */
import { useState, useEffect } from "react";
import { X, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { strategyList, StrategyEntry } from "@/services/tauriCommands";
import { Item } from "@/types/item";
import Modal from "@/components/common/Modal";
import GroupedStrategySelect from "@/components/common/GroupedStrategySelect";
import GameEditFields from "@/components/detail/GameEditFields";
import GamePathsStep from "@/components/detail/GamePathsStep";
import StepBar, { StepInfo } from "@/components/additem/StepBar";
import { useEditItemFlow } from "@/hooks/useEditItemFlow";
import form from "@/styles/form.module.css";
import styles from "./EditItemModal.module.css";

interface EditItemModalProps {
  item: Item;
  onSave: (updated: Item) => void;
  onClose: () => void;
}

/** Modal overlay for editing an item's details as a short wizard. */
export default function EditItemModal({ item, onSave, onClose }: EditItemModalProps) {
  const flow = useEditItemFlow(item);
  const [strategies, setStrategies] = useState<StrategyEntry[]>([]);
  const [step, setStep] = useState(0);

  useEffect(() => {
    strategyList().then(setStrategies).catch(() => {});
  }, []);

  const steps: StepInfo[] = flow.isGame
    ? [{ key: "general", label: "General" }, { key: "game", label: "Game" }, { key: "paths", label: "Paths" }]
    : [{ key: "general", label: "General" }];
  const isLast = step === steps.length - 1;

  async function handleSave() {
    const updated = await flow.save();
    if (updated) onSave(updated);
  }

  return (
    <Modal width={480} onClose={onClose}>
      <div className={styles.header}>
        <div>
          <span className={styles.title}>Edit Item</span>
          <span className={styles.subtitle}>{item.name}</span>
        </div>
        <button className={styles.close} onClick={onClose}><X size={15} /></button>
      </div>

      {steps.length > 1 && <StepBar steps={steps} current={step} />}

      <div className={form.form}>
        {steps[step].key === "general" && (
          <>
            <label className={form.label}>
              Display name
              <input
                className={form.input}
                value={flow.name}
                onChange={(e) => flow.setName(e.target.value)}
                required
                autoFocus
              />
            </label>
            <label className={form.label}>
              Description
              <input
                className={form.input}
                value={flow.description}
                onChange={(e) => flow.setDescription(e.target.value)}
                placeholder="Optional description"
              />
            </label>
            <label className={form.label}>
              Type
              <GroupedStrategySelect
                className={form.input}
                value={flow.strategyType}
                onChange={(e) => flow.setStrategyType(e.target.value)}
                strategies={strategies}
              />
            </label>
            <div className={form.label}>
              Folder Path
              <div className={styles.path}>{item.folder_path}</div>
            </div>
          </>
        )}

        {steps[step].key === "game" && (
          <GameEditFields
            storyStatus={flow.storyStatus}
            onStoryStatusChange={flow.setStoryStatus}
            onlineStatus={flow.onlineStatus}
            onOnlineStatusChange={flow.setOnlineStatus}
            hasStory={flow.hasStory}
            onHasStoryChange={flow.setHasStory}
            hasPvp={flow.hasPvp}
            onHasPvpChange={flow.setHasPvp}
            isLiveService={flow.isLiveService}
            onIsLiveServiceChange={flow.setIsLiveService}
          />
        )}

        {steps[step].key === "paths" && (
          <GamePathsStep
            basePath={item.folder_path}
            exePath={flow.exePath} onExeChange={flow.setExePath}
            modFolder={flow.modFolder} onModChange={flow.setModFolder}
            screenshotFolder={flow.screenshotFolder} onScreenshotChange={flow.setScreenshotFolder}
            saveFolder={flow.saveFolder} onSaveChange={flow.setSaveFolder}
            extraExes={flow.extraExes} onExtraExesChange={flow.setExtraExes}
          />
        )}

        {flow.error && <div className={styles.errorBox}>{flow.error}</div>}

        <div className={styles.footer}>
          {step > 0
            ? <button type="button" className={`${form.btn} ${form.btnGhost}`} onClick={() => setStep(step - 1)} disabled={flow.submitting}>
                <ChevronLeft size={13} />Back
              </button>
            : <button type="button" className={`${form.btn} ${form.btnCancel}`} onClick={onClose} disabled={flow.submitting}>
                Cancel
              </button>
          }
          {isLast
            ? <button type="button" className={`${form.btn} ${form.btnPrimary}`} onClick={handleSave} disabled={flow.submitting || !flow.name.trim()}>
                <Check size={13} /> {flow.submitting ? "Saving…" : "Save Changes"}
              </button>
            : <button type="button" className={`${form.btn} ${form.btnPrimary}`} onClick={() => setStep(step + 1)} disabled={!flow.name.trim()}>
                Next <ChevronRight size={13} />
              </button>
          }
        </div>
      </div>
    </Modal>
  );
}
