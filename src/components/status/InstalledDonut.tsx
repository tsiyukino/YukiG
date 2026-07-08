import s from "./status.module.css";
interface InstalledDonutProps {
  /** Number of installed games. */
  installed: number;
  /** Total games in the library. */
  total: number;
}

/**
 * SVG donut chart showing the ratio of installed Steam games to the total library.
 */
export default function InstalledDonut({ installed, total }: InstalledDonutProps) {
  const pct = total > 0 ? (installed / total) * 100 : 0;
  const r = 44;
  const circ = 2 * Math.PI * r;
  const filled = (pct / 100) * circ;

  return (
    <div className={s.donut}>
      <div className={s.donutSvgWrap}>
        <svg viewBox="0 0 110 110" className={s.donutSvg}>
          <circle cx="55" cy="55" r={r} fill="none" stroke="var(--color-bg-tertiary)" strokeWidth="12" />
          <circle
            cx="55" cy="55" r={r} fill="none"
            stroke="#22c55e" strokeWidth="12"
            strokeDasharray={`${filled} ${circ - filled}`}
            strokeLinecap="round"
            transform="rotate(-90 55 55)"
            className={s.donutArc}
          />
        </svg>
        <div className={s.donutLabel}>
          <span className={s.donutPct}>{Math.round(pct)}%</span>
          <span className={s.donutSub}>installed</span>
        </div>
      </div>
      <div className={s.donutLegend}>
        <div className={s.legendRow}>
          <span className={s.legendDot} style={{ background: "#22c55e" }} />
          <span className={s.legendText}>Installed</span>
          <span className={s.legendVal}>{installed}</span>
        </div>
        <div className={s.legendRow}>
          <span className={s.legendDot} style={{ background: "var(--color-border)" }} />
          <span className={s.legendText}>Not installed</span>
          <span className={s.legendVal}>{total - installed}</span>
        </div>
      </div>
    </div>
  );
}
