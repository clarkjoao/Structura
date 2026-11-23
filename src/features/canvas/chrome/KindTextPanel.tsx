import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, Copy, TextCursorInput } from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { resolveKindText } from "@/features/diagram-kinds/context";
import type {
  KindTextBase,
  KindTextCapture,
  KindTextError,
  KindTextReconcile,
} from "@/features/diagram-kinds/kind.types";
import { cn } from "@/lib/utils";
import { useCanvasSelectionStore } from "../hooks/useCanvasSelectionStore";
import { useDiagramStore } from "@/features/diagram/store/diagram.store";
import {
  applyKindTextBuild,
  applyKindTextReconcile,
  buildKindText,
  reconcileKindText,
  serializeKindText,
  writeKindTextBase,
  type KindTextResult,
} from "./kindTextCapture";

const CHECK_DELAY_MS = 150;

const ACTION =
  "rounded-md border border-border px-2 py-0.5 text-[11px] font-medium text-foreground hover:bg-muted disabled:pointer-events-none disabled:opacity-50";

const PRIMARY =
  "rounded-md bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50";

const TEXTAREA =
  "w-full resize-y rounded-md border border-border bg-background p-2 font-mono text-xs text-foreground outline-none focus:ring-1 focus:ring-ring";

function ErrorList({ errors }: { errors: readonly KindTextError[] }) {
  const { t } = useTranslation();
  if (errors.length === 0) return null;
  return (
    <ul
      role="alert"
      className="mt-2 max-h-28 space-y-0.5 overflow-y-auto text-[11px] text-destructive"
      data-testid="kind-text-errors"
    >
      {errors.map((error, index) => (
        <li key={`${error.line}-${index}`}>
          <span className="font-mono">
            {t("diagramKinds.guided.outline.line", { line: error.line })}
          </span>
          {": "}
          {resolveKindText(error.message, error.values)}
        </li>
      ))}
    </ul>
  );
}

/**
 * The kind's text panel (specs guided-journey-outline, guided-journey-text-sync).
 * With a kind that reconciles text, it holds the whole journey: edits are checked
 * as they are typed, reviewed change by change, and applied as one undo step; it
 * follows the canvas while untouched. "Insert at the selection" keeps adding a
 * typed outline after the selected step. A popover, so the canvas stays in view.
 */
export function KindTextPanel({
  capture,
  disabled,
}: {
  capture: KindTextCapture;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const whole = Boolean(capture.writeBase && capture.reconcile);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"journey" | "insert">(whole ? "journey" : "insert");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // The checks depend on the diagram and the selection too (where the text goes, jump targets).
  const diagramVersion = useDiagramStore((s) =>
    s.activeDiagramId ? s.diagrams[s.activeDiagramId]?.snapshot : undefined,
  );
  const selection = useCanvasSelectionStore((s) => s.selectedNodeIds);
  const journey = whole && mode === "journey";

  // Insert at the selection: a typed outline, added after the selected step.
  const [text, setText] = useState("");
  const [result, setResult] = useState<KindTextResult | null>(null);
  useEffect(() => {
    if (!open || journey) return;
    if (!text.trim()) {
      setResult(null);
      return;
    }
    const timer = setTimeout(() => setResult(buildKindText(text)), CHECK_DELAY_MS);
    return () => clearTimeout(timer);
  }, [open, journey, text, diagramVersion, selection]);
  const insertErrors = result && "errors" in result ? result.errors : [];
  const insertReady = result !== null && !("errors" in result);
  const insert = () => {
    const built = buildKindText(text);
    if (!built) return;
    setResult(built);
    if (applyKindTextBuild(built)) {
      setText("");
      setResult(null);
    }
  };

  // The whole journey: the text the panel wrote, the user's draft of it, and their difference.
  const [base, setBase] = useState<KindTextBase | null>(null);
  const [draft, setDraft] = useState("");
  const [stale, setStale] = useState(false);
  const [review, setReview] = useState<KindTextReconcile | null>(null);
  const [showReview, setShowReview] = useState(false);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const baseRef = useRef(base);
  baseRef.current = base;
  const rebase = () => {
    const next = writeKindTextBase();
    setBase(next);
    setDraft(next?.text ?? "");
    setStale(false);
    setReview(null);
  };
  useEffect(() => {
    if (!open || !journey) return;
    const current = baseRef.current;
    // Untouched, the text follows the diagram; edited, the edit is kept and flagged.
    if (current && draftRef.current !== current.text) setStale(true);
    else rebase();
  }, [open, journey, diagramVersion]);
  const dirty = base !== null && draft !== base.text;
  useEffect(() => {
    if (!open || !journey || !base || !dirty) {
      setReview(null);
      return;
    }
    const timer = setTimeout(() => setReview(reconcileKindText(base, draft)), CHECK_DELAY_MS);
    return () => clearTimeout(timer);
  }, [open, journey, base, draft, dirty, diagramVersion]);
  const journeyErrors = review && "errors" in review ? review.errors : [];
  const changes = review && !("errors" in review) ? review.changes : [];
  const added = changes.filter((c) => c.kind === "add").length;
  const removed = changes.filter((c) => c.kind === "remove").length;
  const applyJourney = () => {
    if (!base) return;
    const next = reconcileKindText(base, draft);
    if (!next) return;
    setReview(next);
    if (applyKindTextReconcile(next)) {
      rebase();
      setShowReview(false);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // The canvas's own shortcuts stay out of the text area.
    event.stopPropagation();
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      if (journey) applyJourney();
      else insert();
    }
  };

  const copy = async (formatId?: string) => {
    const outline = serializeKindText(formatId);
    if (outline === null) return;
    try {
      await navigator.clipboard.writeText(outline);
      toast.success(t("diagramKinds.guided.outline.copied"));
    } catch {
      // No clipboard permission: put the text where it can be copied by hand.
      if (journey) setDraft(outline);
      else setText(outline);
    }
  };

  const tab = (value: "journey" | "insert", label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={mode === value}
      onClick={() => setMode(value)}
      className={cn(
        "rounded px-1.5 py-0.5 text-[11px] font-medium",
        mode === value ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
      data-testid={`kind-text-mode-${value}`}
    >
      {label}
    </button>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`${ACTION} inline-flex items-center gap-1`}
          disabled={disabled}
          title={t("diagramKinds.guided.outline.openHint")}
          data-testid="kind-text-open"
        >
          <TextCursorInput className="h-3 w-3" aria-hidden />
          {t("diagramKinds.guided.outline.open")}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[min(100vw-2rem,30rem)] p-3"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          textareaRef.current?.focus();
        }}
        onPointerDown={(event) => event.stopPropagation()}
        data-testid="kind-text-panel"
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          {whole ? (
            <div role="tablist" className="flex items-center gap-1">
              {tab("journey", t("diagramKinds.guided.text.journey"))}
              {tab("insert", t("diagramKinds.guided.text.insert"))}
            </div>
          ) : (
            <p className="text-xs font-semibold text-foreground">
              {t("diagramKinds.guided.outline.title")}
            </p>
          )}
          {capture.formats && capture.formats.length > 1 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={`${ACTION} inline-flex items-center gap-1`}
                  data-testid="kind-text-copy"
                >
                  <Copy className="h-3 w-3" aria-hidden />
                  {t("diagramKinds.guided.mermaid.copyAs")}
                  <ChevronDown className="h-3 w-3" aria-hidden />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onPointerDown={(e) => e.stopPropagation()}>
                {capture.formats.map((format) => (
                  <DropdownMenuItem
                    key={format.id}
                    onSelect={() => void copy(format.id)}
                    className="text-xs"
                    data-testid={`kind-text-copy-${format.id}`}
                  >
                    {resolveKindText(format.label)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <button
              type="button"
              className={`${ACTION} inline-flex items-center gap-1`}
              onClick={() => void copy()}
              data-testid="kind-text-copy"
            >
              <Copy className="h-3 w-3" aria-hidden />
              {t("diagramKinds.guided.outline.copy")}
            </button>
          )}
        </div>

        {journey ? (
          <>
            {stale && (
              <div
                role="status"
                className="mb-2 flex items-center justify-between gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[11px] text-foreground"
                data-testid="kind-text-stale"
              >
                <span>{t("diagramKinds.guided.text.stale")}</span>
                <button
                  type="button"
                  className={ACTION}
                  onClick={rebase}
                  data-testid="kind-text-reload"
                >
                  {t("diagramKinds.guided.text.reload")}
                </button>
              </div>
            )}
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={onKeyDown}
              spellCheck={false}
              rows={14}
              aria-label={t("diagramKinds.guided.text.journey")}
              aria-invalid={journeyErrors.length > 0}
              className={TEXTAREA}
              data-testid="kind-text-journey"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              {resolveKindText(capture.syntax)}
            </p>
            <ErrorList errors={journeyErrors} />
            {showReview && changes.length > 0 && (
              <ul
                className="mt-2 max-h-40 space-y-0.5 overflow-y-auto rounded-md border border-border p-2 text-[11px] text-foreground"
                data-testid="kind-text-review"
              >
                {changes.map((change) => (
                  <li key={change.key}>{resolveKindText(change.label, change.values)}</li>
                ))}
              </ul>
            )}
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="text-[11px] text-muted-foreground" data-testid="kind-text-summary">
                {changes.length > 0
                  ? t("diagramKinds.guided.text.count", {
                      added,
                      removed,
                      changed: changes.length - added - removed,
                    })
                  : journeyErrors.length === 0
                    ? t("diagramKinds.guided.text.noChanges")
                    : ""}
              </span>
              <div className="flex items-center gap-1.5">
                {changes.length > 0 && (
                  <button
                    type="button"
                    className={ACTION}
                    aria-expanded={showReview}
                    onClick={() => setShowReview((v) => !v)}
                    data-testid="kind-text-review-toggle"
                  >
                    {showReview
                      ? t("diagramKinds.guided.text.reviewHide")
                      : t("diagramKinds.guided.text.review")}
                  </button>
                )}
                <button
                  type="button"
                  className={PRIMARY}
                  disabled={changes.length === 0}
                  title={t("diagramKinds.guided.outline.applyHint")}
                  onClick={applyJourney}
                  data-testid="kind-text-apply"
                >
                  {t("diagramKinds.guided.outline.apply")}
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={onKeyDown}
              spellCheck={false}
              rows={9}
              placeholder={
                whole
                  ? t("diagramKinds.guided.text.insertPlaceholder")
                  : capture.placeholder
                    ? resolveKindText(capture.placeholder)
                    : undefined
              }
              aria-label={t("diagramKinds.guided.outline.title")}
              aria-invalid={insertErrors.length > 0}
              className={TEXTAREA}
              data-testid="kind-text-input"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              {resolveKindText(capture.syntax)}
            </p>
            <ErrorList errors={insertErrors} />
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="text-[11px] text-muted-foreground" data-testid="kind-text-summary">
                {result && "summary" in result
                  ? resolveKindText(result.summary, result.summaryValues)
                  : !text.trim()
                    ? t("diagramKinds.guided.outline.empty")
                    : ""}
              </span>
              <button
                type="button"
                className={PRIMARY}
                disabled={!insertReady}
                title={t("diagramKinds.guided.outline.applyHint")}
                onClick={insert}
                data-testid="kind-text-insert-apply"
              >
                {whole
                  ? t("diagramKinds.guided.text.insertApply")
                  : t("diagramKinds.guided.outline.apply")}
              </button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
