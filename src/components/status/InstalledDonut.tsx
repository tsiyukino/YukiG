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
    <div className="stp-donut">
      <div className="stp-donut-svg-wrap">
        <svg viewBox="0 0 110 110" className="stp-donut-svg">
          <circle cx="55" cy="55" r={r} fill="none" stroke="var(--color-bg-tertiary)" strokeWidth="12" />
          <circle
            cx="55" cy="55" r={r} fill="none"
            stroke="#22c55e" strokeWidth="12"
            strokeDasharray={`${filled} ${circ - filled}`}
            strokeLinecap="round"
            transform="rotate(-90 55 55)"
            className="stp-donut-arc"
          />
        </svg>
        <div className="stp-donut-label">
          <span className="stp-donut-pct">{Math.round(pct)}%</span>
          <span className="stp-donut-sub">installed</span>
        </div>
      </div>
      <div className="stp-donut-legend">
        <div className="stp-legend-row">
          <span className="stp-legend-dot" style={{ background: "#22c55e" }} />
          <span className="stp-legend-text">Installed</span>
          <span className="stp-legend-val">{installed}</span>
        </div>
        <div className="stp-legend-row">
          <span className="stp-legend-dot" style={{ background: "var(--color-border)" }} />
          <span className="stp-legend-text">Not installed</span>
          <span className="stp-legend-val">{total - installed}</span>
        </div>
      </div>
    </div>
  );
}
