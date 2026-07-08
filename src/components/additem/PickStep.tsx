/**
 * First add-item step: choose whether to add a folder or a single file.
 */
import { FolderOpen, FileText } from "lucide-react";
import { PickMode } from "@/hooks/useAddItemFlow";
import PathPickerButton from "./PathPickerButton";
import styles from "./PickStep.module.css";

interface PickStepProps {
  folderPath: string;
  pickMode: PickMode;
  onPick: (mode: PickMode) => void;
}

/**
 * Renders the folder/file pick targets.
 */
export default function PickStep({ folderPath, pickMode, onPick }: PickStepProps) {
  return (
    <div className={styles.stack}>
      <p className={styles.intro}>Choose what you want to add to this collection.</p>
      <PathPickerButton
        icon={<FolderOpen size={16} />}
        idleLabel="Add Folder"
        selectedLabel="Folder selected"
        idleHint="Browse for a folder"
        value={pickMode === "folder" ? folderPath : ""}
        onClick={() => onPick("folder")}
      />
      <PathPickerButton
        icon={<FileText size={16} />}
        idleLabel="Add File"
        selectedLabel="File selected"
        idleHint="Browse for a single file"
        value={pickMode === "file" ? folderPath : ""}
        onClick={() => onPick("file")}
      />
    </div>
  );
}
