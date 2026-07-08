# Conventions

This document is the source of truth for naming, annotation, and code style. All conventions are also summarized in `CLAUDE.md` Section 3.

## Naming

### Rust

| Element | Convention | Example |
|---|---|---|
| Files/Modules | `snake_case` | `folder_strategy.rs`, `game_strategy.rs` |
| Functions | `snake_case` | `scan_folder()`, `get_display_items()` |
| Structs/Enums | `PascalCase` | `CollectionItem`, `StrategyType` |
| Enum Variants | `PascalCase` | `StrategyType::GameFolder` |
| Constants | `SCREAMING_SNAKE_CASE` | `MAX_SCAN_DEPTH` |
| Tauri Commands | `snake_case`, prefixed by domain | `collection_create()`, `item_add()` |
| DB columns | `snake_case` | `created_at`, `folder_path` |

### TypeScript

| Element | Convention | Example |
|---|---|---|
| Files (components) | `PascalCase.tsx` | `CollectionCard.tsx` |
| Files (hooks) | `camelCase.ts`, `use` prefix | `useCollections.ts` |
| Files (utils/services) | `camelCase.ts` | `tauriCommands.ts` |
| Components | `PascalCase` | `CollectionCard` |
| Functions/Hooks | `camelCase` | `useCollections()`, `handleDelete()` |
| Interfaces/Types | `PascalCase`, no `I` prefix | `Collection`, `FolderStrategy` |
| Constants | `SCREAMING_SNAKE_CASE` | `MAX_TAG_LENGTH` |
| Event handlers | `handle` or `on` prefix | `handleClick`, `onItemSelect` |

## Styling

- **CSS Modules only.** Each component's styles live in a co-located `<Name>.module.css` file (`Card.tsx` + `Card.module.css`). Do not render `<style>` tags inside JSX — one style block gets injected into the DOM per component *instance*.
- **Feature-shared modules are allowed** when several components of one feature share the same visual language: `src/styles/form.module.css` (modal forms), `src/pages/settings/settings.module.css`, `src/components/status/status.module.css`. Import them like any module; don't create page-level global classes.
- **Class names inside `.module.css` files are `camelCase`** (`launchButton`, not `launch-button`) so they can be referenced as `styles.launchButton` without bracket syntax.
- **All design values come from tokens** (`src/styles/tokens.css`). No hardcoded colors, font sizes, radii, shadows, or transition timings in component CSS — use `var(--text-sm)`, `var(--color-accent)`, `var(--transition-fast)`, etc. Components consume the semantic token layer; the primitive ramps (`--gray-*`, `--indigo-*`) are for defining new semantic tokens, not for direct use in components.
- **Fonts**: body text is `var(--font-sans)` (inherited from `body`, no need to restate); display headings and large stat numbers use `var(--font-display)`.
- Global styles (`src/styles/global.css`) contain only the reset, base element styles, and keyframes shared across pages.
- **One exception**: the steam feature shares `src/components/steam/steam.css` (global `sp-*` / `sdt-*` classes) — see `docs/decisions/2026-07-06_steam-css-exception.md`. Move classes into per-component modules when reworking a steam component; don't add new global classes there.

## invoke() Rule

All Tauri command calls go through `src/services/tauriCommands.ts`. Never call `invoke()` directly from components.

## File Size Limits

- Max 300 lines per file
- Max 50 lines per function
- Max 200 lines per component (including JSX)

## Annotations

### Rust
Every public function, struct, enum, and trait must have a `///` doc comment.

### TypeScript
Every exported function, component, hook, type, and interface must have a JSDoc comment.

## Error Handling

### Rust
- Custom error enum per module using `thiserror`
- No `.unwrap()` or `.expect()` in production code
- Tauri commands return `Result<T, String>`

### TypeScript
- All `tauriCommands.ts` wrappers propagate errors (no silent catch)
- Components handle loading, success, and error states explicitly
