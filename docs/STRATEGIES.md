# Folder Strategy System

## Interface

```rust
pub trait FolderStrategy: Send + Sync {
    fn strategy_type(&self) -> &'static str;
    fn display_name(&self) -> &'static str;
    fn scan(&self, folder_path: &Path) -> Result<ScanResult, StrategyError>;
    fn get_display_items(&self, folder_path: &Path) -> Result<Vec<DisplayItem>, StrategyError>;
    fn get_launch_action(&self, folder_path: &Path, metadata: &HashMap<String, String>) -> Option<LaunchAction>;
    fn metadata_schema(&self) -> Vec<MetadataField>;
}
```

## Registry

`StrategyRegistry` in `src-tauri/src/strategies/mod.rs`. Managed as Tauri state. All strategies registered in `StrategyRegistry::new()`.

## Implemented Strategies

### GameStrategy (`strategy_type: "game"`)

- **File**: `src-tauri/src/strategies/game_strategy.rs`
- **Scan**: Finds `.exe` files and common mod folder names at top level
- **Display Items**: Only the exe file(s) and mod folder
- **Launch Action**: `run_exe` — runs the configured exe via `std::process::Command`
- **Metadata Schema**: `exe_path` (required), `mod_folder` (optional), `screenshot_folder` (optional), `save_folder` (optional)
- **Extra executables**: `extra_exes` metadata key holds a JSON array of `{"label", "path"}` objects — secondary launchers (server, config tool, …) shown on the game detail page. They launch untracked via `game_launch_extra_exe`; only the main `exe_path` counts toward playtime. Managed in both the add-item flow and the edit-item modal (`ExtraExesEditor`, fed by the shared `useGameSuggestions` exe scan).
- **Mod folders recognized**: `mods`, `Mods`, `MODS`, `plugins`, `Plugins`, `addons`

### DocumentStrategy (`strategy_type: "document"`)

- **File**: `src-tauri/src/strategies/document_strategy.rs`
- **Scan**: Recursively counts all files, max depth `MAX_SCAN_DEPTH = 5`
- **Display Items**: All files and folders up to max depth
- **Launch Action**: `open_with_default` — opens folder with system default
- **Metadata Schema**: None

### Files Strategy Family (`strategy_type: "files" | "files/*"`)

All file strategies live in `src-tauri/src/strategies/files_strategy.rs` and share the same scan, categorization, and display-item logic via module-level helpers (`collect_files`, `scan_folder`, `categorize_extension`).

**Display name encoding**: `DisplayItem.name` is encoded as `<stem>\x00<category>` (null-byte delimiter). The extension is stripped from the stem. Decode with `parseFilesDisplayItem()` in `src/types/strategy.ts`.

**Frontend**: All file strategies use `src/components/strategies/FilesItemView.tsx`. The `strategyType` prop is forwarded to `useStrategy` so the correct Rust strategy is invoked on the backend.

**Dropdown grouping**: `strategy_list` returns a `group` field. Sub-strategies have `group = "files"`. The `AddItemModal` and `EditItemModal` render them inside an `<optgroup label="Files">` with the parent `"files"` (Auto Detect) as the first entry.

#### `"files"` — Auto Detect

- Shows all files regardless of format
- Scan metadata: per-category counts (`count_image`, `count_pdf`, …)

#### File Sub-Strategies (each stored as its own `strategy_type` in the DB)

Each filters `get_display_items` to its own `FileCategory`. Strategies with dedicated UI components are noted below; the rest share `FilesItemView`.

#### `files/image` — Images

- **File**: `src-tauri/src/strategies/files_image_strategy.rs`
- **Category filter**: png, jpg, webp, gif, bmp, tiff, svg, ico, avif, heic, raw, …
- **Thumbnail**: Auto-generated on item creation (first image in folder). Added to `THUMBNAIL_STRATEGIES` in `item_commands.rs`.
- **UI Component**: `src/components/strategies/ImagesItemView.tsx` — responsive thumbnail grid with inline lightbox. Images load via `convertFileSrc`. Keyboard navigation (←/→/Esc).

#### Other File Sub-Strategies (share `FilesItemView`)

| strategy_type | Display name | Category filter |
|---|---|---|
| `files/pdf` | PDF | pdf |
| `files/document` | Documents | doc, docx, odt, rtf, … |
| `files/spreadsheet` | Spreadsheets | xls, xlsx, ods, csv, tsv, … |
| `files/presentation` | Presentations | ppt, pptx, odp, key |
| `files/archive` | Archives | zip, 7z, rar, tar, gz, iso, … |
| `files/text` | Text Files | txt, log, ini, cfg, json, yaml, xml, … |
| `files/markdown` | Markdown | md, mdx, rst, adoc, … |
| `files/audio` | Audio | mp3, wav, flac, aac, ogg, … |
| `files/video` | Video | mp4, mkv, avi, mov, webm, … |
| `files/ebook` | Ebooks | epub, mobi, cbz, djvu, … |
| `files/font` | Fonts | ttf, otf, woff, woff2 |
| `files/data` | Data | db, sqlite, parquet, hdf5, … |

### CodeStrategy (`strategy_type: "code"`) — Placeholder

- **File**: `src-tauri/src/strategies/code_strategy.rs`
- **Scan**: Detects programming language by extension, counts files per language, identifies primary language. Skips generated/dependency directories (`node_modules`, `target`, `dist`, `.git`, etc.). Max depth `MAX_SCAN_DEPTH = 8`.
- **Scan metadata keys**: `primary_language`, `file_count`, `lang_<language_name>` (count per language)
- **Display Items**: All source files excluding ignored directories
- **Launch Action**: `open_with_default` — opens project folder
- **Metadata Schema**: None (placeholder; future fields: `preferred_editor`, `build_command`, `entry_point`)
- **Supported languages**: TypeScript, JavaScript, HTML, CSS, Vue, Svelte, Rust, C, C++, C#, Go, Zig, Swift, Kotlin, Java, Python, Ruby, PHP, Lua, Shell, PowerShell, Batch, R, Julia, Perl, Elixir, Erlang, Clojure, Haskell, OCaml, F#, Nim, Crystal, Dart, Elm, SQL, GraphQL, Protobuf, Terraform, Nix, and more.
- **UI Component**: `src/components/strategies/CodeItemView.tsx` — shows primary language, per-language breakdown chips, and a source file tree with monospaced filenames.

## Adding a New Strategy

1. Create `src-tauri/src/strategies/new_strategy.rs` implementing `FolderStrategy`
2. Declare the module in `src-tauri/src/strategies/mod.rs`
3. Register an instance in `StrategyRegistry::new()`
4. Create `src/components/strategies/NewItemView.tsx` for the UI
5. Add the `strategy_type` to the `StrategyType` union in `src/types/strategy.ts`
6. Update this file (`docs/STRATEGIES.md`)
