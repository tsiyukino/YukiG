# Steam feature keeps a shared global stylesheet

**Date**: 2026-07-06
**Status**: Accepted (tracked debt)

## Context

The 2026-07 frontend redesign moved all component styles to CSS Modules.
SteamPage carried a 2,200-line `<style>` string consumed by every component
under `src/components/steam/` through global `sp-*` / `sdt-*` class names —
roughly 350 class rules with cross-component sharing.

## Decision

Extract the string verbatim into `src/components/steam/steam.css`, imported
once by SteamPage. Do not distribute it into per-component modules yet.

Redistributing ~350 interdependent rules across 20 components is high-risk
mechanical churn with no behavior payoff. Extraction alone already fixes the
real problems: the CSS no longer ships inside the JS bundle (index.js dropped
655 kB → 488 kB), the page file is back under limits, and styles are no
longer re-injected per render.

## Consequences

- `steam.css` is the one sanctioned exception to the CSS Modules convention;
  its header comment points here.
- New steam components should still use CSS Modules; only existing `sp-*` /
  `sdt-*` consumers stay on the shared sheet.
- When a steam component is next substantially reworked, move its classes
  out of `steam.css` into its own module as part of that change.
