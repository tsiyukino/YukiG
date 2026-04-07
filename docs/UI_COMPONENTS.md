# UI Components

## Layout

### `AppShell` (`src/components/layout/AppShell.tsx`)
Root layout wrapper. Renders `Sidebar` + `Header` + main content area. Activates global keyboard shortcuts via `useKeyboardShortcuts`.
- **Props**: `children: ReactNode`
- **Used by**: `App.tsx`
- **Depends on**: `useKeyboardShortcuts` hook

### `Sidebar` (`src/components/layout/Sidebar.tsx`)
Left navigation bar. Shows app logo and nav links.
- **Props**: none
- **Used by**: `AppShell`

### `Header` (`src/components/layout/Header.tsx`)
Top bar with global search input (disabled, Phase 3).
- **Props**: none
- **Used by**: `AppShell`

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

### `GameItemView` (`src/components/strategies/GameItemView.tsx`)
Renders exe path, launch button, and mod folder for game items. Shows strategy metadata fields and allows rescan.

### `DocumentItemView` (`src/components/strategies/DocumentItemView.tsx`)
Browsable file tree for document collection items. Each file row has an open-with-default button and an inline preview toggle that expands a `FilePreview` panel below the row. Auto-refreshes via `useFileWatcher` when external changes are detected.
