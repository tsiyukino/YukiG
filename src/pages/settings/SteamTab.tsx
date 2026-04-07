/**
 * Settings — Steam tab.
 *
 * Section: Background sync (enable toggle, interval selector).
 */
import { Gauge } from "lucide-react";
import { useAppPrefs, SteamSyncInterval } from "@/hooks/useAppPrefs";
import { SettingsSection, SettingsRow, Toggle, SegmentedControl } from "./SettingsControls";

/** Steam tab panel — background sync settings. */
export default function SteamTab() {
  const [prefs, setPrefs] = useAppPrefs();

  return (
    <SettingsSection icon={<Gauge size={15} />} title="Background sync">
      <SettingsRow
        label="Background sync"
        description="Automatically re-scan your Steam library in the background while YukiG is running."
      >
        <Toggle
          checked={prefs.steamSyncEnabled}
          onChange={() => setPrefs({ steamSyncEnabled: !prefs.steamSyncEnabled })}
        />
      </SettingsRow>
      <SettingsRow
        label="Sync interval"
        description="How often the background sync runs. Changes take effect on next app launch."
      >
        <SegmentedControl<SteamSyncInterval>
          value={prefs.steamSyncInterval}
          onChange={(v) => setPrefs({ steamSyncInterval: v })}
          disabled={!prefs.steamSyncEnabled}
          options={[
            { value: "1h",     label: "1 h"    },
            { value: "2h",     label: "2 h"    },
            { value: "4h",     label: "4 h"    },
            { value: "8h",     label: "8 h"    },
            { value: "manual", label: "Manual" },
          ]}
        />
      </SettingsRow>
    </SettingsSection>
  );
}
