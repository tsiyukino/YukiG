/**
 * Manages the app theme (light/dark).
 *
 * The selected theme is stored in `localStorage` under the key `"theme"`.
 * On mount it reads the stored value (defaulting to `"light"`) and applies
 * the `data-theme` attribute to `<html>`. The CSS in global.css uses this
 * attribute to swap color variables.
 */
import { useEffect, useState } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "theme";

/** Returns the current theme and a setter that persists to localStorage. */
export function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "dark" ? "dark" : "light";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  return [theme, setThemeState];
}
