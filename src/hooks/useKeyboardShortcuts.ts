/**
 * Global keyboard shortcut handler.
 *
 * Shortcuts registered here:
 * - `/` — focus the header search input (when no text field is focused)
 * - `Escape` — blur the currently focused element (dismisses dropdowns/search)
 *
 * Attach this hook once in App.tsx or AppShell.tsx.
 */
import { useEffect } from "react";

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

/** Finds the header search input by its class name. */
function getSearchInput(): HTMLInputElement | null {
  return document.querySelector<HTMLInputElement>(".titlebar-search-input");
}

export function useKeyboardShortcuts() {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // `/` focuses the search bar when no input is active.
      if (e.key === "/" && !isTextInput(document.activeElement)) {
        e.preventDefault();
        getSearchInput()?.focus();
        return;
      }

      // `Escape` blurs the active element (closes search dropdown, etc.).
      if (e.key === "Escape" && document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);
}
