/**
 * Collapsible mods file-tree preview for a user-set mod folder: loads the
 * tree lazily on first expand and renders it with per-directory toggles,
 * everything collapsed by default.
 */
import { useState } from "react";
import { ChevronDown, ChevronRight, File, Folder, Package } from "lucide-react";
import { folderTree, FolderTreeNode } from "@/services/tauriCommands";
import { formatFileSize } from "@/utils/formatFileSize";
import styles from "./ModsCard.module.css";

/** Levels of children fetched from the backend in one go. */
const TREE_DEPTH = 6;

interface ModsCardProps {
  /** Absolute path of the mod folder. */
  folder: string;
}

/**
 * Renders the collapsible mods tree.
 */
export default function ModsCard({ folder }: ModsCardProps) {
  const [open, setOpen] = useState(false);
  const [tree, setTree] = useState<FolderTreeNode | null>(null);
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && tree === null) {
      folderTree(folder, TREE_DEPTH)
        .then(setTree)
        .catch((e) => setError(String(e)));
    }
  }

  return (
    <div className={styles.card}>
      <button className={styles.header} onClick={toggle}>
        {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        <Package size={13} />
        <span className={styles.title}>Mods</span>
        {tree !== null && <span className={styles.count}>{tree.children.length}</span>}
      </button>

      {open && (
        <div className={styles.body}>
          {error && <p className={styles.error}>{error}</p>}
          {tree !== null && tree.children.length === 0 && !error && (
            <p className={styles.empty}>The mod folder is empty.</p>
          )}
          {tree !== null && tree.children.map((child) => (
            <TreeRow key={child.path} node={child} depth={0} />
          ))}
          {tree?.truncated && <p className={styles.empty}>Listing truncated — open the folder to see everything.</p>}
        </div>
      )}
    </div>
  );
}

/** One tree row; directories expand on click, collapsed by default. */
function TreeRow({ node, depth }: { node: FolderTreeNode; depth: number }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        className={styles.treeRow}
        style={{ paddingLeft: 8 + depth * 16 }}
        onClick={() => node.is_dir && setOpen((v) => !v)}
        disabled={!node.is_dir}
      >
        {node.is_dir
          ? (open ? <ChevronDown size={11} /> : <ChevronRight size={11} />)
          : <span className={styles.chevronPad} />}
        {node.is_dir ? <Folder size={12} className={styles.dirIcon} /> : <File size={12} className={styles.fileIcon} />}
        <span className={styles.nodeName}>{node.name}</span>
        {!node.is_dir && node.size > 0 && (
          <span className={styles.nodeSize}>{formatFileSize(node.size)}</span>
        )}
      </button>
      {open && node.children.map((child) => (
        <TreeRow key={child.path} node={child} depth={depth + 1} />
      ))}
      {open && node.truncated && (
        <span className={styles.truncNote} style={{ paddingLeft: 8 + (depth + 1) * 16 }}>…</span>
      )}
    </>
  );
}
