import React, { useState, useEffect, useRef } from "react";

/** @internal Animates a numeric value from 0 to the target over `duration` ms. */
function useCountUp(value: number, duration = 700): number {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const fromRef = useRef(0);

  useEffect(() => {
    if (value === display) return;
    fromRef.current = display;
    startRef.current = null;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);

    const step = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const t = Math.min((ts - startRef.current) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(fromRef.current + eased * (value - fromRef.current)));
      if (t < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  return display;
}

interface StatTileProps {
  /** Icon element displayed inside the tile. */
  icon: React.ReactNode;
  /** Short label below the value. */
  label: string;
  /** Numeric value (animated) or a pre-formatted string (displayed as-is). */
  value: string | number;
  /** Optional secondary line below the label. */
  sub?: string;
  /** Accent color for the top bar and icon background. */
  accent: string;
  /** Stagger delay in ms for the entrance animation. */
  delay?: number;
}

/**
 * A single metric tile with an animated count-up effect for numeric values.
 * Used in the Stats page grids.
 */
export default function StatTile({ icon, label, value, sub, accent, delay = 0 }: StatTileProps) {
  const numeric = typeof value === "number" ? value : -1;
  const counted = useCountUp(numeric >= 0 ? numeric : 0);
  const display = numeric >= 0 ? counted.toLocaleString() : (value as string);

  return (
    <div className="stp-tile" style={{ animationDelay: `${delay}ms` }}>
      <div className="stp-tile-bar" style={{ background: accent }} />
      <div className="stp-tile-icon" style={{ color: accent, background: `${accent}18` }}>{icon}</div>
      <div className="stp-tile-body">
        <span className="stp-tile-value">{display}</span>
        <span className="stp-tile-label">{label}</span>
        {sub && <span className="stp-tile-sub">{sub}</span>}
      </div>
    </div>
  );
}
