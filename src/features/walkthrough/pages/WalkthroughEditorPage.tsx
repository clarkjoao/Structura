import { useState, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Save, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useWalkthroughStore } from "../hooks/useWalkthroughStore";
import type { WalkthroughPresentation } from "../model/walkthrough.types";
import { SceneEditor } from "../components/SceneEditor";
import { toast } from "sonner";

export default function WalkthroughEditorPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { presentations, hydrated, hydrate, save, get } = useWalkthroughStore();

  const [local, setLocal] = useState<WalkthroughPresentation | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!hydrated) void hydrate();
  }, [hydrated, hydrate]);

  useEffect(() => {
    if (!id || !hydrated) return;
    const found = get(id);
    if (found && !local) setLocal(found);
  }, [id, hydrated, get, local]);

  const updateLocal = useCallback((updated: WalkthroughPresentation) => {
    setLocal(updated);
  }, []);

  const handleSave = useCallback(async () => {
    if (!local) return;
    setIsSaving(true);
    try {
      await save(local);
      toast.success(t("walkthrough.saved", "Walkthrough saved"));
    } catch {
      toast.error(t("walkthrough.saveFailed", "Failed to save walkthrough"));
    } finally {
      setIsSaving(false);
    }
  }, [local, save, t]);

  if (!hydrated) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">
        {t("common.loading", "Loading…")}
      </div>
    );
  }

  if (!id) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">
        {t("walkthrough.missingId", "Missing walkthrough id")}
      </div>
    );
  }

  if (!local) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <p className="text-sm text-muted-foreground">
          {t("walkthrough.notFound", "Walkthrough not found")}
        </p>
        <Button variant="outline" onClick={() => navigate("/walkthroughs")}>
          {t("walkthrough.backToLibrary", "Back to Library")}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-border bg-background px-4 py-3">
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={() => navigate("/walkthroughs")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>

        <div className="flex flex-1 flex-col gap-1 min-w-0">
          <Input
            className="h-auto border-0 bg-transparent px-0 py-0 text-base font-semibold shadow-none focus-visible:ring-0"
            value={local.title}
            onChange={(e) => setLocal({ ...local, title: e.target.value })}
            placeholder={t("walkthrough.untitledPlaceholder", "Untitled Walkthrough")}
          />
          {local.description && (
            <p className="truncate text-xs text-muted-foreground">{local.description}</p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {local.steps.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => navigate(`/walkthrough/${local.id}/step/0`)}
            >
              <Eye className="h-3.5 w-3.5" />
              {t("walkthrough.preview", "Preview")}
            </Button>
          )}
          <Button
            size="sm"
            className="gap-1.5"
            onClick={handleSave}
            disabled={isSaving}
          >
            <Save className="h-3.5 w-3.5" />
            {isSaving ? t("common.saving", "Saving…") : t("common.save", "Save")}
          </Button>
        </div>
      </div>

      {/* Description & notes bar */}
      <div className="flex shrink-0 items-start gap-4 border-b border-border bg-muted/10 px-4 py-3">
        <div className="flex flex-1 flex-col gap-1">
          <Label className="text-[11px] text-muted-foreground">
            {t("walkthrough.description", "Description")}
          </Label>
          <Input
            className="h-7 text-xs"
            value={local.description ?? ""}
            onChange={(e) => setLocal({ ...local, description: e.target.value })}
            placeholder={t("walkthrough.descriptionPlaceholder", "What is this walkthrough about?")}
          />
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <Label className="text-[11px] text-muted-foreground">
            {t("walkthrough.authorNotes", "Author notes")}{" "}
            <span className="font-normal">({t("walkthrough.notShownToReaders", "not shown to readers")})</span>
          </Label>
          <Input
            className="h-7 text-xs"
            value={local.authorNotes ?? ""}
            onChange={(e) => setLocal({ ...local, authorNotes: e.target.value })}
            placeholder={t("walkthrough.authorNotesPlaceholder", "Private notes for yourself")}
          />
        </div>
      </div>

      {/* Scene editor (takes remaining height) */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <SceneEditor presentation={local} onUpdate={updateLocal} />
      </div>
    </div>
  );
}
