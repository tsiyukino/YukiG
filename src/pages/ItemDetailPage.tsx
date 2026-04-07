/**
 * Item detail view — shows metadata and strategy-specific info for a single item.
 *
 * Renders the item's basic fields (name, path, description, dates) and
 * delegates to the appropriate strategy view component based on
 * item.strategy_type.
 */
import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { ArrowLeft, ExternalLink, FolderOpen, Trash2, Pencil, Camera, Star, Clock } from "lucide-react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { itemGetById, itemDelete, itemUpdate, itemSetFavorite, shellOpenPath, thumbnailGet, thumbnailSet, gameStatusGet, GameStatus } from "@/services/tauriCommands";
import { useExeIcon } from "@/hooks/useExeIcon";
import { Item } from "@/types/item";
import { ItemDetailSkeleton } from "@/components/common/Skeleton";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import GameItemView from "@/components/strategies/GameItemView";
import SteamGameItemView from "@/components/strategies/SteamGameItemView";
import EditItemModal from "@/pages/EditItemModal";
import TagPicker from "@/components/common/TagPicker";
import { useTags } from "@/hooks/useTags";
import { useItemTags } from "@/hooks/useItemTags";
import { formatDate } from "@/utils/formatDate";
import { strategyLabel } from "@/utils/strategyLabel";

/**
 * Dispatches to the correct strategy view component based on strategy_type.
 *
 * @param item - The loaded item record
 */
function StrategyView({ item }: { item: Item }) {
  if (item.strategy_type === "game")
    return <GameItemView itemId={item.id} folderPath={item.folder_path} />;
  if (item.strategy_type === "steam_game")
    return <SteamGameItemView itemId={item.id} folderPath={item.folder_path} />;
  return null;
}

/** Displays full details for a single item including strategy-specific info. */
export default function ItemDetailPage() {
  const { id, itemId } = useParams<{ id: string; itemId: string }>();
  const navigate = useNavigate();
  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [openFolderError, setOpenFolderError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);
  const [thumbnailSrc, setThumbnailSrc] = useState<string | null>(null);
  const [gameStatus, setGameStatus] = useState<GameStatus | null>(null);
  const exeIconSrc = useExeIcon(itemId!, item?.strategy_type ?? "");

  async function handleToggleFavorite() {
    if (!item) return;
    try {
      const updated = await itemSetFavorite(item.id, !item.is_favorite);
      setItem(updated);
    } catch (e) {
      setOpenFolderError(String(e));
    }
  }

  async function handleOpenFolder() {
    if (!item) return;
    try {
      await shellOpenPath(item.folder_path);
    } catch (e) {
      setOpenFolderError(String(e));
    }
  }

  async function handlePickThumbnail() {
    const selected = await openDialog({
      title: "Choose Thumbnail Image",
      filters: [{ name: "Images", extensions: ["jpg", "jpeg", "png", "gif", "webp", "bmp"] }],
      multiple: false,
      directory: false,
    });
    if (!selected || !item) return;
    const path = typeof selected === "string" ? selected : selected;
    try {
      const cachedPath = await thumbnailSet(item.id, path);
      setThumbnailSrc(convertFileSrc(cachedPath));
    } catch (e) {
      setError(String(e));
    }
  }

  async function handleNotesSave(value: string) {
    if (!item || value === item.notes) return;
    setNotesSaving(true);
    try {
      const updated = await itemUpdate(item.id, undefined, undefined, undefined, value);
      setItem(updated);
    } catch (e) {
      setError(String(e));
    } finally {
      setNotesSaving(false);
    }
  }

  const { tags: allTags, createTag } = useTags();
  const itemTagsHook = useItemTags(itemId!);

  useEffect(() => {
    itemGetById(itemId!)
      .then((i) => {
        setItem(i);
        setNotes(i.notes);
        // Try to load cached thumbnail for any item type.
        thumbnailGet(i.id, i.folder_path)
          .then((path) => setThumbnailSrc(path ? convertFileSrc(path) : null))
          .catch(() => setThumbnailSrc(null));
        // Load game status for game strategy types.
        if (i.strategy_type === "game" || i.strategy_type === "steam_game") {
          gameStatusGet(i.id).then(setGameStatus).catch(() => {});
        }
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [itemId]);

  async function handleDelete() {
    if (!item) return;
    setDeleting(true);
    try {
      await itemDelete(item.id);
      navigate(`/collections/${id}`);
    } catch (e) {
      setError(String(e));
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: "var(--space-6)", width: "100%" }}>
        <ItemDetailSkeleton />
      </div>
    );
  }
  if (error || !item) {
    return (
      <div className="idp-error-state">
        <span className="idp-error-msg">{error ?? "Item not found"}</span>
        <button
          className="idp-error-retry"
          onClick={() => {
            setError(null);
            setLoading(true);
            itemGetById(itemId!)
              .then((i) => { setItem(i); setNotes(i.notes); })
              .catch((e) => setError(String(e)))
              .finally(() => setLoading(false));
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="idp">
      {/* Back + delete row */}
      <div className="idp-topbar">
        <button className="idp-back" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} />
          <span>Back</span>
        </button>
        <div className="idp-topbar-actions">
          <button
            className={`idp-favorite-btn${item.is_favorite ? " idp-favorite-btn--active" : ""}`}
            onClick={handleToggleFavorite}
            title={item.is_favorite ? "Remove from Favorites" : "Add to Favorites"}
          >
            <Star size={13} />
            {item.is_favorite ? "Unfavorite" : "Favorite"}
          </button>
          <button
            className="idp-action-btn"
            onClick={handleOpenFolder}
            title="Open folder in Explorer"
          >
            <ExternalLink size={13} />
            Open Folder
          </button>
          <button
            className="idp-edit-btn"
            onClick={() => setShowEdit(true)}
            title="Edit item"
          >
            <Pencil size={13} />
            Edit
          </button>
          <button
            className="idp-delete-btn"
            onClick={() => setShowDeleteConfirm(true)}
            title="Delete item"
          >
            <Trash2 size={14} />
            Delete
          </button>
        </div>
      </div>

      {openFolderError && (
        <div className="idp-open-error">{openFolderError}</div>
      )}

      {/* Item header */}
      <div className="idp-header">
        <button
          className="idp-thumbnail-btn"
          onClick={handlePickThumbnail}
          title="Click to set thumbnail"
        >
          {(thumbnailSrc ?? exeIconSrc) ? (
            <div className={thumbnailSrc ? "idp-thumbnail" : "idp-icon"}>
              <img
                src={thumbnailSrc ?? exeIconSrc!}
                alt={item.name}
                className={thumbnailSrc ? "idp-thumbnail-img" : "idp-exe-icon-img"}
              />
              <div className="idp-thumbnail-overlay">
                <Camera size={16} color="#fff" />
              </div>
            </div>
          ) : (
            <div className="idp-icon">
              <FolderOpen size={28} color="var(--color-accent)" />
              <div className="idp-icon-overlay">
                <Camera size={14} color="#fff" />
              </div>
            </div>
          )}
        </button>
        <div>
          <h1 className="idp-name">{item.name}</h1>
          <span className="idp-badge">{strategyLabel(item.strategy_type)}</span>
        </div>
      </div>

      {/* Basic metadata */}
      <div className="idp-meta">
        <MetaRow label="Folder Path" value={item.folder_path} mono />
        {item.description && <MetaRow label="Description" value={item.description} />}
        <MetaRow label="Added" value={formatDate(item.created_at)} />
        <MetaRow label="Updated" value={formatDate(item.updated_at)} />
      </div>

      {/* Tags section */}
      <div className="idp-tags-section">
        <div className="idp-section-header">
          <span>Tags</span>
        </div>
        <TagPicker
          itemTags={itemTagsHook.tags}
          allTags={allTags}
          onAssign={itemTagsHook.assign}
          onRemove={itemTagsHook.remove}
          onCreateAndAssign={async (name, color) => {
            const tag = await createTag(name, color);
            await itemTagsHook.assign(tag.id);
          }}
        />
      </div>

      {/* Play status section — games only */}
      {gameStatus && (
        <GameStatusSection gameStatus={gameStatus} />
      )}

      {/* Strategy-specific section */}
      <div className="idp-strategy-section">
        <div className="idp-section-header">
          <span>Details</span>
        </div>
        <StrategyView item={item} />
      </div>

      {/* Notes section — inline editable, auto-saves on blur */}
      <div className="idp-notes-section">
        <div className="idp-section-header">
          <span>Notes</span>
          {notesSaving && <span className="idp-notes-saving">Saving…</span>}
        </div>
        <textarea
          className="idp-notes-textarea"
          value={notes}
          placeholder="Add notes…"
          onChange={(e) => setNotes(e.target.value)}
          onBlur={(e) => handleNotesSave(e.target.value)}
          rows={4}
        />
      </div>

      {showEdit && (
        <EditItemModal
          item={item}
          onSave={(updated) => { setItem(updated); setShowEdit(false); }}
          onClose={() => setShowEdit(false)}
        />
      )}

      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete Item"
        message={`Delete "${item.name}"? This cannot be undone.`}
        confirmLabel={deleting ? "Deleting…" : "Delete Item"}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      <style>{`
        .idp {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: var(--space-6);
        }
        .idp-error-state {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: var(--space-3); min-height: 40vh; text-align: center;
        }
        .idp-error-msg { font-size: 14px; color: var(--color-danger); }
        .idp-error-retry {
          padding: var(--space-2) var(--space-4);
          font-size: 13px; font-weight: 500;
          background: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          color: var(--color-text-secondary);
          transition: background var(--transition-fast), color var(--transition-fast);
        }
        .idp-error-retry:hover { background: var(--color-bg-tertiary); color: var(--color-text-primary); }
        .idp-topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .idp-topbar-actions {
          display: flex;
          align-items: center;
          gap: var(--space-1);
        }
        .idp-open-error {
          padding: var(--space-2) var(--space-3);
          background: var(--color-danger-light);
          color: var(--color-danger);
          border-radius: var(--radius-sm);
          font-size: 12px;
        }
        .idp-favorite-btn {
          display: inline-flex;
          align-items: center;
          gap: var(--space-1);
          padding: var(--space-1) var(--space-2);
          font-size: 12px;
          color: var(--color-text-muted);
          border-radius: var(--radius-sm);
          transition: color var(--transition-fast), background var(--transition-fast);
        }
        .idp-favorite-btn:hover {
          color: #f59e0b;
          background: var(--color-bg-secondary);
        }
        .idp-favorite-btn--active {
          color: #f59e0b;
        }
        .idp-favorite-btn--active:hover {
          color: var(--color-text-muted);
        }
        .idp-action-btn {
          display: inline-flex;
          align-items: center;
          gap: var(--space-1);
          padding: var(--space-1) var(--space-2);
          font-size: 12px;
          color: var(--color-text-muted);
          border-radius: var(--radius-sm);
          transition: color var(--transition-fast), background var(--transition-fast);
        }
        .idp-action-btn:hover {
          color: var(--color-accent);
          background: var(--color-bg-secondary);
        }
        .idp-edit-btn {
          display: inline-flex;
          align-items: center;
          gap: var(--space-1);
          padding: var(--space-1) var(--space-2);
          font-size: 12px;
          color: var(--color-text-muted);
          border-radius: var(--radius-sm);
          transition: color var(--transition-fast), background var(--transition-fast);
        }
        .idp-edit-btn:hover {
          color: var(--color-accent);
          background: var(--color-bg-secondary);
        }
        .idp-back {
          display: inline-flex;
          align-items: center;
          gap: var(--space-1);
          color: var(--color-text-muted);
          font-size: 13px;
          padding: var(--space-1) var(--space-2);
          border-radius: var(--radius-sm);
          transition: color var(--transition-fast), background var(--transition-fast);
        }
        .idp-back:hover {
          color: var(--color-text-primary);
          background: var(--color-bg-secondary);
        }
        .idp-delete-btn {
          display: inline-flex;
          align-items: center;
          gap: var(--space-1);
          padding: var(--space-1) var(--space-2);
          font-size: 12px;
          color: var(--color-text-muted);
          border-radius: var(--radius-sm);
          transition: color var(--transition-fast), background var(--transition-fast);
        }
        .idp-delete-btn:hover {
          color: var(--color-danger);
          background: var(--color-bg-secondary);
        }
        .idp-header {
          display: flex;
          align-items: center;
          gap: var(--space-4);
        }
        .idp-thumbnail-btn {
          flex-shrink: 0;
          padding: 0;
          background: none;
          border: none;
          cursor: pointer;
          border-radius: var(--radius-md);
        }
        .idp-thumbnail-btn:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
        }
        .idp-icon {
          width: 56px;
          height: 56px;
          background: var(--color-accent-light);
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
        }
        .idp-icon-overlay {
          position: absolute;
          inset: 0;
          background: rgba(0,0,0,0.45);
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transition: opacity var(--transition-fast);
          border-radius: var(--radius-md);
        }
        .idp-thumbnail-btn:hover .idp-icon-overlay {
          opacity: 1;
        }
        .idp-thumbnail {
          width: 72px;
          height: 72px;
          border-radius: var(--radius-md);
          overflow: hidden;
          border: 1px solid var(--color-border);
          background: var(--color-bg-secondary);
          position: relative;
        }
        .idp-thumbnail-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .idp-exe-icon-img {
          width: 28px;
          height: 28px;
          object-fit: contain;
          display: block;
        }
        .idp-thumbnail-overlay {
          position: absolute;
          inset: 0;
          background: rgba(0,0,0,0.45);
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transition: opacity var(--transition-fast);
        }
        .idp-thumbnail-btn:hover .idp-thumbnail-overlay {
          opacity: 1;
        }
        .idp-name {
          font-size: 22px;
          font-weight: 600;
          letter-spacing: -0.02em;
        }
        .idp-badge {
          display: inline-block;
          margin-top: var(--space-1);
          padding: 2px var(--space-2);
          background: var(--color-accent-light);
          color: var(--color-accent);
          border-radius: var(--radius-full);
          font-size: 11px;
          font-weight: 500;
          text-transform: capitalize;
        }
        .idp-meta {
          display: flex;
          flex-direction: column;
          gap: 0;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          overflow: hidden;
        }
        .idp-section-header {
          font-size: 13px;
          font-weight: 600;
          color: var(--color-text-secondary);
          margin-bottom: var(--space-3);
        }
        .idp-tags-section {
          padding: var(--space-4);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
        }
        .idp-notes-section {
          padding: var(--space-4);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }
        .idp-section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .idp-notes-saving {
          font-size: 11px;
          color: var(--color-text-muted);
          font-style: italic;
        }
        .idp-notes-textarea {
          width: 100%;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          padding: var(--space-3);
          font-size: 13px;
          line-height: 1.6;
          resize: vertical;
          background: var(--color-bg-secondary);
          color: var(--color-text-primary);
          transition: border-color var(--transition-fast), background var(--transition-fast);
          min-height: 80px;
        }
        .idp-notes-textarea:focus {
          outline: none;
          border-color: var(--color-accent);
          background: var(--color-bg);
        }
        .idp-strategy-section {
          padding: var(--space-4);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
        }
      `}</style>
    </div>
  );
}

// ─── GameStatusSection sub-component ─────────────────────────────────────────

interface GameStatusSectionProps {
  gameStatus: GameStatus;
}

/** Read-only play-status section shown for game and steam_game items. */
function GameStatusSection({ gameStatus }: GameStatusSectionProps) {
  function storyLabel(s: string) {
    return s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
  }

  return (
    <div className="gss-root">
      <div className="idp-section-header"><span>Play Status</span></div>
      <div className="gss-grid">
        <div className="gss-cell">
          <span className="gss-label">Story</span>
          <span className="gss-value">{storyLabel(gameStatus.story_status)}</span>
        </div>
        <div className="gss-cell">
          <span className="gss-label">Online</span>
          <span className="gss-value">{storyLabel(gameStatus.online_status)}</span>
        </div>
        {gameStatus.snooze_until && (
          <div className="gss-cell">
            <span className="gss-label">Snoozed until</span>
            <span className="gss-value">
              {new Date(gameStatus.snooze_until).toLocaleDateString()}
            </span>
          </div>
        )}
      </div>
      <p className="gss-hint">
        <Clock size={11} style={{ display: "inline", verticalAlign: "middle" }} />
        {" "}Change status from the <strong>Play</strong> page (Edit for manual override).
      </p>
      <style>{`
        .gss-root {
          padding: var(--space-4);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
        }
        .gss-grid {
          display: flex;
          gap: var(--space-6);
          flex-wrap: wrap;
        }
        .gss-cell {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .gss-label {
          font-size: 11px;
          font-weight: 500;
          color: var(--color-text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .gss-value {
          font-size: 13px;
          font-weight: 500;
          color: var(--color-text-primary);
          text-transform: capitalize;
        }
        .gss-hint {
          font-size: 12px;
          color: var(--color-text-muted);
        }
      `}</style>
    </div>
  );
}

// ─── MetaRow sub-component ────────────────────────────────────────────────────

interface MetaRowProps {
  label: string;
  value: string;
  mono?: boolean;
}

function MetaRow({ label, value, mono }: MetaRowProps) {
  return (
    <div className="meta-row">
      <span className="meta-label">{label}</span>
      <span className={`meta-value ${mono ? "meta-value--mono" : ""}`}>{value}</span>
      <style>{`
        .meta-row {
          display: flex;
          align-items: baseline;
          gap: var(--space-4);
          padding: var(--space-3) var(--space-4);
          border-bottom: 1px solid var(--color-border-subtle);
        }
        .meta-row:last-child {
          border-bottom: none;
        }
        .meta-label {
          font-size: 12px;
          font-weight: 500;
          color: var(--color-text-muted);
          min-width: 100px;
          flex-shrink: 0;
        }
        .meta-value {
          font-size: 13px;
          color: var(--color-text-primary);
          word-break: break-all;
        }
        .meta-value--mono {
          font-family: var(--font-mono);
          font-size: 12px;
        }
      `}</style>
    </div>
  );
}
