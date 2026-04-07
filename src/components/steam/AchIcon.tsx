/**
 * Achievement icon component.
 *
 * Renders the achievement's icon image with a grayscale filter when locked.
 * Falls back to a Check or Lock icon if the image fails to load.
 */
import React from "react";
import { Check, Lock } from "lucide-react";

interface AchIconProps {
  /** URL of the achievement icon image. */
  src: string;
  /** Whether the achievement is currently unlocked. */
  unlocked: boolean;
}

/**
 * Achievement icon with grayscale filter for locked state and a lock-icon fallback.
 */
export default function AchIcon({ src, unlocked }: AchIconProps) {
  const [errored, setErrored] = React.useState(false);
  if (errored) {
    return (
      <div className={`sdt-ach-icon-fb ${unlocked ? "sdt-ach-icon-fb--on" : ""}`}>
        {unlocked ? <Check size={10} /> : <Lock size={10} />}
      </div>
    );
  }
  return (
    <img
      src={src}
      alt=""
      className={`sdt-ach-img ${unlocked ? "" : "sdt-ach-img--locked"}`}
      loading="lazy"
      onError={() => setErrored(true)}
    />
  );
}
