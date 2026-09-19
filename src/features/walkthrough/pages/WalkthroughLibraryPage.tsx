import { useState, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Plus, Clapperboard, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

export default function WalkthroughLibraryPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { presentations, hydrated, hydrate, save, delete: deletePresentation } = useWalkthroughStore();
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  useEffect(() => {
    if (!hydrated) void hydrate();
  }, [hydrated, hydrate]);

  const sorted = Object.values(presentations).sort(
    (a, b) => b.updatedAt - a.updatedAt,
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center gap-4 border-b border-border bg-background/95 px-6 py-4 backdrop-blur">
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={() => navigate("/workspace")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2">
          <Clapperboard className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold">
            {t("walkthrough.library", "Walkthrough Library")}
          </h1>
        </div>
        <div className="ml-auto">
          <Button onClick={handleCreateNew} size="sm" className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            {t("walkthrough.newWalkthrough", "New Walkthrough")}
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-6xl px-6 py-6">
        {!hydrated ? (
          <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
            {t("common.loading", "Loading…")}
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed border-border py-20 text-center">
            <Clapperboard className="h-12 w-12 text-muted-foreground/50" />
            <div>
              <p className="text-sm font-medium text-foreground">
                {t("walkthrough.emptyLibraryTitle", "No walkthroughs yet")}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t(
                  "walkthrough.emptyLibraryMessage",
                  "Create your first walkthrough to guide readers through your diagrams.",
                )}
              </p>
            </div>
            <Button onClick={handleCreateNew} size="sm" className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              {t("walkthrough.newWalkthrough", "New Walkthrough")}
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sorted.map((p) => (
              <WalkthroughCard
                key={p.id}
                presentation={p}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTargetId} onOpenChange={() => setDeleteTargetId(null)}>
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
