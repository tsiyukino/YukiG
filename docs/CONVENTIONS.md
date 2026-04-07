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
