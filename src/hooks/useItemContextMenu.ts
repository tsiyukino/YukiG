/**
 * Shared right-click menu definition for item cards and rows.
 *
 * ItemCard, GalleryItemCard, and ListItemRow all show the same menu for
 * an item; this hook is the single place that defines its shape. Cards
 * pass in the actions they already own (launch handler, detail
 * navigation, delete flow) — entries whose action is absent are omitted.
 */
import { FolderOpen, Info, Play, Trash2 } from "lucide-react";
import { Item } from "@/types/item";
import { MenuContent } from "@/components/common/ContextMenu";
import { useContextMenu } from "@/components/common/ContextMenuProvider";
import { shellOpenPath } from "@/services/tauriCommands";

/** Card-owned actions the menu dispatches to. All optional. */
export interface ItemMenuActions {
  /** Launches the item; pass only for launchable items (games). */
  onLaunch?: (e: React.MouseEvent) => void;
  /** Navigates to the item detail view. */
  onOpenDetail?: () => void;
  /** Starts the delete flow (confirmation is the page's concern). */
  onDelete?: (e: React.MouseEvent) => void;
}

/**
 * Returns an onContextMenu handler that opens the standard item menu.
 *
 * @param item - The item the menu acts on
 * @param actions - Callbacks the owning card already has
 */
export function useItemContextMenu(
  item: Item,
  actions: ItemMenuActions
): (e: React.MouseEvent) => void {
  const { open } = useContextMenu();

  return (e) => {
    const entries: MenuContent = [];

    if (actions.onLaunch) {
      const launch = actions.onLaunch;
      entries.push({
        id: "launch",
        label: "Launch",
        icon: Play,
        onSelect: () => launch(e),
      });
    }

    entries.push({
      id: "open-folder",
      label: "Open Folder",
      icon: FolderOpen,
      onSelect: () => {
        // Silently ignore — nothing to show without a toast system
        shellOpenPath(item.folder_path).catch(() => {});
      },
    });

    if (actions.onOpenDetail) {
      const openDetail = actions.onOpenDetail;
      entries.push({
        id: "detail",
        label: "View Details",
        icon: Info,
        onSelect: openDetail,
      });
    }

    if (actions.onDelete) {
      const del = actions.onDelete;
      entries.push("separator", {
        id: "delete",
        label: "Delete",
        icon: Trash2,
        danger: true,
        onSelect: () => del(e),
      });
    }

    open(e, entries);
  };
}
