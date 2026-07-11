/**
 * Games page — browse all collections as a card grid, compact grid,
 * expandable list, or table. Rendered inside GamesLayout, which supplies the
 * persistent unfiled column; this component owns only the collection content.
 */
import { useState, useEffect } from "react";
import { LayoutGrid, List, LayoutList, Table2, Plus } from "lucide-react";
import { readAppPrefs } from "@/hooks/useAppPrefs";
import PageTitle from "@/components/common/PageTitle";
import ViewToggle, { ViewOption } from "@/components/common/ViewToggle";
import CardView from "@/components/games/CardView";
import CompactView from "@/components/games/CompactView";
import ListView from "@/components/games/ListView";
import TableView from "@/components/games/TableView";
import { useGamesArea } from "@/components/games/GamesLayout";
import AddItemModal from "@/pages/AddItemModal";
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
  const { fileGame, onReload, collapsed, UnfiledColumn } = useGamesArea();
  const [view, setView] = useState<ViewMode>(
    () => (localStorage.getItem("games-view") as ViewMode | null) ?? readAppPrefs().defaultGamesView
  );
  const [showAdd, setShowAdd] = useState(false);
  // Bump to reload the active view after adding or filing a game.
  const [reloadKey, setReloadKey] = useState(0);

  // Reload when a game is filed/unfiled from anywhere in the games area.
  useEffect(() => onReload(() => setReloadKey((k) => k + 1)), [onReload]);

  function handleSetView(v: ViewMode) {
    localStorage.setItem("games-view", v);
    setView(v);
  }

  function afterAdd() {
    setShowAdd(false);
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

      <div className={collapsed ? `${styles.split} ${styles.splitCollapsed}` : styles.split}>
        <div className={styles.main} key={reloadKey}>
          {view === "card" && <CardView onFileGame={(itemId, cid) => fileGame(itemId, cid)} />}
          {view === "compact" && <CompactView onFileGame={(itemId, cid) => fileGame(itemId, cid)} />}
          {view === "list" && <ListView />}
          {view === "table" && <TableView onFileGame={(itemId, cid) => fileGame(itemId, cid)} />}
        </div>
        <UnfiledColumn />
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
