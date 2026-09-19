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
import { useWalkthroughStore, createBlankPresentation } from "../hooks/useWalkthroughStore";
import { WalkthroughCard } from "../components/WalkthroughCard";
import { WalkthroughFolderTree } from "../components/WalkthroughFolderTree";
import {
  AddWalkthroughDialog,
  type NewWalkthroughDraft,
} from "../components/AddWalkthroughDialog";
import { useFolders, type Folder } from "@/features/diagram";
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

  useEffect(() => {
    if (!hydrated) void hydrate();
  }, [hydrated, hydrate]);

  const sortedAll = useMemo(
    () =>
      Object.values(presentations).sort(
        (a, b) => b.updatedAt - a.updatedAt,
      ),
    [presentations],
  );

  // Visible items for the currently-selected folder. `null` = All (no filter).
  const visibleItems = useMemo(() => {
    if (selectedFolderId === null) return sortedAll;
    return sortedAll.filter((p) => p.folderId === selectedFolderId);
  }, [sortedAll, selectedFolderId]);

  // Counts per folder for the sidebar. Map key: folderId, or `null` for the
  // "All walkthroughs" row's tally.
  const countByFolderId = useMemo(() => {
    const map = new Map<string | null, number>();
    for (const p of Object.values(presentations)) {
      const key = p.folderId ?? null;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [presentations]);

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
      const blank = createBlankPresentation(draft.title, draft.description, draft.folderId);
      await save(blank);
      setCreateOpen(false);
      navigate(`/walkthrough/${blank.id}/edit`);
    },
    [save, navigate],
  );

  const handleEdit = useCallback(
    (id: string) => navigate(`/walkthrough/${id}/edit`),
    [navigate],
  );

  const handleDelete = useCallback(
    (id: string) => setDeleteTargetId(id),
    [],
  );

  const confirmDelete = useCallback(async () => {
    if (deleteTargetId) {
      await deletePresentation(deleteTargetId);
      setDeleteTargetId(null);
    }
  }, [deleteTargetId, deletePresentation]);

  const targetPresentation = deleteTargetId ? presentations[deleteTargetId] : null;
  const currentFolderName =
    selectedFolderId === null
      ? t("walkthrough.folderTree.all", "All walkthroughs")
      : (foldersRecord[selectedFolderId]?.name ?? "");

  return (
    <div className="min-h-screen pt-14">
      <Navbar showWalkthroughs />

      <div className="flex h-[calc(100vh-3.5rem)]">
        {/* Folder tree (left rail) */}
        <div className="w-56 shrink-0 overflow-hidden border-r border-border">
          <WalkthroughFolderTree
            folders={foldersRecord}
            countByFolderId={countByFolderId}
            selectedFolderId={selectedFolderId}
            onSelectFolder={setSelectedFolderId}
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
                {t("walkthrough.folderTree.all", "All walkthroughs")}
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

            <Button
              size="sm"
              className="h-8 gap-1.5"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              {t("walkthrough.newTile.title", "New walkthrough")}
            </Button>
          </div>

          {/* Content area */}
          <div className="flex-1 overflow-y-auto">
            {!hydrated ? (
              <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
                {t("common.loading", "Loading…")}
              </div>
            ) : visibleItems.length === 0 ? (
              <EmptyState
                hasAnyPresentation={sortedAll.length > 0}
                folderName={currentFolderName}
                onCreate={() => setCreateOpen(true)}
              />
            ) : (
              <CardGrid
                items={visibleItems}
                onEdit={handleEdit}
                onDelete={handleDelete}
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
          defaultFolderId={selectedFolderId}
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
            <AlertDialogTitle>
              {t("walkthrough.deleteConfirmTitle", "Delete walkthrough?")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                "walkthrough.deleteConfirmMessage",
                `"${targetPresentation?.title ?? ""}" and all its scenes will be permanently deleted. This cannot be undone.`,
              )}
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
            ? t("walkthrough.empty.filtered", {
                defaultValue: `No walkthroughs in ${folderName}`,
                name: folderName,
              })
            : t("walkthrough.empty.title", "No walkthroughs yet")}
        </p>
        <p className="text-xs text-muted-foreground">
          {hasAnyPresentation
            ? t(
                "walkthrough.empty.filteredSubtitle",
                "Pick a different folder, or create a new walkthrough inside this one.",
              )
            : t(
                "walkthrough.empty.subtitle",
                "Create your first walkthrough to start guiding readers across diagrams.",
              )}
        </p>
        <Button size="sm" className="mt-2 gap-1.5" onClick={onCreate}>
          <Plus className="h-3.5 w-3.5" />
          {t("walkthrough.newTile.title", "New walkthrough")}
        </Button>
      </div>
    </div>
  );
}

interface CardGridProps {
  items: WalkthroughPresentation[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

function CardGrid({ items, onEdit, onDelete }: CardGridProps) {
  return (
    <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((p) => (
        <WalkthroughCard
          key={p.id}
          presentation={p}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
