/**
 * Collapsible mods file browser for a user-set mod folder. Each directory's
 * children are fetched only when it is expanded (`folder_children`), so a deep
 * mod folder is never walked several levels up front — that shallow, on-demand
 * read is what keeps huge folders (hundreds of mods) responsive. The root is
 * loaded and shown expanded when the card first opens.
 */
import { useState } from "react";
import { ChevronDown, ChevronRight, File, Folder, Package } from "lucide-react";
import { folderChildren, FolderTreeNode } from "@/services/tauriCommands";
import { formatFileSize } from "@/utils/formatFileSize";
import styles from "./ModsCard.module.css";

interface ModsCardProps {
  /** Absolute path of the mod folder. */
  folder: string;
}

/**
 * Renders the collapsible mods browser; the root loads on first card open.
 */
export default function ModsCard({ folder }: ModsCardProps) {
  const [open, setOpen] = useState(false);
  const [root, setRoot] = useState<{ entries: FolderTreeNode[]; truncated: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && root === null) {
      folderChildren(folder)
        .then(setRoot)
        .catch((e) => setError(String(e)));
    }
  }

  return (
    <div className={styles.card}>
      <button className={styles.header} onClick={toggle}>
        {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        <Package size={13} />
        <span className={styles.title}>Mods</span>
        {root !== null && <span className={styles.count}>{root.entries.length}</span>}
      </button>

      {open && (
        <div className={styles.body}>
          {error && <p className={styles.error}>{error}</p>}
          {root !== null && root.entries.length === 0 && !error && (
            <p className={styles.empty}>The mod folder is empty.</p>
          )}
          {root?.entries.map((node) => (
            <TreeRow key={node.path} node={node} depth={0} />
          ))}
          {root?.truncated && (
            <p className={styles.empty}>Listing truncated — open the folder to see everything.</p>
          )}
        </div>
      )}
    </div>
  );
}

/** One tree row; a directory fetches its children the first time it expands. */
function TreeRow({ node, depth }: { node: FolderTreeNode; depth: number }) {
  const [open, setOpen] = useState(false);
  const [children, setChildren] = useState<{ entries: FolderTreeNode[]; truncated: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    if (!node.is_dir) return;
    const next = !open;
    setOpen(next);
    if (next && children === null) {
      setLoading(true);
      folderChildren(node.path)
        .then(setChildren)
        .catch((e) => setError(String(e)))
        .finally(() => setLoading(false));
    }
  }

  return (
    <>
      <button
        className={styles.treeRow}
        style={{ paddingLeft: 8 + depth * 16 }}
        onClick={toggle}
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
      {open && loading && (
        <span className={styles.loadingRow} style={{ paddingLeft: 8 + (depth + 1) * 16 }}>Loading…</span>
      )}
      {open && error && (
        <span className={styles.error} style={{ paddingLeft: 8 + (depth + 1) * 16 }}>{error}</span>
      )}
      {open && children?.entries.map((child) => (
        <TreeRow key={child.path} node={child} depth={depth + 1} />
      ))}
      {open && children?.truncated && (
        <span className={styles.truncNote} style={{ paddingLeft: 8 + (depth + 1) * 16 }}>…more</span>
      )}
    </>
  );
}
