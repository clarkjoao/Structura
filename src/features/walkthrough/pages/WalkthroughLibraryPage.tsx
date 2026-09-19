import { useState, useCallback, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Plus, FolderOpen } from "lucide-react";
import Navbar from "@/components/Navbar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
import { useAllFolders } from "@/features/diagram";
import type { Folder } from "@/features/diagram";
import type { WalkthroughPresentation } from "../model/walkthrough.types";

type SortablePresentation = WalkthroughPresentation;
type FolderBucket = { folder: Folder | null; items: SortablePresentation[] };

function groupByFolder(
  presentations: SortablePresentation[],
  folders: Folder[],
): FolderBucket[] {
  const byId = new Map<string | null, SortablePresentation[]>();
  for (const p of presentations) {
    const key = p.folderId ?? null;
    const list = byId.get(key);
    if (list) list.push(p);
    else byId.set(key, [p]);
  }
  const buckets: FolderBucket[] = [];
  // Folder sections first, in name order
  const sortedFolders = [...folders].sort((a, b) => a.name.localeCompare(b.name));
  for (const folder of sortedFolders) {
    const items = byId.get(folder.id) ?? [];
    buckets.push({ folder, items });
  }
  // Unfiled section last, if anything
  const unfiled = byId.get(null) ?? [];
  if (unfiled.length > 0) {
    buckets.push({ folder: null, items: unfiled });
  }
  return buckets;
}

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
  const folders = useAllFolders();
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [tab, setTab] = useState<"all" | "mine" | "shared">("all");

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

  // Single-user app today: "mine" mirrors "all". "shared" is always empty.
  const listForTab = useMemo(() => {
    if (tab === "shared") return [];
    return sortedAll;
  }, [sortedAll, tab]);

  const buckets = useMemo(
    () => groupByFolder(listForTab, folders),
    [listForTab, folders],
  );

  const handleCreateNew = useCallback(async () => {
    const blank = createBlankPresentation();
    await save(blank);
    navigate(`/walkthrough/${blank.id}/edit`);
  }, [save, navigate]);

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

  return (
    <div className="min-h-screen bg-background pt-14">
      <Navbar showWalkthroughs />

      {/* Page header */}
      <header className="mx-auto max-w-6xl px-6 pt-8 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight">
              {t("walkthrough.library", "Walkthroughs")}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              {t(
                "walkthrough.librarySubtitle",
                "A walkthrough is a sequence of steps that spans multiple diagrams — pick the reader up at one diagram and drop them into the next, with each step pointing to a flow.",
              )}
            </p>
          </div>
        </div>

        <div className="mt-6">
          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
            <TabsList>
              <TabsTrigger value="all">
                {t("walkthrough.tabs.all", "All")}
              </TabsTrigger>
              <TabsTrigger value="mine">
                {t("walkthrough.tabs.mine", "Mine")}
              </TabsTrigger>
              <TabsTrigger value="shared">
                {t("walkthrough.tabs.shared", "Shared")}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="mt-6 space-y-8">
              <LibraryBody
                hydrated={hydrated}
                buckets={buckets}
                hasAnyPresentations={sortedAll.length > 0}
                onCreate={handleCreateNew}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            </TabsContent>

            <TabsContent value="mine" className="mt-6 space-y-8">
              <LibraryBody
                hydrated={hydrated}
                buckets={buckets}
                hasAnyPresentations={sortedAll.length > 0}
                onCreate={handleCreateNew}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            </TabsContent>

            <TabsContent value="shared" className="mt-6">
              <EmptySharedState />
            </TabsContent>
          </Tabs>
        </div>
      </header>

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
            <AlertDialogCancel>
              {t("common.cancel", "Cancel")}
            </AlertDialogCancel>
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

interface LibraryBodyProps {
  hydrated: boolean;
  buckets: FolderBucket[];
  hasAnyPresentations: boolean;
  onCreate: () => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

function LibraryBody({
  hydrated,
  buckets,
  hasAnyPresentations,
  onCreate,
  onEdit,
  onDelete,
}: LibraryBodyProps) {
  const { t } = useTranslation();

  if (!hydrated) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        {t("common.loading", "Loading…")}
      </div>
    );
  }

  // First-run empty state: nothing at all yet.
  if (!hasAnyPresentations && buckets.length === 0) {
    return (
      <button
        type="button"
        onClick={onCreate}
        className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border py-16 text-center transition-colors hover:border-primary/40 hover:bg-muted/30"
      >
        <Plus className="h-8 w-8 text-muted-foreground/70" />
        <div>
          <p className="text-sm font-medium text-foreground">
            {t("walkthrough.newTile.title", "New walkthrough")}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t(
              "walkthrough.newTile.subtitle",
              "Pick the first diagram and the first step",
            )}
          </p>
        </div>
      </button>
    );
  }

  // Otherwise: a "New walkthrough" tile at the top, then folder groups.
  // The tile lives in the same grid as the first folder's cards so it stays
  // aligned with them.
  const bucketsWithTile = insertLeadingTile(buckets);

  return (
    <div className="space-y-8">
      {bucketsWithTile.map((bucket, idx) => (
        <FolderBucketSection
          key={bucket.folder?.id ?? "__unfiled__"}
          bucket={bucket}
          onEdit={onEdit}
          onDelete={onDelete}
          leadingTile={
            idx === 0 ? (
              <NewWalkthroughTile onCreate={onCreate} />
            ) : undefined
          }
        />
      ))}
    </div>
  );
}

/**
 * Splits the bucket list so the first non-empty bucket shows the new-walkthrough
 * tile at the top of its grid, and any subsequent buckets render alone.
 * Empty buckets are dropped — they were only placeholders for the structure.
 */
function insertLeadingTile(buckets: FolderBucket[]): FolderBucket[] {
  const firstWithItems = buckets.findIndex((b) => b.items.length > 0);
  if (firstWithItems < 0) return [];
  return buckets.filter((b) => b.items.length > 0);
}

function NewWalkthroughTile({ onCreate }: { onCreate: () => void }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onCreate}
      className="flex h-full min-h-[140px] flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border py-8 text-center transition-colors hover:border-primary/40 hover:bg-muted/30"
    >
      <Plus className="h-6 w-6 text-muted-foreground/70" />
      <div>
        <p className="text-sm font-medium text-foreground">
          {t("walkthrough.newTile.title", "New walkthrough")}
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {t(
            "walkthrough.newTile.subtitle",
            "Pick the first diagram and the first step",
          )}
        </p>
      </div>
    </button>
  );
}

interface FolderBucketSectionProps {
  bucket: FolderBucket;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  leadingTile?: React.ReactNode;
}

function FolderBucketSection({ bucket, onEdit, onDelete, leadingTile }: FolderBucketSectionProps) {
  const { t } = useTranslation();

  return (
    <section>
      <header className="mb-3 flex items-center gap-2">
        <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {bucket.folder?.name ?? t("walkthrough.noFolderSection", "Unfiled")}
        </h2>
      </header>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {leadingTile}
        {bucket.items.map((p) => (
          <WalkthroughCard
            key={p.id}
            presentation={p}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </div>
    </section>
  );
}

function EmptySharedState() {
  const { t } = useTranslation();
  return (
    <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border text-center">
      <p className="text-sm text-muted-foreground">
        {t("walkthrough.sharedEmpty", "No walkthroughs shared yet")}
      </p>
    </div>
  );
}
