/**
 * Games page — browse all libraries as a card grid, compact grid, expandable list, or table.
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
  LayoutGrid,
  List,
  LayoutList,
  Table2,
} from "lucide-react";
import { collectionReorder } from "@/services/tauriCommands";
import { Collection, NewCollection } from "@/types/collection";
import { useCollections } from "@/hooks/useCollections";
import { readAppPrefs } from "@/hooks/useAppPrefs";
import Card from "@/components/common/Card";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import CollectionModal from "@/pages/NewCollectionModal";
import CollectionCard from "@/components/games/CollectionCard";
import CompactCard from "@/components/games/CompactCard";
import CollectionSection from "@/components/games/CollectionSection";

type ViewMode = "card" | "compact" | "list" | "table";

/**
 * Displays all collections in a card grid or expandable list, with create/delete actions.
 */
export default function GamesPage() {
  const [view, setView] = useState<ViewMode>(
    () => (localStorage.getItem("games-view") as ViewMode | null) ?? readAppPrefs().defaultGamesView
  );

  function handleSetView(v: ViewMode) {
    localStorage.setItem("games-view", v);
    setView(v);
  }

  return (
    <div className="fp">
      <div className="fp-header">
        <h1 className="fp-title">Games</h1>
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

// ─── List View ────────────────────────────────────────────────────────────────

function ListView() {
  const { collections, loading, error } = useCollections();
  if (loading) return <LoadingSpinner message="Loading collections..." />;
  if (error) return <div className="cv-error">Failed to load collections: {error}</div>;
  return (
    <div className="lv">
      {collections.map((c) => <CollectionSection key={c.id} collection={c} />)}
      {collections.length === 0 && (
        <p className="lv-empty">No collections yet.</p>
      )}
    </div>
  );
}

// ─── Table View ───────────────────────────────────────────────────────────────

function TableView() {
  const navigate = useNavigate();
  const { collections, loading, error } = useCollections();
  if (loading) return <LoadingSpinner message="Loading collections..." />;
  if (error) return <div className="cv-error">Failed to load collections: {error}</div>;
  return (
    <div className="tv">
      <table className="tv-table">
        <thead>
          <tr>
            <th className="tv-th">Name</th>
            <th className="tv-th">Description</th>
          </tr>
        </thead>
        <tbody>
          {collections.map((c) => (
            <tr key={c.id} className="tv-row" onClick={() => navigate(`/collections/${c.id}`)}>
              <td className="tv-td">
                <span className="tv-dot" style={{ background: c.color }} />
                {c.name}
              </td>
              <td className="tv-td tv-td--muted">{c.description || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <style>{`
        .tv { overflow-x: auto; }
        .tv-table { width: 100%; border-collapse: collapse; }
        .tv-th { text-align: left; font-size: 11.5px; font-weight: 600; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.06em; padding: var(--space-2) var(--space-3); border-bottom: 1px solid var(--color-border); }
        .tv-row { cursor: pointer; transition: background var(--transition-fast); }
        .tv-row:hover td { background: var(--color-bg-secondary); }
        .tv-td { padding: var(--space-2) var(--space-3); font-size: 13px; color: var(--color-text-primary); border-bottom: 1px solid var(--color-border-subtle); display: table-cell; align-items: center; gap: var(--space-2); }
        .tv-td--muted { color: var(--color-text-muted); font-size: 12px; }
        .tv-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: var(--space-2); flex-shrink: 0; }
        .lv { display: flex; flex-direction: column; gap: var(--space-2); }
        .lv-empty { color: var(--color-text-muted); font-size: 13px; }
      `}</style>
    </div>
  );
}