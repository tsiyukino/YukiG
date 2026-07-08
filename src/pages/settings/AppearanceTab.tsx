/**
 * Settings — Appearance tab.
 *
 * Sections: Theme (dark mode), Accent color (presets + custom picker).
 */
import { Palette } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { useAppPrefs } from "@/hooks/useAppPrefs";
import { SettingsSection, SettingsRow, Toggle } from "./SettingsControls";
import s from "./settings.module.css";

const ACCENT_PRESETS = [
  { color: "#6366f1", label: "Indigo"  },
  { color: "#8b5cf6", label: "Violet"  },
  { color: "#ec4899", label: "Pink"    },
  { color: "#f43f5e", label: "Rose"    },
  { color: "#f97316", label: "Orange"  },
  { color: "#22c55e", label: "Green"   },
  { color: "#14b8a6", label: "Teal"    },
  { color: "#3b82f6", label: "Blue"    },
];

/** Appearance tab panel — theme and accent color. */
export default function AppearanceTab() {
  const [theme, setTheme] = useTheme();
  const [prefs, setPrefs] = useAppPrefs();

  return (
    <>
      <SettingsSection icon={<Palette size={15} />} title="Theme">
        <SettingsRow
          label="Dark mode"
          description="Switch between light and dark color themes. The preference is saved locally."
        >
          <Toggle
            checked={theme === "dark"}
            onChange={() => setTheme(theme === "dark" ? "light" : "dark")}
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection icon={<Palette size={15} />} title="Accent color">
        <SettingsRow
          label="Color"
          description="Used for active nav links, toggles, buttons, and interactive highlights throughout the app."
        >
          <div className={s.accentSwatches}>
            {ACCENT_PRESETS.map(({ color, label }) => (
              <button
                key={color}
                className={prefs.accentColor === color ? `${s.swatch} ${s.swatchActive}` : s.swatch}
                style={{ background: color }}
                title={label}
                onClick={() => setPrefs({ accentColor: color })}
              />
            ))}
            <label className={`${s.swatch} ${s.swatchCustom}`} title="Custom color">
              <input
                type="color"
                value={prefs.accentColor}
                onChange={(e) => setPrefs({ accentColor: e.target.value })}
              />
              <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>Custom</span>
            </label>
          </div>
        </SettingsRow>
      </SettingsSection>
    </>
  );
}
