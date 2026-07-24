# UI Components

## Layout

### `AppShell` (`src/components/layout/AppShell.tsx`)
Root layout wrapper. Renders `Sidebar` + `Header` + main content area. Activates global keyboard shortcuts via `useKeyboardShortcuts`.
- **Props**: `children: ReactNode`
- **Used by**: `App.tsx`
- **Depends on**: `useKeyboardShortcuts` hook

### `Sidebar` (`src/components/layout/Sidebar.tsx`)
Left navigation bar. Collapsible (icon-only by default); nav links grouped into labelled sections with an accent rail on the active link.
- **Props**: none
- **Used by**: `AppShell`

### `Header` (`src/components/layout/Header.tsx`)
Slim frameless titlebar (32px): drag region, app name, window controls. Global search lives on the Search page — the `/` shortcut opens it.
- **Props**: none
- **Used by**: `AppShell`
- **Depends on**: `WindowControls`

### `WindowControls` (`src/components/layout/WindowControls.tsx`)
Minimize / maximize / close buttons for the frameless titlebar. Tracks the maximized state to swap the middle button's icon.
- **Props**: none
- **Used by**: `Header`

## Common

### `Card` (`src/components/common/Card.tsx`)
Generic card container with hover states.
- **Props**: `children`, `onClick?`, `className?`, `style?`
- **Notes**: When `onClick` is provided, renders as a clickable card with pointer cursor and lift-on-hover.

### `Skeleton` (`src/components/common/Skeleton.tsx`)
Shimmer skeleton placeholder components for loading states.
- **Exports**: `Skeleton` (base block), `ItemGridSkeleton` (3-col item grid), `ItemDetailSkeleton` (detail page layout)
- **Used by**: `CollectionPage`, `ItemDetailPage`

### `LoadingSpinner` (`src/components/common/LoadingSpinner.tsx`)
Centered spinner for async states.
- **Props**: `message?: string`

### `ConfirmDialog` (`src/components/common/ConfirmDialog.tsx`)
Modal for destructive action confirmation.
- **Props**: `open`, `title`, `message`, `confirmLabel?`, `onConfirm`, `onCancel`
- **Notes**: Renders nothing when `open` is false. Clicking the overlay calls `onCancel`.

### `Modal` (`src/components/common/Modal.tsx`)
Generic modal shell: portal, dimmed overlay, centered panel with entrance animation. Overlay clicks close only when the mousedown also started on the overlay (protects text-selection drags).
- **Props**: `title?`, `width?` (default 420), `onClose`, `children`
- **Used by**: `NewCollectionModal`, `EditItemModal`

### `ContextMenu` (`src/components/common/ContextMenu.tsx`)
Presentational right-click menu: fixed-position command list rendered into `document.body`, clamped to the viewport, dismissed on outside mousedown / Escape / scroll / resize / window blur. Exports the `MenuEntry` and `MenuContent` types.
- **Props**: `x`, `y` (viewport coords), `entries: MenuContent`, `onClose`
- **Notes**: `MenuContent = (MenuEntry | "separator")[]`; `MenuEntry = { id, label, icon?, danger?, disabled?, onSelect }`. Rendered only by `ContextMenuProvider` — don't mount it directly.

### `ContextMenuProvider` (`src/components/common/ContextMenuProvider.tsx`)
Owns the single open context menu and suppresses the native (WebView2) context menu globally via a document-level `contextmenu` listener. Exports the `useContextMenu()` hook, which returns `{ open(e, entries) }` for attaching per-element menus; `open` calls `preventDefault` + `stopPropagation`, so elements without a menu fall through to the global suppressor.
- **Props**: `children`
- **Used by**: `AppShell` (wraps the whole shell); consumed via `useContextMenu` in `CollectionCard` and via `useItemContextMenu` (`src/hooks/useItemContextMenu.ts`) in `ItemCard`, `ListItemRow`, `GalleryItemCard`

### `GroupedStrategySelect` (`src/components/common/GroupedStrategySelect.tsx`)
Strategy `<select>` with sub-strategies collected into `<optgroup>`s.
- **Props**: `className?`, `value`, `onChange`, `strategies`
- **Used by**: `EditItemModal`

### `TagChips` (`src/components/common/TagChips.tsx`)
Compact read-only row of colored tag chips with a "+n" overflow marker. Renders nothing when the tag list is empty.
- **Props**: `tags: Tag[]`, `max: number` — chips shown before collapsing into "+n"
- **Used by**: `ItemCard` (max 3), `ListItemRow` (max 3), `GalleryItemCard` (max 2)

### Now-playing visual language (shared)
A single live-activity signal — a pulsing green dot built on `--color-success` — reused across every surface at three density tiers. Green is reserved exclusively for "currently playing"; never `--color-accent` (indigo), which means "selected / primary action" elsewhere. Every occurrence pairs the green with text (label or game name) so it is never color-alone, and all pulses honor `prefers-reduced-motion`.
- **Shared primitives**: `src/components/common/nowPlaying.module.css` — `.dot` (+ `.dotSm`/`.dotMd`/`.dotLg`), `.pill`, `.pillOverImage`, and the `now-playing-pulse` keyframe. All React surfaces compose these instead of redeclaring the animation.
- **Backing hooks**: `usePlaySessions` (`src/hooks/usePlaySessions.ts`) returns a live `Set<item_id>` — seeds from `session_get_active`, stays current via `play-session-started`/`ended` events; covers local + Steam library items. `useSteamRunningApp` (`src/hooks/useSteamRunningApp.ts`) returns the running Steam **app id** (0 = none) — seeds from `steam_get_running_appid`, stays live via `steam-running-changed`; used where games are keyed by app id rather than item id (the Steam page).

### `NowPlayingBadge` (`src/components/common/NowPlayingBadge.tsx`)
Self-contained badge that subscribes to `usePlaySessions` and renders nothing unless the given item is running — any card drops it in with no prop plumbing.
- **Props**: `itemId: string`, `variant?: "pill" | "dot" | "over-image"` (default `pill`), `label?: string` (default "Playing")
- **Variants**: `pill` (dot + label, grid cards) · `dot` (dot only, dense list rows) · `over-image` (stronger pill for overlaying cover art, gallery cards)
- **Used by**: `ItemCard` (pill, strategy-label row), `ListItemRow` (dot, before name), `GalleryItemCard` (over-image, cover bottom-left)

### `NowPlayingBanner` (`src/components/home/NowPlayingBanner.tsx`)
Home-page aggregate "now playing" entry. Solves the "1 to N games running" display problem by degrading with count: 0 → renders nothing; 1 → rich (cover + name + live dot); N → overlapping avatar-stack of up to 3 covers (+overflow chip) + "N playing" count, click to expand a compact list. Resolves active item ids against the home page's `allItems` (which already carry name + cover), so no extra backend query.
- **Props**: `allItems: FavoriteItem[]`, `onOpen: (item: FavoriteItem) => void`
- **Used by**: `HomePage` (between hero and stats strip)

### Steam page & tray now-playing
The Steam library (`GameCard` / `GameRow` via `LibraryTab`) marks the running game keyed by **app id** (`useSteamRunningApp`), so it works whether the game was launched from Steam or from YukiG: `sp-card--playing` outline + over-image "Playing" badge; `sp-row--playing` green tint + dot. The tray menu (`TrayMenu.tsx`) uses `usePlaySessions` to give the running game a green-tinted row + accent bar + pulsing dot (Steam-style). Both styles live with their surface (`steam.css` `sp-*`, `TrayMenu.module.css`) rather than the shared module, since those render in separate contexts.

### `PageTitle` (`src/components/common/PageTitle.tsx`)
Sticky page header with the app's signature accent tick, display-font title, optional subtitle, and a right-aligned actions slot. Sticky offset is tied to the `--page-pad-top` token.
- **Props**: `title`, `subtitle?`, `actions?`
- **Used by**: `GamesPage`, `TagsPage`, `SearchPage`, `SettingsPage`

### `ViewToggle` (`src/components/common/ViewToggle.tsx`)
Segmented icon toggle for switching view modes. Generic over the consuming page's view-mode string union.
- **Props**: `options: ViewOption<V>[]` (`{ value, icon, title }`), `value: V`, `onChange(value: V)`
- **Used by**: `GamesPage`

## Home Page Sections

### `HeroSection` (`src/components/home/HeroSection.tsx`)
Time-of-day greeting hero: gradient background, date + greeting, featured favorite card (or empty hint).
- **Props**: `featured: FavoriteItem | null`, `collectionName?`, `collectionColor?`, `onOpenFeatured()`

### `StatsStrip` (`src/components/home/StatsStrip.tsx`)
Four dashboard counters (collections / games / favorites / tags) in a responsive grid.
- **Props**: `stats: HomeStats`

### `FavoritesGrid` (`src/components/home/FavoritesGrid.tsx`)
Shuffled favorite-card grid, 2 rows by measured width, "See more" reveals 2 more rows.
- **Props**: `favorites: FavoriteItem[]`, `collections: Collection[]`, `onItemClick(item)`

### `OverviewPanel` (`src/components/home/OverviewPanel.tsx`)
Clickable overview row (icon, title, meta, thumbnail mosaic, chevron) linking to a library section.
- **Props**: `icon`, `title`, `meta`, `mosaicUrls: string[]`, `emptyIcon?`, `onClick()`

## Games Page Views

### `CardView` / `CompactView` / `ListView` / `TableView` (`src/components/games/`)
The four Games page view modes. CardView adds drag-and-drop reordering and the dashed "new collection" card; ListView renders `CollectionSection` accordions; TableView renders flat rows.
- **Props**: none (each pulls from `useCollections`)
- **Used by**: `GamesPage`

### `CollectionDialogs` (`src/components/games/CollectionDialogs.tsx`)
Shared create/delete dialog pair for the collection views.
- **Props**: `showNew`, `deleteTarget`, `onCreate`, `onCancelNew`, `onConfirmDelete`, `onCancelDelete`
- **Used by**: `CardView`, `CompactView`

## Collection Page

State lives in three hooks — `useCollectionBrowse` (data, folder stack, tag map/filter), `useBulkActions` (selection + bulk delete/tag), `useCollectionDnd` (all drag state and reorder/reparent mutations). The components below are presentational.

### `CollectionHeader` (`src/components/collection/CollectionHeader.tsx`)
Sticky header: back, breadcrumb trail, `ViewToggle` (grid/gallery/list), item count, selection toggle, edit, add. Exports the `ItemViewMode` type.

### `TagFilterBar` (`src/components/collection/TagFilterBar.tsx`)
Tag chip filter row; active chips tint with the tag color; multiple tags AND-combine.
- **Props**: `tags`, `activeTagIds`, `onToggle`, `onClear`

### `ItemsDisplay` (`src/components/collection/ItemsDisplay.tsx`)
Renders non-group items in the active view mode with drag-to-reorder slots and folder drop targets. Takes the whole `dnd` hook return as a prop.

### `GroupList` (`src/components/collection/GroupList.tsx`)
Draggable virtual-group sections with reorder slots; delegates per-group rendering to `GroupSection`.

### `GroupSection` (`src/components/collection/GroupSection.tsx`)
Collapsible virtual_group container: header (toggle/add/delete), lazy-loaded children, add-to-group modal. Child rendering and drag visuals live in `GroupChildren`; this component owns the children data and mutations.

### `GroupChildren` (`src/components/collection/GroupChildren.tsx`)
Child-item layout (list/grid/gallery) with intra-group drag reorder and a "move to root" drop zone. Mutations happen via `onReorder` / `onMoveToRoot` callbacks.

### `BulkBar` (`src/components/collection/BulkBar.tsx`)
Sticky inverted action bar shown while items are selected: select all / clear, tag assign/remove/create dropdown, bulk delete.

### `CollectionModals` (`src/components/collection/CollectionModals.tsx`)
The page's modal cluster: type-aware delete confirmation, `AddItemModal`, edit `CollectionModal`.

### `FavoritesSection` / `EmptyState` / `VirtualFolderCard` / `GalleryFolderCard` (`src/components/collection/`)
Unchanged behavior from Phase 5: pinned favorites group (amber-tinted), empty placeholder, and the two folder card variants.

## Add-Item Flow

Wizard state (steps, path pick, suggestions, submit) lives in `useAddItemFlow`; `AddItemModal` renders the sliding two-panel shell (Add Item / Organise tabs). Shared form styles come from `src/styles/form.module.css`.

### `StepBar` / `PickStep` / `DetailsStep` / `MetadataStep` (`src/components/additem/`)
The wizard's progress indicator and three step bodies. `MetadataStep` renders `SmartSuggestPicker` for game path fields with suggestions.

### `PathPickerButton` (`src/components/additem/PathPickerButton.tsx`)
Dashed pick-target button (icon, state label, chosen path) shared by `PickStep` and `MetadataStep`.
- **Props**: `icon`, `idleLabel`, `selectedLabel`, `idleHint?`, `value`, `disabled?`, `onClick`

### `GroupsMenu` / `VirtualForm` (`src/components/additem/`)
The "Organise" tab: choose folder vs group, then the name form that creates the structural item.

## Item Detail Page

Data and mutations live in `useItemDetail` (load, thumbnail pick, notes autosave, favorite, delete).

### `DetailTopbar` (`src/components/detail/DetailTopbar.tsx`)
Back + favorite/open-folder/edit/delete action row.

### `ItemHeader` (`src/components/detail/ItemHeader.tsx`)
Clickable thumbnail (opens file picker), item name, strategy badge.

### `MetaSection` (`src/components/detail/MetaSection.tsx`)
Bordered label/value rows. **Props**: `entries: MetaEntry[]` (`{ label, value, mono? }`).

### `GameStatusSection` (`src/components/detail/GameStatusSection.tsx`)
Read-only play status grid (story / online / snooze) for game items.

### `GameEditFields` (`src/components/detail/GameEditFields.tsx`)
Editable game fields for `EditItemModal`: story/online status selects and the three game-type flag checkboxes.

### `GameDetailColumns` (`src/components/detail/GameDetailColumns.tsx`)
Unified two-column body for a local game's detail page: play row on top, left column = Details path rows + the page's sections (passed as children), right column = Screenshots/Mods previews. Owns the `useStrategy` metadata fetch.

### `PlayActionRow` (`src/components/detail/PlayActionRow.tsx`)
Steam-style play row: large accent Play button (tracked launch via `strategy_execute_launch_tracked`, refresh-not-rescan after) + playtime widget. **Props**: `itemId, exePath, totalSeconds, lastLaunched, onSessionEnd, onError`.

### `PathRowsCard` (`src/components/detail/PathRowsCard.tsx`)
Presentational "Details" card of labelled path rows with caller-composed action buttons. **Props**: `rows: PathRowSpec[]` (`{ key, icon, label, path, action?, sub? }`), `footer?`.

### `ScreenshotsCard` (`src/components/detail/ScreenshotsCard.tsx`)
Collapsible screenshots grid for any folder: lazy `folder_list_images` on first expand; each image renders through `ScreenshotThumb`, which canvas-downscales the source so full-resolution shots don't stall the webview. Click opens the system viewer. **Props**: `folder: string`.

### `ScreenshotThumb` (`src/components/detail/ScreenshotThumb.tsx`)
One screenshot tile: decodes its source once off-screen, paints a ~320px canvas thumbnail, keeps only that bitmap. `content-visibility: auto` skips off-screen tiles. **Props**: `path, filename, onOpen`.

### `ModsCard` (`src/components/detail/ModsCard.tsx`)
Collapsible mods file browser: each directory's children load on expand via `folder_children` (one shallow read per directory), so deep mod folders stay fast. Root loads on first card open. **Props**: `folder: string`.

## Play Page

### `PlayFilters` (`src/components/play/PlayFilters.tsx`)
Play-pool filter bar: play-mode segmented control, installed-only toggle, mood tag chips.
- **Props**: `playMode`, `onPlayModeChange`, `installedOnly`, `onInstalledOnlyChange`, `moodTags`, `selectedMoodTagId`, `onMoodTagChange`
- **Used by**: `PlayPage`

### `FeaturedCard` (`src/components/play/FeaturedCard.tsx`)
Full-width cinematic hero for the featured candidate: hero art background, status/mood chips, playtime, and the launch/skip/status/snooze action bar. Over-image UI is intentionally dark in both themes; the Launch button derives from `--color-accent`.
- **Props**: `candidate`, `onLaunch()`, `onSkip()`, `onSetStatus(status)`, `onSnooze(days)`

### `CandidateList` (`src/components/play/CandidateList.tsx`)
Horizontal scroll row of portrait candidate cards with status dot, name, playtime.
- **Props**: `candidates: PlayCandidate[]`, `onSelect(candidate)`

## Status Page

Nine components under `src/components/status/` share `status.module.css`: `OverallTab` / `LocalTab` / `SteamTab` (tab bodies), `StatTile` (animated count-up metric), `PlaytimeRow`, `GameChip`, `InstalledDonut`, `CollectionRow`, and `PlaytimeHistogram` (own module for its bars; drill-down drawer styles from the shared module).

## Tags Page

`TagsPage` orchestrates group drag-reorder; components under `src/components/tags/` each have their own module: `TagGroupSection` (rename/reorder/delete group), `TagChip` (navigate/show-items/delete), `NewTagInline`, `NewGroupInline`, `UngroupedSection`.

## Settings Page

`SettingsPage` + the seven tab panels + `SettingsControls` (SettingsSection / SettingsRow / Toggle / SegmentedControl) share `src/pages/settings/settings.module.css`.

## Steam Page

All steam components share `src/components/steam/steam.css` (global `sp-*` / `sdt-*` classes — the sanctioned exception to CSS Modules, see the decision record). `SteamPage` renders the topbar + tab switch; `LibraryTab` (with `LibrarySidebar`: global search + expandable collection groups) hosts the game grid/list — cards/rows have a right-click menu (launch first) — and the in-page detail (`GameDetailTab` behind a floating Back button; Esc returns). The detail header carries iconized favourite/edit/delete next to the name (edit opens `EditItemModal`, renaming lives there). `AccountsTab` lists loginusers.

### `GameDetailTab` (`src/components/steam/GameDetailTab.tsx`)
Composition root for the detail tab, keyed by `app_id` so child state resets per game. Children under `src/components/steam/detail/`:
- `DetailHero` — hero art, logo, editable name, play/install, playtime + achievement/OS pills
- `PlayStatsCard` / `AboutCard` — static info cards
- `NotesCard` — editable notes (loads the item description on mount)
- `PlayStatusCard` — one-click story/online status chips
- `TagsCard` — tag chips + inline picker/creator
- `AchievementsSection` / `ScreenshotsSection` / `CloudSavesSection` — lazy collapsible sections built on the `useLazySection` hook

## Pages

### `NewCollectionModal` (`src/pages/NewCollectionModal.tsx`)
Inline modal for creating a new collection. Not a shared component — lives in pages.
- **Props**: `onConfirm(input: NewCollection): Promise<void>`, `onCancel(): void`

### `TagPicker` (`src/components/common/TagPicker.tsx`)
Inline tag assignment component. Displays current tags as removable chips and provides a dropdown to assign existing tags or create new ones on the fly.
- **Props**:
  - `itemTags: Tag[]` — tags currently on the item
  - `allTags: Tag[]` — all tags in the system (for the dropdown list)
  - `onAssign(tagId: string): Promise<void>` — called when an existing tag is selected
  - `onRemove(tagId: string): Promise<void>` — called when a chip's × is clicked
  - `onCreateAndAssign(name: string, color: string): Promise<void>` — called when user types a new tag name and hits Enter or clicks "Create"
- **Notes**: Picks a random color from a built-in palette for new tags. Closes on outside click. Used by `ItemDetailPage`.

### `ItemCard` (`src/components/common/ItemCard.tsx`)
Card component for displaying a single item in a collection grid.
- **Props**:
  - `item: Item`
  - `collectionColor: string` — hex color used for the icon tinted background
  - `tags: Tag[]` — tags to show as inline chips (up to 3 shown, rest shown as "+N")
  - `onClick(): void`
  - `onDelete(e: React.MouseEvent): void`
  - `selected?: boolean` — highlights the card when part of a bulk selection
  - `onSelect?: (e: React.MouseEvent) => void` — toggles selection; when provided, a checkbox appears on hover
- **Notes**: Shows a Launch button for game strategy items. When `onSelect` is provided, clicking the card body only navigates if the item is already selected (prevents accidental navigation while selecting). Previously an inline sub-component of `CollectionPage`; extracted in Phase 3 to keep file sizes under the 300-line limit.

### `GalleryItemCard` (`src/components/common/GalleryItemCard.tsx`)
Thumbnail-dominant card for gallery view mode. Cover fills the top portion; name and tags appear in a compact footer.
- **Props**:
  - `item: Item`
  - `collectionColor: string`
  - `tags: Tag[]`
  - `onClick(): void`
  - `onDelete(e: React.MouseEvent): void`
  - `selected?: boolean` — adds an accent border/glow when selected
  - `onSelect?: (e: React.MouseEvent) => void` — shows a circular checkbox overlay on hover at top-left
- **Notes**: Overlay launch button (game items only) appears on hover. Used by `CollectionPage` in gallery mode.

### `ListItemRow` (`src/components/common/ListItemRow.tsx`)
Dense single-line row for list view mode.
- **Props**:
  - `item: Item`
  - `collectionColor: string`
  - `tags: Tag[]`
  - `onClick(): void`
  - `onDelete(e: React.MouseEvent): void`
  - `selected?: boolean` — tints the row background when selected
  - `onSelect?: (e: React.MouseEvent) => void` — shows a checkbox at the start of the row on hover
- **Notes**: Stacked inside a bordered container in `CollectionPage`. Used by `CollectionPage` in list mode.

### `FilePreview` (`src/components/common/FilePreview.tsx`)
Inline file preview component. Fetches preview data from the backend and renders it based on file type.
- **Props**: `filePath: string` — absolute path to the file to preview
- **Supported kinds**:
  - `image` — rendered as `<img>` using a base64 data URI
  - `text` — rendered in a scrollable `<pre>` block (truncated to 32 KiB with a notice)
  - `pdf` — rendered in an `<object>` embed using a base64 data URI
  - `unsupported` — shows "No preview available" notice
- **Notes**: Calls `preview_get` on mount. Re-fetches automatically when `filePath` changes. Used by `DocumentItemView`.

## Strategy Components

Local game items no longer have a strategy view — `GameDetailColumns` (detail domain) renders their unified layout.

### `DocumentItemView` (`src/components/strategies/_archive/DocumentItemView.tsx`) — archived
Browsable file tree for document collection items. Moved to `_archive/` with the other non-game strategies; not compiled into the active app.

## Tray Menu Window (`src/tray/`)

Rendered only inside the `tray-menu` popup window (`?window=tray` entry in `main.tsx` — no router, no AppShell). See `docs/ARCHITECTURE.md` § Key Architectural Decisions #3 for the window lifecycle.

### `TrayMenuApp` (`src/tray/TrayMenuApp.tsx`)
Popup window root: stamps `data-window="tray"` on `<html>` (global.css makes the body transparent), re-applies the stored theme on every open, and wires `useTrayMenu` to `TrayMenu`. Remounts the menu per open (`key={openCount}`) so the entrance animation replays.

### `TrayMenu` (`src/tray/TrayMenu.tsx`)
Presentational Steam-style popup: up to 5 recent-game rows (icon + name), separator, "Open YukiG", "Quit" (danger hover). Game icon preference: Steam community icon → item thumbnail → extracted exe icon → gamepad fallback. Token-styled, light/dark aware.
- **Props**: `frameRef`, `games: TrayRecentGame[]`, `onLaunch(itemId)`, `onOpenMain()`, `onQuit()`

### `useTrayMenu` (`src/tray/useTrayMenu.ts`)
Popup lifecycle: listens for `tray-menu:open`, refetches games, measures the frame after commit, and calls `tray_menu_present(width, height)`; Escape hides. Exposes `launch` / `openMain` / `quit` actions that hide the menu first.
