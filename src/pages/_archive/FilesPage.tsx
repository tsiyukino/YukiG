/**
 * Files page — browse all collections as a card grid, compact grid, expandable list, or table.
 *
 * Four view modes are available via a toggle in the header:
 * - Card: large visual cards in a responsive grid
 * - Compact: smaller, denser grid cards
 * - List: expandable accordion sections with inline items
 * - Table: flat rows with sortable columns
 */
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  FolderOpen,
  Trash2,
  ChevronRight,
  LayoutGrid,
  List,
  LayoutList,
  Table2,
} from "lucide-react";
import { collectionGetAll, itemGetByCollection, collectionReorder } from "@/services/tauriCommands";
import { Collection, NewCollection } from "@/types/collection";
import { Item } from "@/types/item";
import { useCollections } from "@/hooks/useCollections";
import Card from "@/components/common/Card";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import CollectionModal from "@/pages/NewCollectionModal";
import { strategyLabel } from "@/utils/strategyLabel";
import { convertFileSrc } from "@tauri-apps/api/core";

type ViewMode = "card" | "compact" | "list" | "table";

/**
 * Displays all collections in a card grid or expandable list, with create/delete actions.
 */
export default function FilesPage() {
  const [view, setView] = useState<ViewMode>(
    () => (localStorage.getItem("files-view") as ViewMode | null) ?? "card"
  );

  function handleSetView(v: ViewMode) {
    localStorage.setItem("files-view", v);
    setView(v);
  }

  return (
    <div className="fp">
      <div className="fp-header">
        <h1 className="fp-title">Files</h1>
        <div className="fp-view-toggle">
          <button
            className={`fp-toggle-btn ${view === "card" ? "fp-toggle-btn--active" : ""}`}
            onClick={() => handleSetView("card")}
            title="Card view"
          >
            <LayoutGrid size={14} />
          </button>
          <button
            className={`fp-toggle-btn ${view === "compact" ? "fp-toggle-btn--active" : ""}`}
            onClick={() => handleSetView("compact")}
            title="Compact view"
          >
            <LayoutList size={14} />
          </button>
          <button
            className={`fp-toggle-btn ${view === "list" ? "fp-toggle-btn--active" : ""}`}
            onClick={() => handleSetView("list")}
            title="List view"
          >
            <List size={14} />
          </button>
          <button
            className={`fp-toggle-btn ${view === "table" ? "fp-toggle-btn--active" : ""}`}
            onClick={() => handleSetView("table")}
            title="Table view"
          >
            <Table2 size={14} />
          </button>
        </div>
      </div>

      {view === "card" && <CardView />}
      {view === "compact" && <CompactView />}
      {view === "list" && <ListView />}
      {view === "table" && <TableView />}

      <style>{`
        .fp { width: 100%; display: flex; flex-direction: column; gap: var(--space-5); }
        .fp-header {
          position: sticky;
          top: calc(-1 * var(--space-4));
          z-index: 10;
          background: var(--color-bg);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-top: var(--space-4);
          padding-bottom: var(--space-5);
          border-bottom: 1px solid var(--color-border-subtle);
          margin-bottom: calc(-1 * var(--space-5));
        }
        .fp-header-left { display: flex; flex-direction: column; gap: 2px; }
        .fp-view-toggle {
          display: flex;
          align-items: center;
          gap: 2px;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          padding: 2px;
          background: var(--color-bg-secondary);
        }
        .fp-toggle-btn {
          display: flex; align-items: center; justify-content: center;
          width: 28px; height: 28px;
          border-radius: calc(var(--radius-sm) - 1px);
          color: var(--color-text-muted);
          transition: background var(--transition-fast), color var(--transition-fast);
        }
        .fp-toggle-btn:hover { color: var(--color-text-primary); }
        .fp-title { font-size: 22px; font-weight: 700; letter-spacing: -0.025em; color: var(--color-text-primary); }
        .fp-toggle-btn--active {
          background: var(--color-bg);
          color: var(--color-text-primary);
          box-shadow: 0 1px 2px rgba(0,0,0,0.06);
        }
      `}</style>
    </div>
  );
}

// ─── Card View ────────────────────────────────────────────────────────────────

function CardView() {
  const navigate = useNavigate();
  const { collections: rawCollections, loading, error, createCollection, deleteCollection } = useCollections();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [showNewModal, setShowNewModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Collection | null>(null);
  const dragIndexRef = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Sync local order state from hook whenever raw data changes
  useEffect(() => { setCollections(rawCollections); }, [rawCollections]);

  async function handleCreate(input: NewCollection) {
    await createCollection(input);
    setShowNewModal(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await deleteCollection(deleteTarget.id);
    setDeleteTarget(null);
  }

  function handleDragStart(index: number) {
    dragIndexRef.current = index;
    setDraggingIndex(index);
  }


  async function handleDrop(dropIndex: number) {
    const from = dragIndexRef.current;
    setDragOverIndex(null);
    setDraggingIndex(null);
    if (from === null || from === dropIndex) return;
    const next = [...collections];
    const [moved] = next.splice(from, 1);
    next.splice(dropIndex, 0, moved);
    setCollections(next);
    dragIndexRef.current = null;
    await collectionReorder(next.map((c, i) => [c.id, i])).catch(() => {});
  }

  if (loading) return <LoadingSpinner message="Loading collections..." />;
  if (error) return <div className="cv-error">Failed to load collections: {error}</div>;

  return (
    <>
      <div className="collections-grid" ref={gridRef} onDrop={(e) => { e.preventDefault(); if (dragOverIndex !== null) handleDrop(dragOverIndex); }} onDragOver={(e) => e.preventDefault()}>
        {collections.map((collection, index) => (
          <div key={collection.id} className="cv-drag-wrapper">
            {dragOverIndex === index && draggingIndex !== null && draggingIndex !== index && dragOverIndex < draggingIndex && (
              <div className="cv-drop-slot" />
            )}
            <div
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverIndex(index); }}
              onDragEnd={() => { setDragOverIndex(null); setDraggingIndex(null); }}
              className={`cv-drag-item${draggingIndex === index ? " cv-drag-item--dragging" : ""}`}
            >
              <CollectionCard
                collection={collection}
                onClick={() => navigate(`/collections/${collection.id}`)}
                onDelete={(e) => { e.stopPropagation(); setDeleteTarget(collection); }}
              />
            </div>
            {dragOverIndex === index && draggingIndex !== null && draggingIndex !== index && dragOverIndex > draggingIndex && (
              <div className="cv-drop-slot" />
            )}
          </div>
        ))}

        <Card onClick={() => setShowNewModal(true)} className="new-collection-card">
          <div className="new-collection-inner">
            <div className="new-collection-icon">
              <Plus size={20} color="var(--color-text-muted)" strokeWidth={1.5} />
            </div>
            <span className="new-collection-label">New Collection</span>
          </div>
        </Card>
      </div>

      {showNewModal && (
        <CollectionModal
          submitLabel="Create"
          onConfirm={handleCreate}
          onCancel={() => setShowNewModal(false)}
        />
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete Collection"
        message={`Delete "${deleteTarget?.name}"? This will also delete all items inside it. This cannot be undone.`}
        confirmLabel="Delete Collection"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <style>{`
        .cv-error { color: var(--color-danger); font-size: 14px; }
        .cv-drag-wrapper { display: contents; }
        .cv-drag-item { border-radius: var(--radius-md); cursor: grab; transition: opacity 200ms; }
        .cv-drag-item--dragging { opacity: 0.35; }
        .cv-drop-slot {
          border-radius: var(--radius-md);
          border: 2px dashed var(--color-accent);
          background: var(--color-accent-light);
          min-height: 160px;
          animation: cv-slot-appear 150ms ease;
        }
        @keyframes cv-slot-appear { from { opacity: 0; transform: scaleY(0.85); } to { opacity: 1; transform: scaleY(1); } }
        .collections-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: var(--space-4);
        }
        .new-collection-card {
          min-height: 160px;
          border-style: dashed !important;
          border-color: var(--color-border) !important;
          background: transparent !important;
          box-shadow: none !important;
        }
        .new-collection-inner {
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          gap: var(--space-2); height: 160px;
        }
        .new-collection-icon {
          width: 40px; height: 40px;
          border-radius: var(--radius-md);
          border: 1.5px dashed var(--color-border);
          display: flex; align-items: center; justify-content: center;
        }
        .new-collection-label { font-size: 12.5px; color: var(--color-text-muted); font-weight: 500; }
      `}</style>
    </>
  );
}

// ─── Compact View ─────────────────────────────────────────────────────────────

function CompactView() {
  const navigate = useNavigate();
  const { collections, loading, error, createCollection, deleteCollection } = useCollections();
  const [showNewModal, setShowNewModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Collection | null>(null);

  async function handleCreate(input: NewCollection) {
    await createCollection(input);
    setShowNewModal(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await deleteCollection(deleteTarget.id);
    setDeleteTarget(null);
  }

  if (loading) return <LoadingSpinner message="Loading collections..." />;
  if (error) return <div className="cv-error">Failed to load collections: {error}</div>;

  return (
    <>
      <div className="compact-grid">
        {collections.map((collection) => (
          <CompactCard
            key={collection.id}
            collection={collection}
            onClick={() => navigate(`/collections/${collection.id}`)}
            onDelete={(e) => { e.stopPropagation(); setDeleteTarget(collection); }}
          />
        ))}
        <button className="compact-new" onClick={() => setShowNewModal(true)}>
          <Plus size={14} color="var(--color-text-muted)" strokeWidth={1.5} />
          <span>New Collection</span>
        </button>
      </div>

      {showNewModal && (
        <CollectionModal
          submitLabel="Create"
          onConfirm={handleCreate}
          onCancel={() => setShowNewModal(false)}
        />
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete Collection"
        message={`Delete "${deleteTarget?.name}"? This will also delete all items inside it. This cannot be undone.`}
        confirmLabel="Delete Collection"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <style>{`
        .compact-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
          gap: var(--space-2);
        }
        .compact-new {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: var(--space-1);
          height: 80px;
          border-radius: var(--radius-md);
          border: 1.5px dashed var(--color-border);
          color: var(--color-text-muted);
          font-size: 11.5px; font-weight: 500;
          transition: border-color var(--transition-fast), color var(--transition-fast);
        }
        .compact-new:hover { border-color: var(--color-accent); color: var(--color-accent); }
      `}</style>
    </>
  );
}

interface CompactCardProps {
  collection: Collection;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
}

function CompactCard({ collection, onClick, onDelete }: CompactCardProps) {
  const initials = collection.name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <button className="ccrd" onClick={onClick}>
      <div className="ccrd-top" style={{ background: `${collection.color}16` }}>
        <div className="ccrd-icon" style={{ background: `${collection.color}30`, color: collection.color }}>
          {initials || <FolderOpen size={13} color={collection.color} />}
        </div>
        <button className="ccrd-del" onClick={onDelete} title="Delete">
          <Trash2 size={11} />
        </button>
      </div>
      <div className="ccrd-label">{collection.name}</div>

      <style>{`
        .ccrd {
          display: flex; flex-direction: column;
          border-radius: var(--radius-md);
          border: 1px solid var(--color-border);
          overflow: hidden;
          background: var(--color-bg);
          transition: box-shadow var(--transition-fast), border-color var(--transition-fast);
          text-align: left;
          cursor: pointer;
        }
        .ccrd:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.07); border-color: var(--color-accent); }
        .ccrd-top {
          display: flex; align-items: flex-start; justify-content: space-between;
          padding: var(--space-2) var(--space-2) var(--space-1);
        }
        .ccrd-icon {
          width: 32px; height: 32px;
          border-radius: var(--radius-sm);
          display: flex; align-items: center; justify-content: center;
          font-size: 12px; font-weight: 700;
        }
        .ccrd-del {
          opacity: 0; display: flex; align-items: center; justify-content: center;
          width: 20px; height: 20px; border-radius: var(--radius-sm);
          color: var(--color-text-muted);
          transition: opacity var(--transition-fast), color var(--transition-fast), background var(--transition-fast);
        }
        .ccrd:hover .ccrd-del { opacity: 1; }
        .ccrd-del:hover { color: var(--color-danger); background: var(--color-danger-light); }
        .ccrd-label {
          padding: var(--space-1) var(--space-2) var(--space-2);
          font-size: 12px; font-weight: 600;
          color: var(--color-text-primary);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
      `}</style>
    </button>
  );
}

// ─── Table View ───────────────────────────────────────────────────────────────

type SortField = "name" | "strategy" | "created_at";
type SortDir = "asc" | "desc";

function TableView() {
  const navigate = useNavigate();
  const { collections, loading, error, createCollection, deleteCollection } = useCollections();
  const [showNewModal, setShowNewModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Collection | null>(null);
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  async function handleCreate(input: NewCollection) {
    await createCollection(input);
    setShowNewModal(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await deleteCollection(deleteTarget.id);
    setDeleteTarget(null);
  }

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  if (loading) return <LoadingSpinner message="Loading collections..." />;
  if (error) return <div className="cv-error">Failed to load collections: {error}</div>;

  const sorted = [...collections].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    if (sortField === "name") return a.name.localeCompare(b.name) * dir;
    if (sortField === "strategy") return a.default_strategy.localeCompare(b.default_strategy) * dir;
    if (sortField === "created_at") return a.created_at.localeCompare(b.created_at) * dir;
    return 0;
  });

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <span className="tv-sort-icon tv-sort-icon--inactive">↕</span>;
    return <span className="tv-sort-icon">{sortDir === "asc" ? "↑" : "↓"}</span>;
  }

  return (
    <>
      <div className="tv-wrap">
        <table className="tv-table">
          <thead>
            <tr>
              <th className="tv-th tv-th--color" />
              <th className="tv-th tv-th--sortable" onClick={() => handleSort("name")}>
                Name <SortIcon field="name" />
              </th>
              <th className="tv-th">Description</th>
              <th className="tv-th tv-th--sortable" onClick={() => handleSort("strategy")}>
                Strategy <SortIcon field="strategy" />
              </th>
              <th className="tv-th tv-th--sortable" onClick={() => handleSort("created_at")}>
                Created <SortIcon field="created_at" />
              </th>
              <th className="tv-th tv-th--actions" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((col) => {
              const initials = col.name
                .split(" ")
                .slice(0, 2)
                .map((w) => w[0]?.toUpperCase() ?? "")
                .join("");
              const created = new Date(col.created_at).toLocaleDateString(undefined, {
                year: "numeric", month: "short", day: "numeric",
              });
              return (
                <tr
                  key={col.id}
                  className="tv-row"
                  onClick={() => navigate(`/collections/${col.id}`)}
                >
                  <td className="tv-td tv-td--color">
                    <span className="tv-dot" style={{ background: col.color }} />
                  </td>
                  <td className="tv-td tv-td--name">
                    <div className="tv-name-cell">
                      <div
                        className="tv-icon"
                        style={{ background: `${col.color}22`, color: col.color }}
                      >
                        {initials || <FolderOpen size={11} color={col.color} />}
                      </div>
                      <span className="tv-name">{col.name}</span>
                    </div>
                  </td>
                  <td className="tv-td tv-td--desc">
                    <span className="tv-desc">{col.description || "—"}</span>
                  </td>
                  <td className="tv-td">
                    <span
                      className="tv-strategy"
                      style={{ background: `${col.color}16`, color: col.color }}
                    >
                      {col.default_strategy}
                    </span>
                  </td>
                  <td className="tv-td tv-td--date">{created}</td>
                  <td className="tv-td tv-td--actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      className="tv-del"
                      onClick={() => setDeleteTarget(col)}
                      title="Delete collection"
                    >
                      <Trash2 size={12} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <button className="tv-new-row" onClick={() => setShowNewModal(true)}>
          <Plus size={13} strokeWidth={1.5} />
          <span>New Collection</span>
        </button>
      </div>

      {showNewModal && (
        <CollectionModal
          submitLabel="Create"
          onConfirm={handleCreate}
          onCancel={() => setShowNewModal(false)}
        />
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete Collection"
        message={`Delete "${deleteTarget?.name}"? This will also delete all items inside it. This cannot be undone.`}
        confirmLabel="Delete Collection"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <style>{`
        .tv-wrap { display: flex; flex-direction: column; border: 1px solid var(--color-border); border-radius: var(--radius-md); overflow: hidden; }
        .tv-table { width: 100%; border-collapse: collapse; }
        .tv-th {
          padding: var(--space-2) var(--space-3);
          font-size: 11.5px; font-weight: 600;
          color: var(--color-text-muted);
          text-align: left;
          background: var(--color-bg-secondary);
          border-bottom: 1px solid var(--color-border);
          white-space: nowrap;
          user-select: none;
        }
        .tv-th--sortable { cursor: pointer; }
        .tv-th--sortable:hover { color: var(--color-text-primary); }
        .tv-th--color { width: 28px; padding-right: 0; }
        .tv-th--actions { width: 36px; }
        .tv-sort-icon { margin-left: 4px; font-size: 10px; }
        .tv-sort-icon--inactive { opacity: 0.3; }
        .tv-row { cursor: pointer; transition: background var(--transition-fast); }
        .tv-row:hover { background: var(--color-bg-secondary); }
        .tv-row:not(:last-child) .tv-td { border-bottom: 1px solid var(--color-border-subtle); }
        .tv-td { padding: var(--space-2) var(--space-3); font-size: 13px; color: var(--color-text-primary); vertical-align: middle; }
        .tv-td--color { width: 28px; padding-right: 0; }
        .tv-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .tv-td--name { min-width: 160px; }
        .tv-name-cell { display: flex; align-items: center; gap: var(--space-2); }
        .tv-icon {
          width: 26px; height: 26px; border-radius: var(--radius-sm);
          display: flex; align-items: center; justify-content: center;
          font-size: 10px; font-weight: 700; flex-shrink: 0;
        }
        .tv-name { font-weight: 600; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px; }
        .tv-td--desc { max-width: 260px; }
        .tv-desc { font-size: 12.5px; color: var(--color-text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; max-width: 260px; }
        .tv-strategy {
          display: inline-block; padding: 2px 8px;
          border-radius: var(--radius-full);
          font-size: 10.5px; font-weight: 600; text-transform: capitalize;
        }
        .tv-td--date { font-size: 12px; color: var(--color-text-muted); white-space: nowrap; }
        .tv-td--actions { width: 36px; text-align: center; }
        .tv-del {
          opacity: 0; display: inline-flex; align-items: center; justify-content: center;
          width: 24px; height: 24px; border-radius: var(--radius-sm);
          color: var(--color-text-muted);
          transition: opacity var(--transition-fast), color var(--transition-fast), background var(--transition-fast);
        }
        .tv-row:hover .tv-del { opacity: 1; }
        .tv-del:hover { color: var(--color-danger); background: var(--color-danger-light); }
        .tv-new-row {
          display: flex; align-items: center; gap: var(--space-2);
          padding: var(--space-2) var(--space-4);
          font-size: 12.5px; color: var(--color-text-muted);
          border-top: 1px solid var(--color-border);
          background: var(--color-bg-secondary);
          transition: background var(--transition-fast), color var(--transition-fast);
          text-align: left;
        }
        .tv-new-row:hover { background: var(--color-bg-tertiary); color: var(--color-accent); }
      `}</style>
    </>
  );
}

// ─── CollectionCard ───────────────────────────────────────────────────────────

interface CollectionCardProps {
  collection: Collection;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
}

function CollectionCard({ collection, onClick, onDelete }: CollectionCardProps) {
  const initials = collection.name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <Card onClick={onClick}>
      <div className="ccard">
        <div className="ccard-accent" style={{ background: collection.color }} />
        <div className="ccard-body">
          <div
            className="ccard-icon"
            style={{ background: `${collection.color}20`, color: collection.color }}
          >
            {initials || <FolderOpen size={16} color={collection.color} />}
          </div>
          <div className="ccard-info">
            <h2 className="ccard-name">{collection.name}</h2>
            {collection.description && (
              <p className="ccard-desc">{collection.description}</p>
            )}
          </div>
          <span
            className="ccard-strategy"
            style={{ background: `${collection.color}14`, color: collection.color }}
          >
            {collection.default_strategy}
          </span>
        </div>
        <div className="ccard-footer">
          <span className="ccard-footer-label">View collection</span>
          <button className="ccard-delete" onClick={onDelete} title="Delete collection">
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      <style>{`
        .ccard { display: flex; flex-direction: column; overflow: hidden; border-radius: inherit; flex: 1; min-height: 160px; }
        .ccard-accent { height: 4px; width: 100%; flex-shrink: 0; }
        .ccard-body { padding: var(--space-4) var(--space-4) var(--space-3); display: flex; flex-direction: column; gap: var(--space-3); flex: 1; min-height: 0; }
        .ccard-icon { width: 40px; height: 40px; border-radius: var(--radius-md); display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700; letter-spacing: -0.02em; flex-shrink: 0; }
        .ccard-info { flex: 1; min-width: 0; }
        .ccard-name { font-size: 14px; font-weight: 650; color: var(--color-text-primary); letter-spacing: -0.02em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ccard-desc { font-size: 12px; color: var(--color-text-muted); margin-top: 3px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.5; }
        .ccard-strategy { align-self: flex-start; padding: 2px 8px; border-radius: var(--radius-full); font-size: 10.5px; font-weight: 600; text-transform: capitalize; letter-spacing: 0.02em; }
        .ccard-footer { display: flex; align-items: center; justify-content: space-between; padding: var(--space-2) var(--space-3) var(--space-2) var(--space-4); border-top: 1px solid var(--color-border-subtle); background: var(--color-bg-secondary); }
        .ccard-footer-label { font-size: 11.5px; color: var(--color-text-muted); font-weight: 500; transition: color var(--transition-fast); }
        .ccard:hover .ccard-footer-label { color: var(--color-accent); }
        .ccard-delete { display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: var(--radius-sm); opacity: 0; color: var(--color-text-muted); transition: opacity var(--transition-fast), color var(--transition-fast), background var(--transition-fast); }
        .ccard:hover .ccard-delete { opacity: 1; }
        .ccard-delete:hover { color: var(--color-danger); background: var(--color-danger-light); }
      `}</style>
    </Card>
  );
}

// ─── List View ────────────────────────────────────────────────────────────────

function ListView() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    collectionGetAll()
      .then(setCollections)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner message="Loading…" />;
  if (error) return <div className="lv-error">{error}</div>;

  if (collections.length === 0) {
    return (
      <div className="lv-empty">
        <LayoutGrid size={28} color="var(--color-text-muted)" />
        <p>No collections yet. Switch to card view to create one.</p>
      </div>
    );
  }

  return (
    <>
      <div className="lv-list">
        {collections.map((col) => (
          <CollectionSection key={col.id} collection={col} />
        ))}
      </div>
      <style>{`
        .lv-error { color: var(--color-danger); font-size: 14px; }
        .lv-empty { display: flex; flex-direction: column; align-items: center; gap: var(--space-3); padding: 80px; color: var(--color-text-muted); font-size: 13px; text-align: center; }
        .lv-list { display: flex; flex-direction: column; gap: var(--space-3); }
      `}</style>
    </>
  );
}

// ─── CollectionSection ────────────────────────────────────────────────────────

interface CollectionSectionProps {
  collection: Collection;
}

function CollectionSection({ collection }: CollectionSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const navigate = useNavigate();

  async function handleToggle() {
    if (!expanded && items.length === 0) {
      setItemsLoading(true);
      try {
        const data = await itemGetByCollection(collection.id);
        setItems(data);
      } finally {
        setItemsLoading(false);
      }
    }
    setExpanded((v) => !v);
  }

  return (
    <div className="cs">
      <button className="cs-header" onClick={handleToggle}>
        <ChevronRight
          size={14}
          className={`cs-chevron ${expanded ? "cs-chevron--open" : ""}`}
          color={collection.color}
        />
        <span className="cs-dot" style={{ background: collection.color }} />
        <span className="cs-name">{collection.name}</span>
        {collection.description && (
          <span className="cs-desc">{collection.description}</span>
        )}
        <button
          className="cs-open-btn"
          onClick={(e) => { e.stopPropagation(); navigate(`/collections/${collection.id}`); }}
          title="Open collection"
        >
          Open
        </button>
      </button>

      {expanded && (
        <div className="cs-items">
          {itemsLoading ? (
            <span className="cs-loading">Loading…</span>
          ) : items.length === 0 ? (
            <span className="cs-empty">No items in this collection.</span>
          ) : (
            items.map((item) => <FileItem key={item.id} item={item} collection={collection} />)
          )}
        </div>
      )}

      <style>{`
        .cs { border: 1px solid var(--color-border); border-radius: var(--radius-md); overflow: hidden; }
        .cs-header { display: flex; align-items: center; gap: var(--space-2); width: 100%; padding: var(--space-3) var(--space-4); background: var(--color-bg-secondary); text-align: left; transition: background var(--transition-fast); cursor: pointer; }
        .cs-header:hover { background: var(--color-bg-tertiary); }
        .cs-chevron { transition: transform var(--transition-fast); flex-shrink: 0; }
        .cs-chevron--open { transform: rotate(90deg); }
        .cs-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .cs-name { font-size: 13.5px; font-weight: 600; color: var(--color-text-primary); }
        .cs-desc { font-size: 12px; color: var(--color-text-muted); margin-left: var(--space-1); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; min-width: 0; }
        .cs-open-btn { margin-left: auto; flex-shrink: 0; font-size: 11.5px; color: var(--color-accent); padding: 2px 8px; border: 1px solid var(--color-accent); border-radius: var(--radius-sm); opacity: 0; transition: opacity var(--transition-fast); }
        .cs-header:hover .cs-open-btn { opacity: 1; }
        .cs-items { border-top: 1px solid var(--color-border); display: flex; flex-direction: column; }
        .cs-loading, .cs-empty { padding: var(--space-3) var(--space-6); font-size: 12.5px; color: var(--color-text-muted); }
      `}</style>
    </div>
  );
}

// ─── FileItem ─────────────────────────────────────────────────────────────────

interface FileItemProps {
  item: Item;
  collection: Collection;
}

function FileItem({ item, collection }: FileItemProps) {
  const navigate = useNavigate();
  const thumbSrc = item.thumbnail_path ? convertFileSrc(item.thumbnail_path) : null;

  return (
    <button
      className="fi"
      onClick={() => navigate(`/collections/${collection.id}/items/${item.id}`)}
    >
      <div className="fi-icon" style={{ background: `${collection.color}18` }}>
        {thumbSrc ? (
          <img src={thumbSrc} alt="" className="fi-thumb" />
        ) : (
          <FolderOpen size={13} color={collection.color} />
        )}
      </div>
      <span className="fi-name">{item.name}</span>
      <span className="fi-type">{strategyLabel(item.strategy_type)}</span>
      <style>{`
        .fi { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-2) var(--space-4) var(--space-2) var(--space-6); width: 100%; text-align: left; border-bottom: 1px solid var(--color-border-subtle); transition: background var(--transition-fast); cursor: pointer; }
        .fi:last-child { border-bottom: none; }
        .fi:hover { background: var(--color-bg-secondary); }
        .fi-icon { width: 24px; height: 24px; border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; flex-shrink: 0; overflow: hidden; }
        .fi-thumb { width: 24px; height: 24px; object-fit: cover; display: block; }
        .fi-name { flex: 1; font-size: 13px; color: var(--color-text-primary); min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .fi-type { font-size: 11px; color: var(--color-text-muted); text-transform: capitalize; flex-shrink: 0; }
      `}</style>
    </button>
  );
}
