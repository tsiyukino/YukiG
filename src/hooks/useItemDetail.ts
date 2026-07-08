/**
 * Data and mutations for the item detail page: the item record, thumbnail,
 * game status, notes autosave, favorite toggle, folder open, and delete.
 */
import { useState, useEffect } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import {
  itemGetById, itemDelete, itemUpdate, itemSetFavorite,
  shellOpenPath, thumbnailGet, thumbnailSet, gameStatusGet, GameStatus,
} from "@/services/tauriCommands";
import { Item } from "@/types/item";

/**
 * Owns the detail page's item state and all its mutations.
 *
 * @param itemId - Route param of the item to load
 * @param onDeleted - Called after a successful delete (navigate away)
 */
export function useItemDetail(itemId: string, onDeleted: () => void) {
  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);
  const [thumbnailSrc, setThumbnailSrc] = useState<string | null>(null);
  const [gameStatus, setGameStatus] = useState<GameStatus | null>(null);

  function load() {
    setError(null);
    setLoading(true);
    itemGetById(itemId)
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
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [itemId]);

  async function toggleFavorite() {
    if (!item) return;
    try {
      const updated = await itemSetFavorite(item.id, !item.is_favorite);
      setItem(updated);
    } catch (e) {
      setActionError(String(e));
    }
  }

  async function openFolder() {
    if (!item) return;
    try {
      await shellOpenPath(item.folder_path);
    } catch (e) {
      setActionError(String(e));
    }
  }

  async function pickThumbnail() {
    const selected = await openDialog({
      title: "Choose Thumbnail Image",
      filters: [{ name: "Images", extensions: ["jpg", "jpeg", "png", "gif", "webp", "bmp"] }],
      multiple: false,
      directory: false,
    });
    if (!selected || !item) return;
    try {
      const cachedPath = await thumbnailSet(item.id, selected);
      setThumbnailSrc(convertFileSrc(cachedPath));
    } catch (e) {
      setError(String(e));
    }
  }

  async function saveNotes(value: string) {
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

  async function deleteItem() {
    if (!item) return;
    setDeleting(true);
    try {
      await itemDelete(item.id);
      onDeleted();
    } catch (e) {
      setError(String(e));
      setDeleting(false);
    }
  }

  return {
    item, setItem, loading, error, retry: load,
    deleting, actionError,
    notes, setNotes, notesSaving, saveNotes,
    thumbnailSrc, pickThumbnail,
    gameStatus,
    toggleFavorite, openFolder, deleteItem,
  };
}
