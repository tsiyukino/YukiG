/**
 * Global keyboard shortcut handler.
 *
 * Shortcuts registered here:
 * - `/` — open the Search page (when no text field is focused)
 * - `Escape` — blur the currently focused element (dismisses dropdowns)
 *
 * Attach this hook once inside the Router context (AppShell).
 */
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

/** Returns true if the event target is a text input that should receive the key. */
function isTextInput(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName.toLowerCase();
  return (
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    el.isContentEditable
  );
}

export function useKeyboardShortcuts() {
  const navigate = useNavigate();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // `/` opens the Search page when no input is active.
      if (e.key === "/" && !isTextInput(document.activeElement)) {
        e.preventDefault();
        navigate("/search");
        return;
      }

      // `Escape` blurs the active element (closes dropdowns, etc.).
      if (e.key === "Escape" && document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [navigate]);
}
