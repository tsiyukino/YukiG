# Drop the custom background feature

**Date**: 2026-07-06
**Status**: Accepted

## Context

A custom background feature was prototyped but never wired into the app:
user-selectable background images behind the UI, with automatic accent-color
extraction from the chosen image. It lived in three unreferenced files:

- `src/components/background/` (BackgroundLayer, BackgroundSlider, BackgroundPicker)
- `src/hooks/useBackground.ts`
- `src/utils/colorExtract.ts`

## Decision

Delete the feature entirely. Custom backgrounds are out of scope for now.

The prototype conflicted with the Notion-inspired design direction (flat
neutral surfaces, one accent color) and the image-derived accent color would
have fought the fixed token palette introduced by the 2026-07 frontend
redesign. If backgrounds come back later, they should be designed against the
token system, not bolted on beside it.

## Consequences

- No tracked code changes; the files were untracked and nothing imported them.
- Any future theming beyond light/dark starts from the token layer in
  `src/styles/tokens.css`, not from per-image color extraction.
