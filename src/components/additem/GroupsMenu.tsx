/**
 * "Organise" mode menu: pick between creating a virtual folder or a
 * virtual group. Decorative per-option colors are data, not theme tokens.
 */
import { FolderClosed, Layers, ChevronRight } from "lucide-react";
import styles from "./GroupsMenu.module.css";

const OPTIONS = [
  {
    key: "folder" as const,
    icon: <FolderClosed size={17} />,
    label: "Folder",
    desc: "Virtual sub-category. Click in to browse contents.",
    color: "#f97316",
  },
  {
    key: "group" as const,
    icon: <Layers size={17} />,
    label: "Group",
    desc: "Shows all contents inline — no need to open.",
    color: "#8b5cf6",
  },
];

interface GroupsMenuProps {
  onFolder: () => void;
  onGroup: () => void;
}

/**
 * Renders the two structural-item choices.
 */
export default function GroupsMenu({ onFolder, onGroup }: GroupsMenuProps) {
  return (
    <div className={styles.stack}>
      <p className={styles.intro}>Structural items to organise your collection.</p>
      {OPTIONS.map((o) => (
        <button
          key={o.key}
          className={styles.card}
          onClick={o.key === "folder" ? onFolder : onGroup}
          style={{ "--card-color": o.color } as React.CSSProperties}
        >
          <div
            className={styles.icon}
            style={{ background: `color-mix(in srgb, ${o.color} 15%, var(--color-bg-secondary))`, color: o.color }}
          >
            {o.icon}
          </div>
          <div className={styles.text}>
            <span className={styles.label}>{o.label}</span>
            <span className={styles.desc}>{o.desc}</span>
          </div>
          <ChevronRight size={13} className={styles.chevron} />
        </button>
      ))}
    </div>
  );
}
