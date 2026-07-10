/**
 * Games page — browse all libraries as a card grid, compact grid,
 * expandable list, or table. The active view persists in localStorage
 * and falls back to the app preference default.
 */
import { useState } from "react";
import { LayoutGrid, List, LayoutList, Table2, Plus } from "lucide-react";
import { readAppPrefs } from "@/hooks/useAppPrefs";
import PageTitle from "@/components/common/PageTitle";
import ViewToggle, { ViewOption } from "@/components/common/ViewToggle";
import CardView from "@/components/games/CardView";
import CompactView from "@/components/games/CompactView";
import ListView from "@/components/games/ListView";
import TableView from "@/components/games/TableView";
import UnfiledPanel from "@/components/games/UnfiledPanel";
import AddItemModal from "@/pages/AddItemModal";
import { useUngrouped } from "@/hooks/useUngrouped";
import styles from "./GamesPage.module.css";

type ViewMode = "card" | "compact" | "list" | "table";

const VIEW_OPTIONS: ViewOption<ViewMode>[] = [
  { value: "card",    icon: <LayoutGrid size={14} />, title: "Card view" },
  { value: "compact", icon: <LayoutList size={14} />, title: "Compact view" },
  { value: "list",    icon: <List size={14} />,       title: "List view" },
  { value: "table",   icon: <Table2 size={14} />,     title: "Table view" },
];

/**
 * Displays all collections in the selected view, with create/delete actions.
 */
export default function GamesPage() {
  const [view, setView] = useState<ViewMode>(
    () => (localStorage.getItem("games-view") as ViewMode | null) ?? readAppPrefs().defaultGamesView
  );
  const [showAdd, setShowAdd] = useState(false);
  // Bump to force the active view to reload after adding or filing a game.
  const [reloadKey, setReloadKey] = useState(0);
  const [unfiledCollapsed, setUnfiledCollapsed] = useState(false);
  const unfiled = useUngrouped();

  function handleSetView(v: ViewMode) {
    localStorage.setItem("games-view", v);
    setView(v);
  }

  /** Files a game into a collection, then refreshes both columns. */
  async function fileGame(itemId: string, collectionId: string) {
    await unfiled.fileInto(itemId, collectionId);
    setReloadKey((k) => k + 1);
  }

  function afterAdd() {
    setShowAdd(false);
    unfiled.refresh();
    setReloadKey((k) => k + 1);
  }

  return (
    <div className={styles.page}>
      <PageTitle
        title="Games"
        subtitle="All collections in one place"
        actions={
          <div className={styles.actions}>
            <button className={styles.addBtn} onClick={() => setShowAdd(true)}>
              <Plus size={14} />
              Add Local Game
            </button>
            <ViewToggle options={VIEW_OPTIONS} value={view} onChange={handleSetView} />
          </div>
        }
      />

      <div className={unfiledCollapsed ? `${styles.split} ${styles.splitCollapsed}` : styles.split}>
        <div className={styles.main} key={reloadKey}>
          {view === "card" && <CardView onFileGame={fileGame} />}
          {view === "compact" && <CompactView />}
          {view === "list" && <ListView />}
          {view === "table" && <TableView />}
        </div>
        <UnfiledPanel
          games={unfiled.games}
          loading={unfiled.loading}
          collapsed={unfiledCollapsed}
          onToggleCollapsed={() => setUnfiledCollapsed((c) => !c)}
        />
      </div>

      {showAdd && (
        <AddItemModal
          collectionId={null}
          defaultStrategy="game"
          onSuccess={afterAdd}
          onClose={() => setShowAdd(false)}
        />
      )}
    </div>
  );
}
