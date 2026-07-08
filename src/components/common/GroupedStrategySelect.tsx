/**
 * Grouped `<select>` for strategy types.
 * Sub-strategies (group != "") are collected into an `<optgroup>`.
 */
import { StrategyEntry } from "@/services/tauriCommands";

interface GroupedStrategySelectProps {
  className?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  strategies: StrategyEntry[];
}

/**
 * Renders a strategy dropdown with grouped sub-strategies.
 */
export default function GroupedStrategySelect({ className, value, onChange, strategies }: GroupedStrategySelectProps) {
  const topLevel = strategies.filter((s) => !s.group);
  const groups = Array.from(new Set(strategies.filter((s) => s.group).map((s) => s.group)));

  return (
    <select className={className} value={value} onChange={onChange} style={{ cursor: "pointer" }}>
      {topLevel.map((s) => (
        <option key={s.strategy_type} value={s.strategy_type}>{s.display_name}</option>
      ))}
      {groups.map((group) => {
        const parent = strategies.find((s) => s.strategy_type === group);
        const children = strategies.filter((s) => s.group === group);
        const groupLabel = group.charAt(0).toUpperCase() + group.slice(1);
        return (
          <optgroup key={group} label={groupLabel}>
            {parent && <option value={parent.strategy_type}>{parent.display_name}</option>}
            {children.map((s) => (
              <option key={s.strategy_type} value={s.strategy_type}>{s.display_name}</option>
            ))}
          </optgroup>
        );
      })}
    </select>
  );
}
