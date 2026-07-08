/**
 * Sticky header for the collection view: back button, breadcrumb trail,
 * view toggle, item count, selection toggle, edit and add actions.
 */
import { ArrowLeft, ChevronRight, LayoutGrid, Image, LayoutList, CheckSquare, Pencil, Plus } from "lucide-react";
import { Collection } from "@/types/collection";
import { BreadcrumbEntry } from "@/hooks/useCollectionBrowse";
import ViewToggle, { ViewOption } from "@/components/common/ViewToggle";
import styles from "./CollectionHeader.module.css";

/** The collection view display modes. */
export type ItemViewMode = "grid" | "gallery" | "list";

const VIEW_OPTIONS: ViewOption<ItemViewMode>[] = [
  { value: "grid",    icon: <LayoutGrid size={13} />, title: "Grid view" },
  { value: "gallery", icon: <Image size={13} />,      title: "Gallery view" },
  { value: "list",    icon: <LayoutList size={13} />, title: "List view" },
];

interface CollectionHeaderProps {
  collection: Collection;
  folderStack: BreadcrumbEntry[];
  isAtRoot: boolean;
  totalCount: number;
  viewMode: ItemViewMode;
  onViewModeChange: (mode: ItemViewMode) => void;
  selectionMode: boolean;
  onToggleSelectionMode: () => void;
  onBack: () => void;
  onNavigateUp: (depth: number) => void;
  onEdit: () => void;
  onAdd: () => void;
}

/**
 * Renders the collection page header with breadcrumbs and toolbar actions.
 */
export default function CollectionHeader({
  collection,
  folderStack,
  isAtRoot,
  totalCount,
  viewMode,
  onViewModeChange,
  selectionMode,
  onToggleSelectionMode,
  onBack,
  onNavigateUp,
  onEdit,
  onAdd,
}: CollectionHeaderProps) {
  return (
    <div className={styles.header}>
      <button className={styles.back} onClick={onBack}>
        <ArrowLeft size={14} />
        <span>Back</span>
      </button>
      <div className={styles.divider} />
      <div className={styles.accentDot} style={{ background: collection.color }} />

      <div className={styles.breadcrumb}>
        <button
          className={isAtRoot ? `${styles.crumbSeg} ${styles.crumbActive}` : styles.crumbSeg}
          onClick={() => onNavigateUp(-1)}
        >
          {collection.name}
        </button>
        {folderStack.map((entry, i) => (
          <span key={entry.item.id} className={styles.crumbItem}>
            <ChevronRight size={12} className={styles.crumbSep} />
            <button
              className={i === folderStack.length - 1 ? `${styles.crumbSeg} ${styles.crumbActive}` : styles.crumbSeg}
              onClick={() => onNavigateUp(i)}
            >
              {entry.item.name}
            </button>
          </span>
        ))}
        {collection.description && isAtRoot && (
          <p className={styles.desc}>{collection.description}</p>
        )}
      </div>

      <div className={styles.right}>
        <ViewToggle options={VIEW_OPTIONS} value={viewMode} onChange={onViewModeChange} />
        <span className={styles.count}>
          <LayoutGrid size={12} />
          {totalCount} {totalCount === 1 ? "item" : "items"}
        </span>
        <button
          className={selectionMode ? `${styles.selectBtn} ${styles.selectActive}` : styles.selectBtn}
          onClick={onToggleSelectionMode}
          title={selectionMode ? "Exit selection mode" : "Select items"}
        >
          <CheckSquare size={13} />
          {selectionMode ? "Done" : "Select"}
        </button>
        {isAtRoot && (
          <button className={styles.editBtn} onClick={onEdit} title="Edit collection">
            <Pencil size={13} />
          </button>
        )}
        <button className={styles.addBtn} onClick={onAdd}>
          <Plus size={14} />
          Add
        </button>
      </div>
    </div>
  );
}
