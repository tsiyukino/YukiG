/**
 * Games page — browse all libraries as a card grid, compact grid,
 * expandable list, or table. The active view persists in localStorage
 * and falls back to the app preference default.
 */
import { useState } from "react";
import { LayoutGrid, List, LayoutList, Table2 } from "lucide-react";
import { readAppPrefs } from "@/hooks/useAppPrefs";
import PageTitle from "@/components/common/PageTitle";
import ViewToggle, { ViewOption } from "@/components/common/ViewToggle";
import CardView from "@/components/games/CardView";
import CompactView from "@/components/games/CompactView";
import ListView from "@/components/games/ListView";
import TableView from "@/components/games/TableView";
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

  function handleSetView(v: ViewMode) {
    localStorage.setItem("games-view", v);
    setView(v);
  }

  return (
    <div className={styles.page}>
      <PageTitle
        title="Games"
        subtitle="All collections in one place"
        actions={<ViewToggle options={VIEW_OPTIONS} value={view} onChange={handleSetView} />}
      />

      {view === "card" && <CardView />}
      {view === "compact" && <CompactView />}
      {view === "list" && <ListView />}
      {view === "table" && <TableView />}
    </div>
  );
}
