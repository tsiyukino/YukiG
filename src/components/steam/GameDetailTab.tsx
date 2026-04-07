/**
 * Full game detail tab shown when "See Details" is clicked in the drawer.
 *
 * Displays the hero banner, game logo, play stats, about info, notes (editable),
 * achievements (collapsible, editable), screenshots, and cloud saves.
 */
import { useState, useEffect } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import {
  RefreshCw, Play, AlertCircle, FolderOpen,
  CheckCircle2, Trophy, Edit3, Store, Monitor, Timer, Check,
  Pencil, Camera, Cloud, Globe, Download,
  Eye, EyeOff, Save, X, Lock,
} from "lucide-react";
import {
  steamLaunchGame, steamInstallGame, steamOpenInApp, steamOpenInStore,
  steamGetAchievements, SteamGameDbInfo,
  itemUpdate, shellOpenPath, steamGetScreenshots, steamGetCloudSaves,
  steamSetAchievements,
  gameStatusGet, gameStatusSet, GameStatus, StoryStatus, OnlineStatus,
  tagGetAll, tagGetByItem, tagAssign, tagRemove, tagCreate,
} from "@/services/tauriCommands";
import { Tag } from "@/types/tag";
import {
  SteamGame, SteamAchievement, SteamScreenshot, SteamCloudFile, AchievementEdit,
} from "@/types/steam";
import { steamImageSrc } from "@/utils/pathUtils";
import { fmtBytes, fmtDate } from "@/utils/steamFormatters";
import AchIcon from "./AchIcon";
import OsIcon from "./OsIcon";
import DetailSection from "./DetailSection";

interface GameDetailTabProps {
  /** The game to show full details for. */
  game: SteamGame;
  /** DB metadata keyed by app_id, used to get the item_id for edits. */
  gameDbInfo: Record<number, SteamGameDbInfo>;
}

/**
 * Full game detail view rendered as the "detail" tab.
 * Loads achievements, screenshots, and cloud saves lazily on first expand.
 */
export default function GameDetailTab({ game, gameDbInfo }: GameDetailTabProps) {
  const [achievements, setAchievements] = useState<SteamAchievement[]>([]);
  const [achLoading, setAchLoading] = useState(false);
  const [achExpanded, setAchExpanded] = useState(false);
  const [achLoaded, setAchLoaded] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editDraft, setEditDraft] = useState<Record<string, boolean>>({});
  const [achSaving, setAchSaving] = useState(false);
  const [achSaveError, setAchSaveError] = useState<string | null>(null);
  const [screenshots, setScreenshots] = useState<SteamScreenshot[]>([]);
  const [ssLoading, setSsLoading] = useState(false);
  const [ssExpanded, setSsExpanded] = useState(false);
  const [ssLoaded, setSsLoaded] = useState(false);
  const [cloudFiles, setCloudFiles] = useState<SteamCloudFile[]>([]);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [cloudExpanded, setCloudExpanded] = useState(false);
  const [cloudLoaded, setCloudLoaded] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [nameVal, setNameVal] = useState(game.name);
  const [descVal, setDescVal] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [savingDesc, setSavingDesc] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const itemId = gameDbInfo[game.app_id]?.item_id ?? null;

  // ── Play status ──
  const [gameStatus, setGameStatus] = useState<GameStatus | null>(null);
  const [statusSaving, setStatusSaving] = useState(false);

  // ── Tags ──
  const [itemTags, setItemTags] = useState<Tag[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const [newTagName, setNewTagName] = useState("");

  useEffect(() => {
    setNameVal(game.name);
    setEditingName(false);
    setEditingDesc(false);
    setAchievements([]);
    setAchExpanded(false);
    setAchLoaded(false);
    setShowHidden(false);
    setEditMode(false);
    setEditDraft({});
    setAchSaveError(null);
    setScreenshots([]);
    setSsExpanded(false);
    setSsLoaded(false);
    setCloudFiles([]);
    setCloudExpanded(false);
    setCloudLoaded(false);
    setGameStatus(null);
    setItemTags([]);
    setTagPickerOpen(false);
    setNewTagName("");
  }, [game.app_id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load status + tags whenever itemId becomes available.
  useEffect(() => {
    if (!itemId) return;
    gameStatusGet(itemId).then(setGameStatus).catch(() => {});
    tagGetByItem(itemId).then(setItemTags).catch(() => {});
    tagGetAll().then(setAllTags).catch(() => {});
  }, [itemId]);

  async function handleStoryStatus(s: StoryStatus) {
    if (!itemId || !gameStatus) return;
    setStatusSaving(true);
    try {
      const updated = await gameStatusSet(itemId, s, gameStatus.online_status as OnlineStatus, gameStatus.snooze_until);
      setGameStatus(updated);
    } catch (_) {}
    finally { setStatusSaving(false); }
  }

  async function handleAssignTag(tagId: string) {
    if (!itemId) return;
    await tagAssign(itemId, tagId);
    setItemTags((prev) => {
      if (prev.some((t) => t.id === tagId)) return prev;
      const tag = allTags.find((t) => t.id === tagId);
      return tag ? [...prev, tag] : prev;
    });
  }

  async function handleRemoveTag(tagId: string) {
    if (!itemId) return;
    await tagRemove(itemId, tagId);
    setItemTags((prev) => prev.filter((t) => t.id !== tagId));
  }

  async function handleCreateTag() {
    if (!itemId || !newTagName.trim()) return;
    const PALETTE = ["#6366f1","#8b5cf6","#ec4899","#f43f5e","#f97316","#eab308","#22c55e","#14b8a6","#3b82f6","#06b6d4"];
    const color = PALETTE[Math.floor(Math.random() * PALETTE.length)];
    try {
      const tag = await tagCreate(newTagName.trim(), color);
      setAllTags((prev) => [...prev, tag]);
      await handleAssignTag(tag.id);
      setNewTagName("");
    } catch (_) {}
  }

  async function loadAchievements() {
    if (achLoading) return;
    if (achLoaded) { setAchExpanded((v) => !v); return; }
    setAchLoading(true);
    try {
      const data = await steamGetAchievements(game.app_id);
      setAchievements(data);
      setAchLoaded(true);
      setAchExpanded(true);
    } catch (_) {
      setAchLoaded(true);
      setAchExpanded(true);
    } finally {
      setAchLoading(false);
    }
  }

  function toggleEditMode() {
    if (editMode) {
      // Cancel — discard draft
      setEditDraft({});
      setAchSaveError(null);
    } else {
      // Enter edit mode — seed draft from current achievement states
      const draft: Record<string, boolean> = {};
      for (const a of achievements) draft[a.api_name] = a.unlocked;
      setEditDraft(draft);
    }
    setEditMode((v) => !v);
  }

  function toggleAchDraft(apiName: string) {
    setEditDraft((d) => ({ ...d, [apiName]: !d[apiName] }));
  }

  async function saveAchievements() {
    const edits: AchievementEdit[] = achievements
      .filter((a) => editDraft[a.api_name] !== undefined && editDraft[a.api_name] !== a.unlocked)
      .map((a) => ({ api_name: a.api_name, unlocked: editDraft[a.api_name] }));
    if (edits.length === 0) { setEditMode(false); return; }
    setAchSaving(true);
    setAchSaveError(null);
    try {
      await steamSetAchievements(game.app_id, edits);
      // Reflect changes locally without re-fetching
      setAchievements((prev) =>
        prev.map((a) =>
          editDraft[a.api_name] !== undefined
            ? { ...a, unlocked: editDraft[a.api_name], unlock_time: editDraft[a.api_name] ? Math.floor(Date.now() / 1000) : 0 }
            : a,
        ),
      );
      setEditDraft({});
      setEditMode(false);
    } catch (e) {
      setAchSaveError(String(e));
    } finally {
      setAchSaving(false);
    }
  }

  async function loadScreenshots() {
    if (ssLoading) return;
    if (ssLoaded) { setSsExpanded((v) => !v); return; }
    setSsLoading(true);
    try {
      const data = await steamGetScreenshots(game.app_id);
      setScreenshots(data);
      setSsLoaded(true);
      setSsExpanded(true);
    } catch (_) {
      setSsLoaded(true);
      setSsExpanded(true);
    } finally {
      setSsLoading(false);
    }
  }

  async function loadCloudSaves() {
    if (cloudLoading) return;
    if (cloudLoaded) { setCloudExpanded((v) => !v); return; }
    setCloudLoading(true);
    try {
      const data = await steamGetCloudSaves(game.app_id);
      setCloudFiles(data);
      setCloudLoaded(true);
      setCloudExpanded(true);
    } catch (_) {
      setCloudLoaded(true);
      setCloudExpanded(true);
    } finally {
      setCloudLoading(false);
    }
  }

  async function handleSaveName() {
    if (!itemId || nameVal.trim() === "" || nameVal === game.name) { setEditingName(false); return; }
    setSavingName(true);
    setEditError(null);
    try {
      await itemUpdate(itemId, nameVal.trim());
      setEditingName(false);
    } catch (e) {
      setEditError(String(e));
    } finally {
      setSavingName(false);
    }
  }

  async function handleSaveDesc() {
    if (!itemId) { setEditingDesc(false); return; }
    setSavingDesc(true);
    setEditError(null);
    try {
      await itemUpdate(itemId, undefined, descVal);
      setEditingDesc(false);
    } catch (e) {
      setEditError(String(e));
    } finally {
      setSavingDesc(false);
    }
  }

  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const achPct = achievements.length > 0 ? Math.round((unlockedCount / achievements.length) * 100) : 0;
  // Always show all achievements; hidden ones are masked as ??? unless showHidden is on
  const visibleAchievements = achievements;
  const playtimeHours = game.playtime_minutes > 0
    ? game.playtime_minutes >= 60
      ? `${(game.playtime_minutes / 60).toFixed(1)} hrs`
      : `${game.playtime_minutes} min`
    : null;
  const downloadPct = game.size_on_disk > 0
    ? Math.min(100, Math.round((game.bytes_downloaded / game.size_on_disk) * 100))
    : null;

  return (
    <div className="sdt-root">
      {/* ── Hero banner: background + logo overlay (Steam library detail style) ── */}
      <div className="sdt-hero">
        <img
          className="sdt-hero-img"
          src={steamImageSrc(game.library_hero || game.header_image)}
          alt=""
          onError={(e) => {
            const img = e.target as HTMLImageElement;
            if (game.library_hero && img.src === steamImageSrc(game.library_hero)) img.src = steamImageSrc(game.header_image);
          }}
        />
        <div className="sdt-hero-overlay" />
        {/* Logo PNG overlaid at bottom-left, on top of hero */}
        <div className="sdt-hero-logo-wrap">
          <img
            className="sdt-hero-logo"
            src={steamImageSrc(game.library_logo)}
            alt={game.name}
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        </div>
      </div>
      {/* ── Below-hero strip: name/edit + meta + pills ── */}
      <div className="sdt-hero-below">
        {editingName ? (
          <div className="sdt-name-edit">
            <input className="sdt-name-input" value={nameVal}
              onChange={(e) => setNameVal(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSaveName(); if (e.key === "Escape") { setEditingName(false); setNameVal(game.name); } }}
              autoFocus />
            <button className="sdt-name-save" onClick={handleSaveName} disabled={savingName}>
              {savingName ? <RefreshCw size={12} className="sp-spin" /> : <Check size={12} />}
            </button>
            <button className="sdt-name-cancel" onClick={() => { setEditingName(false); setNameVal(game.name); }}><X size={12} /></button>
          </div>
        ) : (
          <div className="sdt-hero-name-row">
            <h1 className="sdt-hero-name">{nameVal}</h1>
            {itemId && <button className="sdt-edit-icon-btn" onClick={() => setEditingName(true)} title="Edit name"><Pencil size={13} /></button>}
          </div>
        )}
        {game.developer && (
          <div className="sdt-hero-meta">
            <span className="sdt-hero-dev">{game.developer}</span>
          </div>
        )}
        <div className="sdt-hero-action-row">
          <button
            className={game.is_installed ? "sdt-play-btn" : "sdt-install-btn"}
            onClick={() => {
              if (game.is_installed) steamLaunchGame(game.app_id).catch(() => {});
              else steamInstallGame(game.app_id).catch(() => {});
            }}
          >
            {game.is_installed ? <Play size={15} /> : <Download size={15} />}
            {game.is_installed ? "Play" : "Install"}
          </button>
          <div className="sdt-playtime-widget">
            <span className="sdt-playtime-val">{playtimeHours ?? "No playtime"}</span>
            {game.last_played > 0 && (
              <span className="sdt-playtime-sub">Last played {fmtDate(game.last_played)}</span>
            )}
          </div>
          {achievements.length > 0 && <span className="sdt-playtime-pill"><Trophy size={10} />{unlockedCount}/{achievements.length}</span>}
          {game.os_list > 0 && (
            <span className="sdt-os-pill">
              {(game.os_list & 1) !== 0 && <OsIcon os="windows" />}
              {(game.os_list & 2) !== 0 && <OsIcon os="macos" />}
              {(game.os_list & 4) !== 0 && <OsIcon os="linux" />}
            </span>
          )}
        </div>
      </div>

      {/* ── Page body (centered) ── */}
      <div className="sdt-page">
        {editError && (
          <div className="sdt-error-banner">
            <AlertCircle size={13} />{editError}
            <button onClick={() => setEditError(null)}><X size={11} /></button>
          </div>
        )}

        {/* ── Action row ── */}
        <div className="sdt-actions-row">
          <button className="sdt-action-btn sdt-action-btn--primary" onClick={() => steamOpenInApp(game.app_id).catch(() => {})}>
            <Monitor size={14} />Open in Steam
          </button>
          <button className="sdt-action-btn" onClick={() => steamOpenInStore(game.app_id).catch(() => {})}>
            <Store size={14} />Open Store Page
          </button>
          {game.is_installed && game.install_path && (
            <button className="sdt-action-btn" onClick={() => shellOpenPath(game.install_path!).catch(() => {})}>
              <FolderOpen size={14} />Open Folder
            </button>
          )}
        </div>

        {/* ── Two-column layout ── */}
        <div className="sdt-columns">

          {/* ── Left column ── */}
          <div className="sdt-col-left">

            {/* Stats */}
            <div className="sdt-card sdt-card--static">
              <div className="sdt-card-header sdt-card-header--static">
                <span className="sdt-card-title"><span className="sdt-card-icon"><Timer size={13} /></span>Play Stats</span>
              </div>
              <div className="sdt-card-body">
                <div className="sdt-stats-grid">
                  <div className="sdt-stat">
                    <span className="sdt-stat-val">{playtimeHours ?? "—"}</span>
                    <span className="sdt-stat-label">Playtime</span>
                  </div>
                  <div className="sdt-stat">
                    <span className="sdt-stat-val">{game.last_played > 0 ? fmtDate(game.last_played) : "—"}</span>
                    <span className="sdt-stat-label">Last Played</span>
                  </div>
                  <div className="sdt-stat">
                    <span className="sdt-stat-val">{game.is_installed && game.size_on_disk > 0 ? fmtBytes(game.size_on_disk) : "—"}</span>
                    <span className="sdt-stat-label">Size on Disk</span>
                  </div>
                </div>
                {!game.is_installed && game.bytes_downloaded > 0 && downloadPct !== null && (
                  <div className="sdt-dl-wrap">
                    <div className="sdt-dl-row">
                      <span className="sdt-dl-label"><Download size={11} />Downloaded {fmtBytes(game.bytes_downloaded)} / {fmtBytes(game.size_on_disk)}</span>
                      <span className="sdt-dl-pct">{downloadPct}%</span>
                    </div>
                    <div className="sdt-dl-track"><div className="sdt-dl-bar" style={{ width: `${downloadPct}%` }} /></div>
                  </div>
                )}
              </div>
            </div>

            {/* Game Info */}
            {(game.developer || game.publisher || game.release_date > 0 || game.collections.length > 0) && (
              <div className="sdt-card sdt-card--static">
                <div className="sdt-card-header sdt-card-header--static">
                  <span className="sdt-card-title"><span className="sdt-card-icon"><Globe size={13} /></span>About</span>
                </div>
                <div className="sdt-card-body sdt-card-body--rows">
                  {game.developer && <div className="sdt-row"><span className="sdt-row-label">Developer</span><span className="sdt-row-val">{game.developer}</span></div>}
                  {game.publisher && game.publisher !== game.developer && <div className="sdt-row"><span className="sdt-row-label">Publisher</span><span className="sdt-row-val">{game.publisher}</span></div>}
                  {game.release_date > 0 && <div className="sdt-row"><span className="sdt-row-label">Released</span><span className="sdt-row-val">{fmtDate(game.release_date)}</span></div>}
                  <div className="sdt-row"><span className="sdt-row-label">App ID</span><span className="sdt-row-val sdt-mono">#{game.app_id}</span></div>
                  {game.is_installed && game.install_path && <div className="sdt-row"><span className="sdt-row-label">Install path</span><span className="sdt-row-val sdt-mono sdt-row-val--truncate">{game.install_path}</span></div>}
                  {game.collections.length > 0 && <div className="sdt-row"><span className="sdt-row-label">Collections</span><span className="sdt-row-val">{game.collections.join(", ")}</span></div>}
                </div>
              </div>
            )}

            {/* Notes */}
            {itemId && (
              <div className="sdt-card sdt-card--static">
                <div className="sdt-card-header sdt-card-header--static">
                  <span className="sdt-card-title"><span className="sdt-card-icon"><Edit3 size={13} /></span>Notes</span>
                  {!editingDesc && (
                    <button className="sdt-card-edit-btn" onClick={() => setEditingDesc(true)}><Pencil size={11} />Edit</button>
                  )}
                </div>
                <div className="sdt-card-body">
                  {editingDesc ? (
                    <div className="sdt-desc-edit">
                      <textarea className="sdt-desc-textarea" value={descVal} onChange={(e) => setDescVal(e.target.value)}
                        placeholder="Add notes…" rows={4} autoFocus />
                      <div className="sdt-desc-actions">
                        <button className="sdt-desc-save" onClick={handleSaveDesc} disabled={savingDesc}>
                          {savingDesc ? <><RefreshCw size={11} className="sp-spin" />Saving…</> : <><Check size={11} />Save</>}
                        </button>
                        <button className="sdt-desc-cancel" onClick={() => setEditingDesc(false)}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <span className="sdt-field-value">{descVal || <em className="sdt-field-placeholder">No notes yet.</em>}</span>
                  )}
                </div>
              </div>
            )}
            {/* Play Status */}
            {itemId && gameStatus && (
              <div className="sdt-card sdt-card--static">
                <div className="sdt-card-header sdt-card-header--static">
                  <span className="sdt-card-title"><span className="sdt-card-icon"><Timer size={13} /></span>Play Status</span>
                  {statusSaving && <span className="sdt-saving-indicator">Saving…</span>}
                </div>
                <div className="sdt-card-body sdt-card-body--rows">
                  <div className="sdt-row">
                    <span className="sdt-row-label">Story</span>
                    <div className="sdt-status-chips">
                      {(["unplayed","playing","on_hold","completed","abandoned"] as StoryStatus[]).map((s) => (
                        <button
                          key={s}
                          className={`sdt-status-chip ${gameStatus.story_status === s ? "sdt-status-chip--active" : ""}`}
                          onClick={() => handleStoryStatus(s)}
                          disabled={statusSaving}
                        >
                          {s.replace(/_/g, " ")}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="sdt-row">
                    <span className="sdt-row-label">Online</span>
                    <div className="sdt-status-chips">
                      {(["inactive","active"] as OnlineStatus[]).map((s) => (
                        <button
                          key={s}
                          className={`sdt-status-chip ${gameStatus.online_status === s ? "sdt-status-chip--active" : ""}`}
                          onClick={async () => {
                            if (!itemId || !gameStatus) return;
                            setStatusSaving(true);
                            try {
                              const u = await gameStatusSet(itemId, gameStatus.story_status as StoryStatus, s, gameStatus.snooze_until);
                              setGameStatus(u);
                            } catch (_) {} finally { setStatusSaving(false); }
                          }}
                          disabled={statusSaving}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tags */}
            {itemId && (
              <div className="sdt-card sdt-card--static">
                <div className="sdt-card-header sdt-card-header--static">
                  <span className="sdt-card-title"><span className="sdt-card-icon"><Globe size={13} /></span>Tags</span>
                  <button className="sdt-card-edit-btn" onClick={() => setTagPickerOpen((v) => !v)}>
                    {tagPickerOpen ? "Done" : "Edit"}
                  </button>
                </div>
                <div className="sdt-card-body">
                  <div className="sdt-tag-chips">
                    {itemTags.map((t) => (
                      <span key={t.id} className="sdt-tag-chip" style={{ background: t.color + "22", color: t.color, borderColor: t.color + "55" }}>
                        {t.tag_type === "mood" && <span className="sdt-tag-mood-dot" style={{ background: t.color }} />}
                        {t.name}
                        {tagPickerOpen && (
                          <button className="sdt-tag-remove" onClick={() => handleRemoveTag(t.id)}>×</button>
                        )}
                      </span>
                    ))}
                    {itemTags.length === 0 && !tagPickerOpen && (
                      <span className="sdt-field-placeholder">No tags yet.</span>
                    )}
                  </div>
                  {tagPickerOpen && (
                    <div className="sdt-tag-picker">
                      <div className="sdt-tag-picker-list">
                        {allTags
                          .filter((t) => !itemTags.some((it) => it.id === t.id))
                          .map((t) => (
                            <button key={t.id} className="sdt-tag-picker-item" onClick={() => handleAssignTag(t.id)}>
                              {t.tag_type === "mood" && <span className="sdt-tag-mood-dot" style={{ background: t.color }} />}
                              <span style={{ color: t.color }}>{t.name}</span>
                            </button>
                          ))
                        }
                      </div>
                      <div className="sdt-tag-new">
                        <input
                          className="sdt-tag-new-input"
                          placeholder="New tag name…"
                          value={newTagName}
                          onChange={(e) => setNewTagName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") handleCreateTag(); }}
                        />
                        <button className="sdt-tag-new-btn" onClick={handleCreateTag} disabled={!newTagName.trim()}>
                          Add
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── Right column ── */}
          <div className="sdt-col-right">

            {/* Achievements */}
            <DetailSection
              icon={<Trophy size={13} />}
              title="Achievements"
              badge={achLoaded && achievements.length > 0
                ? <span className="sdt-badge">{unlockedCount}/{achievements.length} · {achPct}%</span>
                : undefined}
              onToggle={loadAchievements}
              expanded={achExpanded}
              loading={achLoading}
            >
              {/* Toolbar: hidden toggle + edit mode toggle */}
              {achievements.length > 0 && (
                <div className="sdt-ach-toolbar">
                  <div className="sdt-ach-progress-wrap" style={{ flex: 1 }}>
                    <div className="sdt-ach-progress-bar" style={{ width: `${achPct}%` }} />
                  </div>
                  <button
                    className={`sdt-ach-tool-btn ${showHidden ? "sdt-ach-tool-btn--on" : ""}`}
                    onClick={() => setShowHidden((v) => !v)}
                    title={showHidden ? "Hide hidden achievements" : "Show hidden achievements"}
                  >
                    {showHidden ? <Eye size={12} /> : <EyeOff size={12} />}
                    {showHidden ? "Shown" : "Hidden"}
                  </button>
                  <button
                    className={`sdt-ach-tool-btn ${editMode ? "sdt-ach-tool-btn--edit" : ""}`}
                    onClick={toggleEditMode}
                    title={editMode ? "Cancel editing" : "Edit achievement unlock states"}
                  >
                    <Pencil size={12} />
                    {editMode ? "Cancel" : "Edit"}
                  </button>
                </div>
              )}

              {/* Edit mode save bar */}
              {editMode && (
                <div className="sdt-ach-save-bar">
                  {achSaveError && <span className="sdt-ach-save-error"><AlertCircle size={11} />{achSaveError}</span>}
                  <button className="sdt-ach-save-btn" onClick={saveAchievements} disabled={achSaving}>
                    {achSaving ? <><RefreshCw size={11} className="sp-spin" />Saving…</> : <><Save size={11} />Save Changes</>}
                  </button>
                </div>
              )}

              {achLoaded && achievements.length === 0 ? (
                <div className="sdt-empty"><Trophy size={18} /><span>No achievement data found.</span></div>
              ) : (
                <div className="sdt-ach-list">
                  {visibleAchievements.map((a) => {
                    // Mask hidden achievements as ??? when showHidden is off
                    const masked = a.hidden && !a.unlocked && !showHidden;
                    // In edit mode, show draft state; otherwise show actual state
                    const displayUnlocked = editMode
                      ? (editDraft[a.api_name] ?? a.unlocked)
                      : a.unlocked;
                    // Icon to show: prefer librarycache URL (already full URL),
                    // schema URLs also full after CDN prefix fix in backend
                    const iconUrl = a.icon || "";
                    return (
                      <div
                        key={a.api_name}
                        className={`sdt-ach-item ${displayUnlocked ? "sdt-ach-item--on" : ""} ${editMode ? "sdt-ach-item--editable" : ""}`}
                        onClick={editMode ? () => toggleAchDraft(a.api_name) : undefined}
                        title={editMode ? (displayUnlocked ? "Click to lock" : "Click to unlock") : undefined}
                      >
                        <div className="sdt-ach-img-wrap">
                          {masked ? (
                            <div className="sdt-ach-icon-fb sdt-ach-icon-fb--hidden"><Lock size={10} /></div>
                          ) : iconUrl ? (
                            <AchIcon
                              src={iconUrl}
                              unlocked={displayUnlocked}
                            />
                          ) : (
                            <div className={`sdt-ach-icon-fb ${displayUnlocked ? "sdt-ach-icon-fb--on" : ""}`}>
                              {displayUnlocked ? <Check size={10} /> : <Lock size={10} />}
                            </div>
                          )}
                        </div>
                        <div className="sdt-ach-info">
                          <span className="sdt-ach-name">
                            {masked ? "???" : (a.name || a.api_name)}
                          </span>
                          {!masked && a.description && (
                            <span className="sdt-ach-desc">{a.description}</span>
                          )}
                          {masked ? (
                            <span className="sdt-ach-sub">Hidden achievement</span>
                          ) : (
                            <span className="sdt-ach-sub">
                              {displayUnlocked && a.unlock_time > 0
                                ? `Unlocked ${fmtDate(a.unlock_time)}`
                                : `${a.global_pct.toFixed(1)}% of players`}
                            </span>
                          )}
                        </div>
                        {editMode ? (
                          <div className={`sdt-ach-edit-check ${displayUnlocked ? "sdt-ach-edit-check--on" : ""}`}>
                            {displayUnlocked ? <Check size={11} /> : <Lock size={11} />}
                          </div>
                        ) : (
                          displayUnlocked && <CheckCircle2 size={13} className="sdt-ach-check" />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </DetailSection>

            {/* Screenshots */}
            <DetailSection
              icon={<Camera size={13} />}
              title="Screenshots"
              badge={ssLoaded && screenshots.length > 0
                ? <span className="sdt-badge">{screenshots.length}</span>
                : undefined}
              onToggle={loadScreenshots}
              expanded={ssExpanded}
              loading={ssLoading}
            >
              {ssLoaded && screenshots.length === 0 ? (
                <div className="sdt-empty"><Camera size={18} /><span>No screenshots found.</span></div>
              ) : (
                <>
                  <div className="sdt-ss-toolbar">
                    <button className="sdt-ss-open-btn" onClick={() => shellOpenPath(`steam://open/screenshots/${game.app_id}`).catch(() => {})}>
                      <Camera size={11} />View in Steam
                    </button>
                  </div>
                  <div className="sdt-screenshots-grid">
                    {screenshots.map((ss) => (
                      <button key={ss.path} className="sdt-screenshot-item"
                        onClick={() => shellOpenPath(ss.path).catch(() => {})} title={ss.filename}>
                        <img src={convertFileSrc(ss.path)} alt={ss.filename} className="sdt-screenshot-img"
                          loading="lazy" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        <div className="sdt-screenshot-overlay">
                          <span className="sdt-screenshot-date">{fmtDate(ss.timestamp)}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </DetailSection>

            {/* Cloud Saves */}
            <DetailSection
              icon={<Cloud size={13} />}
              title="Cloud Saves"
              badge={cloudLoaded && cloudFiles.length > 0
                ? <span className="sdt-badge">{cloudFiles.length}</span>
                : undefined}
              onToggle={loadCloudSaves}
              expanded={cloudExpanded}
              loading={cloudLoading}
            >
              {cloudLoaded && cloudFiles.length === 0 ? (
                <div className="sdt-empty"><Cloud size={18} /><span>No cloud save files found.</span></div>
              ) : (
                <div className="sdt-cloud-list">
                  {cloudFiles.map((f) => (
                    <div key={f.name} className="sdt-cloud-item">
                      <span className="sdt-cloud-name">{f.name}</span>
                      <span className="sdt-cloud-meta">{fmtBytes(f.size)}</span>
                      <span className="sdt-cloud-meta">{fmtDate(f.timestamp)}</span>
                    </div>
                  ))}
                </div>
              )}
            </DetailSection>

          </div>
        </div>
      </div>
    </div>
  );
}
