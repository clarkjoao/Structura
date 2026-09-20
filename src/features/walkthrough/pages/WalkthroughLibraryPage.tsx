import { useState, useCallback, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Plus, ChevronRight } from "lucide-react";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FolderTree } from "@/components/folders/FolderTree";
import { WALKTHROUGH_DRAG_MIME } from "@/components/folders/dragTypes";
import { LibraryFilterToolbar, type ViewMode } from "@/components/filters/LibraryFilterToolbar";
import { useWalkthroughStore, createBlankPresentation } from "../hooks/useWalkthroughStore";
import { WalkthroughCard } from "../components/WalkthroughCard";
import { WalkthroughList } from "../components/WalkthroughList";
import { AddWalkthroughDialog, type NewWalkthroughDraft } from "../components/AddWalkthroughDialog";
import { useFolders, type Folder } from "@/features/diagram";
import {
  countByFolderId,
  selectWalkthroughs,
  type WalkthroughChip,
  type WalkthroughSortKey,
} from "../walkthroughFiltering";
import { readFavoriteWalkthroughIds, toggleFavoriteWalkthrough } from "../favoriteWalkthroughs";
import type { WalkthroughPresentation } from "../model/walkthrough.types";

export default function WalkthroughLibraryPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    presentations,
    hydrated,
    hydrate,
    save,
    delete: deletePresentation,
  } = useWalkthroughStore();
  const foldersRecord = useFolders();

  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const [chip, setChip] = useState<WalkthroughChip>("all");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<WalkthroughSortKey>("updatedAt");
  const [sortAsc, setSortAsc] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [favoriteIds, setFavoriteIds] = useState<readonly string[]>([]);
  const [dropTargetFolderId, setDropTargetFolderId] = useState<string | null | undefined>(
    undefined,
  );

  useEffect(() => {
    if (!hydrated) void hydrate();
  }, [hydrated, hydrate]);

  useEffect(() => {
    void readFavoriteWalkthroughIds().then(setFavoriteIds);
  }, []);

  const favoriteIdSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);
  const allPresentations = useMemo(() => Object.values(presentations), [presentations]);

  const visibleItems = useMemo(
    () =>
      selectWalkthroughs({
        presentations: allPresentations,
        folders: foldersRecord,
        selectedFolderId,
        chip,
        search,
        sortKey,
        sortAsc,
        favoriteIds: favoriteIdSet,
      }),
    [
      allPresentations,
      foldersRecord,
      selectedFolderId,
      chip,
      search,
      sortKey,
      sortAsc,
      favoriteIdSet,
    ],
  );

  const directCounts = useMemo(
    () => countByFolderId(allPresentations, foldersRecord),
    [allPresentations, foldersRecord],
  );

  const countFor = useCallback(
    (folderId: string) => directCounts.get(folderId) ?? 0,
    [directCounts],
  );

  const handleToggleFavorite = useCallback((id: string) => {
    void toggleFavoriteWalkthrough(id).then(setFavoriteIds);
  }, []);

  const handleDropOnFolder = useCallback(
    (folderId: string | null, walkthroughId: string) => {
      setDropTargetFolderId(undefined);
      const presentation = presentations[walkthroughId];
      if (!presentation) return;
      if ((presentation.folderId ?? null) === folderId) return;
      void save({ ...presentation, folderId });
    },
    [presentations, save],
  );

  const walkthroughDrag = useMemo(
    () => ({
      mimeType: WALKTHROUGH_DRAG_MIME,
      dropTargetFolderId,
      onDragOverFolder: setDropTargetFolderId,
      onDragLeave: () => setDropTargetFolderId(undefined),
      onDropItem: handleDropOnFolder,
    }),
    [dropTargetFolderId, handleDropOnFolder],
  );

  const filterChips = useMemo(
    () => [
      { value: "all" as const, label: t("common.all") },
      { value: "recent" as const, label: t("dashboard.filterRecent") },
      { value: "favorites" as const, label: t("dashboard.filterFavorites") },
    ],
    [t],
  );

  const sortOptions = useMemo(
    () => [
      { key: "name" as const, label: t("common.name") },
      { key: "updatedAt" as const, label: t("common.lastEdited") },
      { key: "sceneCount" as const, label: t("walkthrough.sortByScenes") },
    ],
    [t],
  );

  const handleSort = useCallback(
    (key: WalkthroughSortKey) => {
      if (key === sortKey) setSortAsc((asc) => !asc);
      else {
        setSortKey(key);
        setSortAsc(key === "name");
      }
    },
    [sortKey],
  );

  // Breadcrumb path for the current folder selection (root → … → selected).
  const breadcrumbPath = useMemo(() => {
    if (selectedFolderId === null) return [] as Folder[];
    const path: Folder[] = [];
    let cur: Folder | undefined = foldersRecord[selectedFolderId];
    while (cur) {
      path.unshift(cur);
      cur = cur.parentId ? foldersRecord[cur.parentId] : undefined;
    }
    return path;
  }, [selectedFolderId, foldersRecord]);

  const handleCreateNew = useCallback(
    async (draft: NewWalkthroughDraft) => {
      const blank = createBlankPresentation(draft.title, draft.folderId);
      await save({ ...blank, description: draft.description });
      setCreateOpen(false);
      navigate(`/walkthrough/${blank.id}/edit`);
    },
    [save, navigate],
  );

  const handleEdit = useCallback((id: string) => navigate(`/walkthrough/${id}/edit`), [navigate]);

  const handleDelete = useCallback((id: string) => setDeleteTargetId(id), []);

  const confirmDelete = useCallback(async () => {
    if (deleteTargetId) {
      await deletePresentation(deleteTargetId);
      setDeleteTargetId(null);
    }
  }, [deleteTargetId, deletePresentation]);

  const targetPresentation = deleteTargetId ? presentations[deleteTargetId] : null;
  const currentFolderName =
    selectedFolderId === null
      ? t("walkthrough.folderTree.all")
      : (foldersRecord[selectedFolderId]?.name ?? "");

  return (
    <div className="min-h-screen pt-14">
      <Navbar showWalkthroughs />

      <div className="flex h-[calc(100vh-3.5rem)]">
        {/* Folder tree (left rail) — the workspace's own folders. */}
        <div className="w-56 shrink-0 overflow-hidden border-r border-border">
          <FolderTree
            folders={foldersRecord}
            selectedFolderId={selectedFolderId}
            onSelectFolder={setSelectedFolderId}
            countFor={countFor}
            rootCount={allPresentations.length}
            headerLabel={t("walkthrough.library")}
            allLabel={t("walkthrough.folderTree.all")}
            drag={walkthroughDrag}
          />
        </div>

        {/* Right column */}
        <div className="flex min-w-0 flex-1 flex-col bg-background">
          {/* Header bar */}
          <div className="flex items-center justify-between border-b border-border px-5 py-2.5">
            <div className="flex min-w-0 items-center gap-1 text-sm">
              <button
                type="button"
                onClick={() => setSelectedFolderId(null)}
                className={
                  selectedFolderId === null
                    ? "font-semibold text-foreground"
                    : "text-muted-foreground transition-colors hover:text-foreground"
                }
              >
                {t("walkthrough.folderTree.all")}
              </button>
              {breadcrumbPath.map((folder) => (
                <span key={folder.id} className="flex min-w-0 items-center gap-1">
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                  <span
                    className={
                      folder.id === selectedFolderId
                        ? "truncate font-semibold text-foreground"
                        : "truncate text-muted-foreground transition-colors hover:text-foreground"
                    }
                  >
                    {folder.name}
                  </span>
                </span>
              ))}
            </div>

            <Button size="sm" className="h-8 gap-1.5" onClick={() => setCreateOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              {t("walkthrough.newTile.title")}
            </Button>
          </div>

          {/* Content area */}
          <div className="flex-1 overflow-y-auto px-5 pt-4">
            <LibraryFilterToolbar
              chips={filterChips}
              activeChip={chip}
              onChipChange={setChip}
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder={t("walkthrough.searchPlaceholder")}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              sortOptions={sortOptions}
              onSort={handleSort}
            />

            {!hydrated ? (
              <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
                {t("common.loading", "Loading…")}
              </div>
            ) : visibleItems.length === 0 ? (
              <EmptyState
                hasAnyPresentation={allPresentations.length > 0}
                folderName={currentFolderName}
                onCreate={() => setCreateOpen(true)}
              />
            ) : viewMode === "grid" ? (
              <CardGrid
                items={visibleItems}
                onEdit={handleEdit}
                onDelete={handleDelete}
                favoriteIds={favoriteIdSet}
                onToggleFavorite={handleToggleFavorite}
              />
            ) : (
              <WalkthroughList
                items={visibleItems}
                folders={foldersRecord}
                onEdit={handleEdit}
                onDelete={handleDelete}
                favoriteIds={favoriteIdSet}
                onToggleFavorite={handleToggleFavorite}
              />
            )}
          </div>
        </div>
      </div>

      {/* Create modal */}
      {createOpen && (
        <AddWalkthroughDialog
          onClose={() => setCreateOpen(false)}
          onCreate={handleCreateNew}
          folderId={selectedFolderId}
        />
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={!!deleteTargetId}
        onOpenChange={(open) => {
          if (!open) setDeleteTargetId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("walkthrough.deleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("walkthrough.deleteConfirmMessage", {
                title: targetPresentation?.title ?? "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmDelete}
            >
              {t("common.delete", "Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface EmptyStateProps {
  hasAnyPresentation: boolean;
  folderName: string;
  onCreate: () => void;
}

function EmptyState({ hasAnyPresentation, folderName, onCreate }: EmptyStateProps) {
  const { t } = useTranslation();
  return (
    <div className="flex h-full items-center justify-center px-6 py-16">
      <div className="flex w-full max-w-md flex-col items-center gap-3 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-dashed border-border">
          <Plus className="h-5 w-5 text-muted-foreground/70" />
        </div>
        <p className="text-sm font-medium text-foreground">
          {hasAnyPresentation
            ? t("walkthrough.empty.filtered", { name: folderName })
            : t("walkthrough.empty.title")}
        </p>
        <p className="text-xs text-muted-foreground">
          {hasAnyPresentation
            ? t("walkthrough.empty.filteredSubtitle")
            : t("walkthrough.empty.subtitle")}
        </p>
        <Button size="sm" className="mt-2 gap-1.5" onClick={onCreate}>
          <Plus className="h-3.5 w-3.5" />
          {t("walkthrough.newTile.title")}
        </Button>
      </div>
    </div>
  );
}

interface CardGridProps {
  items: WalkthroughPresentation[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  favoriteIds: ReadonlySet<string>;
  onToggleFavorite: (id: string) => void;
}

function CardGrid({ items, onEdit, onDelete, favoriteIds, onToggleFavorite }: CardGridProps) {
  return (
    <div className="grid grid-cols-1 gap-4 pb-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((p) => (
        <WalkthroughCard
          key={p.id}
          presentation={p}
          onEdit={onEdit}
          onDelete={onDelete}
          isFavorite={favoriteIds.has(p.id)}
          onToggleFavorite={onToggleFavorite}
        />
      ))}
    </div>
  );
}
