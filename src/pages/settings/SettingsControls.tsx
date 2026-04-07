/**
 * Shared primitive components used across all settings tab panels.
 *
 * Exported:
 * - SettingsSection  — bordered card with an uppercase heading row
 * - SettingsRow      — label + description on the left, control on the right
 * - Toggle           — styled checkbox toggle switch
 * - SegmentedControl — inline button group for mutually exclusive choices
 */

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
    <div className="sp-section">
      <div className="sp-section-heading">{icon}{title}</div>
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
    <div className="sp-row">
      <div className="sp-row-info">
        <div className="sp-row-label">{label}</div>
        {description && <div className="sp-row-desc">{description}</div>}
      </div>
      <div className="sp-row-control">{children}</div>
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
    <label className="sp-toggle">
      <input type="checkbox" checked={checked} onChange={onChange} disabled={disabled} />
      <span className="sp-toggle-track" />
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
    <div className="sp-seg">
      {options.map((opt) => (
        <button
          key={opt.value}
          className={`sp-seg-btn ${value === opt.value ? "sp-seg-btn--active" : ""}`}
          onClick={() => onChange(opt.value)}
          disabled={disabled}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
