/**
 * Collection view — displays all items within a single collection.
 *
 * Handles three item types:
 * - Regular items (game, etc.): shown as cards, click → detail page
 * - virtual_folder / folder: clicking navigates into it (breadcrumb stack)
 * - virtual_group: inline expandable section with children rendered below it
 *
 * State lives in three hooks: useCollectionBrowse (data + navigation),
 * useBulkActions (selection + bulk mutations), useCollectionDnd (drag state).
 */
import { useParams, useNavigate } from "react-router-dom";
import { useState } from "react";
import { FolderOpen } from "lucide-react";
import { readAppPrefs } from "@/hooks/useAppPrefs";
import { useCollectionBrowse } from "@/hooks/useCollectionBrowse";
import { useBulkActions } from "@/hooks/useBulkActions";
import { useCollectionDnd } from "@/hooks/useCollectionDnd";
import { useGamesArea } from "@/components/games/GamesLayout";
import { collectionUpdate, itemDelete, itemGetById, folderDelete } from "@/services/tauriCommands";
import { NewCollection } from "@/types/collection";
import { Item } from "@/types/item";
import { ItemGridSkeleton } from "@/components/common/Skeleton";
import EmptyState from "@/components/collection/EmptyState";
import FavoritesSection from "@/components/collection/FavoritesSection";
import CollectionHeader, { ItemViewMode } from "@/components/collection/CollectionHeader";
import TagFilterBar from "@/components/collection/TagFilterBar";
import ItemsDisplay from "@/components/collection/ItemsDisplay";
import GroupList from "@/components/collection/GroupList";
import BulkBar from "@/components/collection/BulkBar";
import CollectionModals from "@/components/collection/CollectionModals";
import styles from "./CollectionPage.module.css";

/**
 * Displays items within a collection with tag-based filtering,
 * bulk actions, drag-and-drop, and create/delete flows.
 */
export default function CollectionPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { collapsed, UnfiledColumn } = useGamesArea();

  const browse = useCollectionBrowse(id!);
  const {
    collection, setCollection, collectionError, loading, error, refreshRoot,
    rootItems, currentItems, setCurrentItems, folderStack, isAtRoot, currentFolder,
    itemTagMap, collectionTags, refreshTags, activeTagIds, toggleTag, clearTagFilter,
    visibleItems, virtualGroups, favoriteItems, openVirtualFolder, navigateUp, refreshCurrent,
  } = browse;

  const [groupRefreshKey, setGroupRefreshKey] = useState(0);
  const bumpGroups = () => setGroupRefreshKey((k) => k + 1);

  const bulk = useBulkActions({ visibleItems, itemTagMap, refreshCurrent, refreshTags });
  const dnd = useCollectionDnd({
    visibleItems, virtualGroups, setCurrentItems, refreshCurrent, onStructureChange: bumpGroups,
  });

  const [deleteTarget, setDeleteTarget] = useState<Item | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditCollection, setShowEditCollection] = useState(false);
  const [viewMode, setViewMode] = useState<ItemViewMode>(
    () => (localStorage.getItem(`collection-view-${id}`) as ItemViewMode | null) ?? readAppPrefs().defaultCollectionView
  );

  function handleSetViewMode(v: ItemViewMode) {
    localStorage.setItem(`collection-view-${id}`, v);
    setViewMode(v);
  }

  /** Navigate into a folder, resetting any active selection. */
  async function openFolder(folder: Item) {
    await openVirtualFolder(folder);
    bulk.exitSelectionMode();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    if (deleteTarget.strategy_type === "folder") {
      await folderDelete(deleteTarget.id);
    } else {
      await itemDelete(deleteTarget.id);
    }
    setDeleteTarget(null);
    bumpGroups();
    await refreshCurrent();
    if (isAtRoot) refreshTags();
  }

  async function handleEditCollection(input: NewCollection) {
    if (!collection) return;
    const updated = await collectionUpdate(collection.id, {
      name: input.name,
      description: input.description,
      color: input.color,
      default_strategy: input.default_strategy,
    });
    setCollection(updated);
    setShowEditCollection(false);
  }

  const openItem = (item: Item) => navigate(`/collections/${id}/items/${item.id}`);

  if (loading || !collection) {
    return <div className={styles.loadingPad}><ItemGridSkeleton rows={2} /></div>;
  }
  if (error || collectionError) {
    return (
      <div className={styles.errorState}>
        <span className={styles.errorMsg}>{error || collectionError}</span>
        <button className={styles.retry} onClick={refreshRoot}>Retry</button>
      </div>
    );
  }

  const totalCount = isAtRoot ? rootItems.length : currentItems.length;

  return (
    <div className={styles.outer}>
      <div className={styles.page}>
        <CollectionHeader
          collection={collection}
          folderStack={folderStack}
          isAtRoot={isAtRoot}
          totalCount={totalCount}
          viewMode={viewMode}
          onViewModeChange={handleSetViewMode}
          selectionMode={bulk.selectionMode}
          onToggleSelectionMode={() => bulk.selectionMode ? bulk.exitSelectionMode() : bulk.setSelectionMode(true)}
          onBack={() => navigate(-1)}
          onNavigateUp={navigateUp}
          onEdit={() => setShowEditCollection(true)}
          onAdd={() => setShowAddModal(true)}
        />

        <div className={collapsed ? `${styles.split} ${styles.splitCollapsed}` : styles.split}>
        <div className={styles.splitMain}>
        {isAtRoot && collectionTags.length > 0 && (
          <TagFilterBar
            tags={collectionTags}
            activeTagIds={activeTagIds}
            onToggle={toggleTag}
            onClear={clearTagFilter}
          />
        )}

        {currentItems.length === 0 ? (
          <EmptyState onAdd={() => setShowAddModal(true)} isFolder={!isAtRoot} />
        ) : (
          <div className={styles.content}>
            {favoriteItems.length > 0 && (
              <FavoritesSection
                items={favoriteItems}
                collectionColor={collection.color}
                itemTagMap={itemTagMap}
                viewMode={viewMode}
                onItemClick={openItem}
                onItemDelete={(item) => setDeleteTarget(item)}
              />
            )}

            <GroupList
              groups={virtualGroups}
              collection={collection}
              collectionId={id!}
              itemTagMap={itemTagMap}
              viewMode={viewMode}
              refreshKey={groupRefreshKey}
              dnd={dnd}
              selectionMode={bulk.selectionMode}
              selectedIds={bulk.selectedIds}
              onToggleSelect={bulk.toggleSelect}
              onItemClick={openItem}
              onDelete={(item) => setDeleteTarget(item)}
              onChildMoved={() => { refreshCurrent(); bumpGroups(); }}
            />

            {visibleItems.length > 0 && (
              <ItemsDisplay
                items={visibleItems}
                viewMode={viewMode}
                collection={collection}
                itemTagMap={itemTagMap}
                currentFolderId={currentFolder?.id ?? null}
                dnd={dnd}
                selectionMode={bulk.selectionMode}
                selectedIds={bulk.selectedIds}
                onToggleSelect={bulk.toggleSelect}
                onOpenFolder={openFolder}
                onItemClick={openItem}
                onDelete={(item) => setDeleteTarget(item)}
              />
            )}
          </div>
        )}

        {dnd.draggingItemId !== null && dnd.dragSourceParentIdRef.current !== null && (
          <div
            className={dnd.dropTargetIsRoot ? `${styles.rootDrop} ${styles.rootDropActive}` : styles.rootDrop}
            onDragOver={(e) => { e.preventDefault(); dnd.hoverRoot(true); }}
            onDragLeave={() => dnd.hoverRoot(false)}
          >
            <FolderOpen size={14} strokeWidth={1.5} />
            Drop here to move to root level
          </div>
        )}
        </div>
          <UnfiledColumn />
        </div>

        <CollectionModals
          collection={collection}
          deleteTarget={deleteTarget}
          onConfirmDelete={handleDelete}
          onCancelDelete={() => setDeleteTarget(null)}
          showAdd={showAddModal}
          addParentId={currentFolder?.id ?? null}
          onAddSuccess={async (newItemId, strategyType) => {
            setShowAddModal(false);
            await refreshCurrent();
            if (strategyType === "folder") {
              // Disk-backed folder: navigate into it immediately like a virtual folder.
              const folderItem = await itemGetById(newItemId);
              await openFolder(folderItem);
            } else if (strategyType !== "virtual_folder" && strategyType !== "virtual_group") {
              navigate(`/collections/${id}/items/${newItemId}`);
            }
          }}
          onCloseAdd={() => setShowAddModal(false)}
          showEdit={showEditCollection}
          onEditConfirm={handleEditCollection}
          onCloseEdit={() => setShowEditCollection(false)}
        />
      </div>

      {bulk.selectedIds.size > 0 && (
        <BulkBar
          selectedCount={bulk.selectedIds.size}
          onSelectAll={bulk.selectAll}
          onClearSelection={bulk.clearSelection}
          bulkDeleting={bulk.bulkDeleting}
          onBulkDelete={bulk.bulkDelete}
          allTags={bulk.allTags}
          sharedTagIds={bulk.sharedTagIds}
          bulkTagBusy={bulk.bulkTagBusy}
          onTagAssign={bulk.bulkTagAssign}
          onTagRemove={bulk.bulkTagRemove}
          onTagCreate={bulk.bulkTagCreate}
        />
      )}
    </div>
  );
}
