/**
 * Hero banner + below-hero strip for the game detail tab:
 * background art, logo overlay, editable name, play/install button,
 * playtime widget, achievement and OS pills.
 * Styles come from the steam feature stylesheet (sdt-*).
 */
import { useState } from "react";
import { RefreshCw, Play, Download, Trophy, Check, X, Pencil } from "lucide-react";
import { steamLaunchGame, steamInstallGame, itemUpdate } from "@/services/tauriCommands";
import { SteamGame } from "@/types/steam";
import { steamImageSrc } from "@/utils/pathUtils";
import { fmtDate, fmtPlaytimeHours } from "@/utils/steamFormatters";
import OsIcon from "../OsIcon";

interface DetailHeroProps {
  game: SteamGame;
  /** DB item id — enables name editing when present. */
  itemId: string | null;
  /** Achievement summary from the achievements section, if loaded. */
  achSummary: { unlocked: number; total: number } | null;
  onError: (msg: string) => void;
}

/**
 * Renders the detail tab's hero area.
 */
export default function DetailHero({ game, itemId, achSummary, onError }: DetailHeroProps) {
  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState(game.name);
  const [savingName, setSavingName] = useState(false);
  const playtimeHours = fmtPlaytimeHours(game.playtime_minutes);

  async function handleSaveName() {
    if (!itemId || nameVal.trim() === "" || nameVal === game.name) { setEditingName(false); return; }
    setSavingName(true);
    try {
      await itemUpdate(itemId, nameVal.trim());
      setEditingName(false);
    } catch (e) {
      onError(String(e));
    } finally {
      setSavingName(false);
    }
  }

  return (
    <>
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
        <div className="sdt-hero-logo-wrap">
          <img
            className="sdt-hero-logo"
            src={steamImageSrc(game.library_logo)}
            alt={game.name}
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        </div>
      </div>

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
          {achSummary && achSummary.total > 0 && (
            <span className="sdt-playtime-pill"><Trophy size={10} />{achSummary.unlocked}/{achSummary.total}</span>
          )}
          {game.os_list > 0 && (
            <span className="sdt-os-pill">
              {(game.os_list & 1) !== 0 && <OsIcon os="windows" />}
              {(game.os_list & 2) !== 0 && <OsIcon os="macos" />}
              {(game.os_list & 4) !== 0 && <OsIcon os="linux" />}
            </span>
          )}
        </div>
      </div>
    </>
  );
}
