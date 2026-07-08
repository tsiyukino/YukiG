# Remove the titlebar search

**Date**: 2026-07-06
**Status**: Accepted

## Context

The custom titlebar carried a context-aware live-search box (prefix syntax
`a>` / `t>`, grouped dropdown results). It forced the titlebar to 48px and
duplicated capability that already exists: the dedicated Search page, plus
per-page filtering in collection views.

## Decision

Drop the titlebar search. The titlebar shrinks to the Windows-standard 32px
with correspondingly sized window controls. The `/` keyboard shortcut now
navigates to the Search page instead of focusing the titlebar input.

## Consequences

- `Header.tsx` renders only the drag region, app name, and `WindowControls`.
- `HeaderSearch.tsx`, `HeaderSearch.module.css`, and `useHeaderSearch.ts`
  are dead and should be deleted.
- If quick-search comes back, prefer a command-palette overlay (Ctrl+K style)
  over re-widening the titlebar.
