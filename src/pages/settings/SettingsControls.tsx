/**
 * Shared primitive components used across all settings tab panels.
 *
 * Exported:
 * - SettingsSection  — bordered card with an uppercase heading row
 * - SettingsRow      — label + description on the left, control on the right
 * - Toggle           — styled checkbox toggle switch
 * - SegmentedControl — inline button group for mutually exclusive choices
 */
import s from "./settings.module.css";

// ─── SettingsSection ──────────────────────────────────────────────────────────

interface SettingsSectionProps {
  /** Icon shown in the section heading. */
  icon: React.ReactNode;
  /** Uppercase heading text. */
  title: string;
  children: React.ReactNode;
}

export function SettingsSection({ icon, title, children }: SettingsSectionProps) {
  return (
    <div className={s.section}>
      <div className={s.sectionHeading}>{icon}{title}</div>
      {children}
    </div>
  );
}

// ─── SettingsRow ─────────────────────────────────────────────────────────────

interface SettingsRowProps {
  /** Primary label for this setting. */
  label: string;
  /** Explanatory text shown below the label. */
  description: string;
  children: React.ReactNode;
}

export function SettingsRow({ label, description, children }: SettingsRowProps) {
  return (
    <div className={s.row}>
      <div className={s.rowInfo}>
        <div className={s.rowLabel}>{label}</div>
        {description && <div className={s.rowDesc}>{description}</div>}
      </div>
      <div className={s.rowControl}>{children}</div>
    </div>
  );
}

// ─── Toggle ───────────────────────────────────────────────────────────────────

interface ToggleProps {
  /** Whether the toggle is on. */
  checked: boolean;
  /** Called when the user clicks the toggle. */
  onChange: () => void;
  /** When true, the toggle is shown but cannot be interacted with. */
  disabled?: boolean;
}

export function Toggle({ checked, onChange, disabled = false }: ToggleProps) {
  return (
    <label className={s.toggle}>
      <input type="checkbox" checked={checked} onChange={onChange} disabled={disabled} />
      <span className={s.toggleTrack} />
    </label>
  );
}

// ─── SegmentedControl ─────────────────────────────────────────────────────────

interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  value: T;
  onChange: (v: T) => void;
  options: SegmentedOption<T>[];
  disabled?: boolean;
}

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  disabled,
}: SegmentedControlProps<T>) {
  return (
    <div className={s.seg}>
      {options.map((opt) => (
        <button
          key={opt.value}
          className={value === opt.value ? `${s.segBtn} ${s.segActive}` : s.segBtn}
          onClick={() => onChange(opt.value)}
          disabled={disabled}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
