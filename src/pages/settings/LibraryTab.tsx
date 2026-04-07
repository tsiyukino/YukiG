/**
 * Settings — Library tab.
 *
 * Sections: Navigation (sidebar default), Default views (games page, collection page).
 */
import { Library } from "lucide-react";
import {
  useAppPrefs,
  GamesViewMode,
  CollectionViewMode,
} from "@/hooks/useAppPrefs";
import { SettingsSection, SettingsRow, Toggle, SegmentedControl } from "./SettingsControls";

/** Library tab panel — sidebar and default view mode preferences. */
export default function LibraryTab() {
  const [prefs, setPrefs] = useAppPrefs();

  return (
    <>
      <SettingsSection icon={<Library size={15} />} title="Navigation">
        <SettingsRow
          label="Sidebar expanded on start"
          description="Show the full sidebar with labels when the app opens, instead of the collapsed icon-only mode."
        >
          <Toggle
            checked={prefs.sidebarExpandedOnStart}
            onChange={() => setPrefs({ sidebarExpandedOnStart: !prefs.sidebarExpandedOnStart })}
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection icon={<Library size={15} />} title="Default views">
        <SettingsRow
          label="Games page default view"
          description="The view mode used when you open the Games page for the first time (before you manually switch)."
        >
          <SegmentedControl<GamesViewMode>
            value={prefs.defaultGamesView}
            onChange={(v) => setPrefs({ defaultGamesView: v })}
            options={[
              { value: "card",    label: "Card"    },
              { value: "compact", label: "Compact" },
              { value: "list",    label: "List"    },
              { value: "table",   label: "Table"   },
            ]}
          />
        </SettingsRow>
        <SettingsRow
          label="Collection default view"
          description="The view mode used when you open a collection for the first time. Can be overridden per collection."
        >
          <SegmentedControl<CollectionViewMode>
            value={prefs.defaultCollectionView}
            onChange={(v) => setPrefs({ defaultCollectionView: v })}
            options={[
              { value: "grid",    label: "Grid"    },
              { value: "gallery", label: "Gallery" },
              { value: "list",    label: "List"    },
            ]}
          />
        </SettingsRow>
      </SettingsSection>
    </>
  );
}
