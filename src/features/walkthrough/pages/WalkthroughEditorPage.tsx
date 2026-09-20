import { useState, useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Eye, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useWalkthroughStore } from "../hooks/useWalkthroughStore";
import type { WalkthroughPresentation } from "../model/walkthrough.types";
import { SceneEditor } from "../components/SceneEditor";

/** Long enough that typing does not write on every keystroke, short enough to feel saved. */
const AUTOSAVE_DEBOUNCE_MS = 600;

export default function WalkthroughEditorPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hydrated, hydrate, save, get } = useWalkthroughStore();

  const [local, setLocal] = useState<WalkthroughPresentation | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  /** What was last written, so loading a walkthrough does not count as an edit. */
  const lastSavedRef = useRef<WalkthroughPresentation | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!hydrated) void hydrate();
  }, [hydrated, hydrate]);

  useEffect(() => {
    if (!id || !hydrated) return;
    const found = get(id);
    if (found && !local) {
      setLocal(found);
      lastSavedRef.current = found;
    }
  }, [id, hydrated, get, local]);

  /**
   * Edits are written without being asked for.
   *
   * The editor used to have a Save button and nothing else, so leaving the page
   * discarded whatever had been typed, silently. With the walkthrough now
   * mirrored into the workspace folder that would have been worse still: what
   * was never saved was never written to disk either.
   */
  useEffect(() => {
    if (!local) return;
    if (local === lastSavedRef.current) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      const toWrite = local;
      setIsSaving(true);
      void save(toWrite)
        .then(() => {
          lastSavedRef.current = toWrite;
        })
        .finally(() => setIsSaving(false));
    }, AUTOSAVE_DEBOUNCE_MS);
  }, [local, save]);

  /**
   * Leaving must not be the thing that loses the edit.
   *
   * The debounce is in flight for most of the time the author is typing, so
   * unmounting has to *flush* it rather than cancel it — the one behaviour that
   * separates autosave from a Save button nobody pressed.
   */
  const pendingRef = useRef<WalkthroughPresentation | null>(null);
  useEffect(() => {
    pendingRef.current = local;
  }, [local]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      const unsaved = pendingRef.current;
      if (!unsaved || unsaved === lastSavedRef.current) return;
      void save(unsaved);
    };
  }, [save]);

  const updateLocal = useCallback((updated: WalkthroughPresentation) => {
    setLocal(updated);
  }, []);

  if (!hydrated) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">
        {t("common.loading")}
      </div>
    );
  }

  if (!id) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">
        {t("walkthrough.missingId")}
      </div>
    );
  }

  if (!local) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <p className="text-sm text-muted-foreground">{t("walkthrough.notFound")}</p>
        <Button variant="outline" onClick={() => navigate("/walkthroughs")}>
          {t("walkthrough.backToLibrary")}
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
            placeholder={t("walkthrough.untitledPlaceholder")}
            aria-label={t("walkthrough.create.nameLabel")}
          />
          <button
            type="button"
            onClick={() => setDetailsOpen((open) => !open)}
            className="truncate text-left text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            {local.description || t("walkthrough.descriptionPlaceholder")}
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span
            className="flex items-center gap-1.5 text-xs text-muted-foreground"
            data-testid="autosave-status"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                {t("common.saving")}
              </>
            ) : (
              <>
                <Check className="h-3 w-3" />
                {t("walkthrough.saved")}
              </>
            )}
          </span>
          {local.steps.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => navigate(`/walkthrough/${local.id}/step/0`)}
            >
              <Eye className="h-3.5 w-3.5" />
              {t("walkthrough.preview")}
            </Button>
          )}
        </div>
      </div>

      {/* Description and author notes — the two fields the type has always had
          and no screen ever let anyone fill in. Folded away because they are
          written once and then rarely touched, unlike the scenes. */}
      {detailsOpen && (
        <div className="grid shrink-0 gap-3 border-b border-border bg-muted/20 px-4 py-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="walkthrough-description" className="text-xs">
              {t("walkthrough.description")}
            </Label>
            <Textarea
              id="walkthrough-description"
              rows={2}
              className="mt-1 resize-none text-sm"
              value={local.description ?? ""}
              onChange={(e) => setLocal({ ...local, description: e.target.value || undefined })}
              placeholder={t("walkthrough.descriptionPlaceholder")}
            />
          </div>
          <div>
            <Label htmlFor="walkthrough-author-notes" className="text-xs">
              {t("walkthrough.authorNotes")}{" "}
              <span className="font-normal text-muted-foreground">
                {t("walkthrough.notShownToReaders")}
              </span>
            </Label>
            <Textarea
              id="walkthrough-author-notes"
              rows={2}
              className="mt-1 resize-none text-sm"
              value={local.authorNotes ?? ""}
              onChange={(e) => setLocal({ ...local, authorNotes: e.target.value || undefined })}
              placeholder={t("walkthrough.authorNotesPlaceholder")}
            />
          </div>
        </div>
      )}

      {/* Scene editor (takes remaining height) */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <SceneEditor presentation={local} onUpdate={updateLocal} />
      </div>
    </div>
  );
}
