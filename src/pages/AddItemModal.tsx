/**
 * Multi-step modal for adding a new item to a collection.
 *
 * The modal has two modes in one unified container:
 * - "item" mode: pick a file/folder, name it, choose a strategy (multi-step)
 * - "groups" mode: create a virtual folder or group (organisational items)
 *
 * A tab strip at the top switches modes; the content slides horizontally.
 * All wizard state lives in useAddItemFlow.
 */
import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { X, ChevronRight, ChevronLeft, Plus } from "lucide-react";
import { useAddItemFlow, Step } from "@/hooks/useAddItemFlow";
import StepBar, { StepInfo } from "@/components/additem/StepBar";
import PickStep from "@/components/additem/PickStep";
import DetailsStep from "@/components/additem/DetailsStep";
import MetadataStep from "@/components/additem/MetadataStep";
import GroupsMenu from "@/components/additem/GroupsMenu";
import VirtualForm from "@/components/additem/VirtualForm";
import form from "@/styles/form.module.css";
import styles from "./AddItemModal.module.css";

interface AddItemModalProps {
  collectionId: string;
  defaultStrategy?: string;
  /** If set, new items are created as children of this parent (virtual_folder or virtual_group). */
  parentId?: string | null;
  /**
   * Pre-filled path (e.g. from a drag-and-drop). When provided the modal skips
   * the "pick" step and opens directly on the "details" step.
   */
  initialPath?: string;
  onSuccess: (itemId: string, strategyType: string) => void;
  onClose: () => void;
}

type ModalMode = "item" | "groups";
type GroupsView = "menu" | "virtual_folder" | "virtual_group";

export default function AddItemModal({
  collectionId,
  defaultStrategy = "",
  parentId = null,
  initialPath,
  onSuccess,
  onClose,
}: AddItemModalProps) {
  const [mode, setMode] = useState<ModalMode>("item");
  const [groupsView, setGroupsView] = useState<GroupsView>("menu");
  const mouseDownOnOverlay = useRef(false);
  const flow = useAddItemFlow({ collectionId, defaultStrategy, parentId, initialPath, onSuccess });

  function switchMode(next: ModalMode) {
    flow.setError(null);
    setMode(next);
    if (next === "item") setGroupsView("menu");
  }

  const steps: StepInfo[] = [
    { key: "pick", label: flow.pickMode === "file" && flow.folderPath ? "File" : "Folder" },
    { key: "details", label: "Details" },
    ...(flow.schema.length > 0 ? [{ key: "metadata", label: "Config" }] : []),
  ];
  const currentStepIndex = steps.findIndex((s) => s.key === flow.step);
  const step: Step = flow.step;

  return createPortal(
    <div
      className={styles.overlay}
      onMouseDown={(e) => { mouseDownOnOverlay.current = e.target === e.currentTarget; }}
      onMouseUp={(e) => { if (mouseDownOnOverlay.current && e.target === e.currentTarget) onClose(); }}
    >
      <div className={styles.shell} onMouseDown={(e) => e.stopPropagation()}>
        {/* ── Mode tab bar ── */}
        <div className={styles.tabBar}>
          <button className={mode === "item" ? `${styles.tab} ${styles.tabActive}` : styles.tab} onClick={() => switchMode("item")}>
            Add Item
          </button>
          <button className={mode === "groups" ? `${styles.tab} ${styles.tabActive}` : styles.tab} onClick={() => switchMode("groups")}>
            Organise
          </button>
          <div className={styles.tabBarClose}>
            <button className={styles.close} onClick={onClose}><X size={14} /></button>
          </div>
        </div>

        {/* ── Sliding panels ── */}
        <div className={mode === "groups" ? `${styles.panels} ${styles.panelsGroups}` : styles.panels}>
          {/* Item panel */}
          <div className={styles.panel}>
            <div className={styles.header}>
              <div className={styles.title}>Add Item</div>
              <div className={styles.subtitle}>
                {step === "pick" && "Choose a folder or file"}
                {step === "details" && "Name and type"}
                {step === "metadata" && "Configure settings"}
              </div>
            </div>

            <StepBar steps={steps} current={currentStepIndex} />

            <div className={styles.body}>
              {step === "pick" && (
                <PickStep folderPath={flow.folderPath} pickMode={flow.pickMode} onPick={flow.pick} />
              )}
              {step === "details" && (
                <DetailsStep
                  folderPath={flow.folderPath}
                  pickMode={flow.pickMode}
                  name={flow.name}
                  onNameChange={flow.setName}
                  strategyType={flow.strategyType}
                  onStrategyChange={flow.setStrategyType}
                  strategies={flow.strategies}
                  collectionId={flow.collectionId}
                  onCollectionChange={flow.setCollectionId}
                />
              )}
              {step === "metadata" && (
                <MetadataStep
                  schema={flow.schema}
                  values={flow.metaValues}
                  onChange={flow.setMetaValue}
                  basePath={flow.folderPath}
                  gameSuggestions={flow.gameSuggestions ?? undefined}
                  onLoadMoreSuggestions={flow.loadMoreSuggestions}
                  loadingMoreSuggestions={flow.suggestLoadingMore}
                  noMoreSuggestions={flow.suggestMaxDepth}
                />
              )}
            </div>

            {flow.error && mode === "item" && <div className={styles.error}>{flow.error}</div>}

            <div className={styles.footer}>
              {step !== "pick"
                ? <button className={`${form.btn} ${form.btnGhost}`} onClick={flow.back} disabled={flow.submitting}>
                    <ChevronLeft size={13} />Back
                  </button>
                : <span />
              }
              <div className={styles.footerRight}>
                {step === "pick" && flow.folderPath && (
                  <button className={`${form.btn} ${form.btnPrimary}`} onClick={() => flow.setStep("details")}>
                    Continue <ChevronRight size={13} />
                  </button>
                )}
                {step === "details" && (
                  <button className={`${form.btn} ${form.btnPrimary}`} onClick={flow.detailsNext} disabled={flow.submitting}>
                    {flow.schema.length > 0
                      ? <>Continue <ChevronRight size={13} /></>
                      : <><Plus size={13} /> Add Item</>}
                  </button>
                )}
                {step === "metadata" && (
                  <button className={`${form.btn} ${form.btnPrimary}`} onClick={flow.submit} disabled={flow.submitting}>
                    <Plus size={13} /> {flow.submitting ? "Adding…" : "Add Item"}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Groups panel */}
          <div className={styles.panel}>
            <div className={styles.header}>
              <div className={styles.title}>
                {groupsView === "menu" ? "Organise" : groupsView === "virtual_folder" ? "New Folder" : "New Group"}
              </div>
              <div className={styles.subtitle}>
                {groupsView === "menu" ? "Create a structural item" : groupsView === "virtual_folder" ? "Virtual sub-category" : "Inline expandable group"}
              </div>
            </div>

            <div className={styles.body}>
              {groupsView === "menu" && (
                <GroupsMenu
                  onFolder={() => setGroupsView("virtual_folder")}
                  onGroup={() => setGroupsView("virtual_group")}
                />
              )}
              {(groupsView === "virtual_folder" || groupsView === "virtual_group") && (
                <VirtualForm
                  key={groupsView}
                  label={groupsView === "virtual_folder" ? "Folder" : "Group"}
                  placeholder={groupsView === "virtual_folder" ? "e.g. Action Games, 2024 Papers" : "e.g. Favorites, In Progress"}
                  strategyType={groupsView}
                  collectionId={flow.collectionId}
                  parentId={parentId}
                  onBack={() => { setGroupsView("menu"); flow.setError(null); }}
                  onCreated={onSuccess}
                  submitting={flow.submitting}
                  setSubmitting={flow.setSubmitting}
                  setError={flow.setError}
                />
              )}
            </div>

            {flow.error && mode === "groups" && groupsView !== "menu" && (
              <div className={styles.error}>{flow.error}</div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
