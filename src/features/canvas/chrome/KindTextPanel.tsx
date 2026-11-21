import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { Copy, TextCursorInput } from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { resolveKindText } from "@/features/diagram-kinds/context";
import type { KindTextCapture } from "@/features/diagram-kinds/kind.types";
import { useCanvasSelectionStore } from "../hooks/useCanvasSelectionStore";
import { useDiagramStore } from "@/features/diagram/store/diagram.store";
import {
  applyKindTextBuild,
  buildKindText,
  serializeKindText,
  type KindTextResult,
} from "./kindTextCapture";

const CHECK_DELAY_MS = 150;

const ACTION =
  "rounded-md border border-border px-2 py-0.5 text-[11px] font-medium text-foreground hover:bg-muted disabled:pointer-events-none disabled:opacity-50";

/**
 * "Write as text" (spec guided-journey-outline): the journey typed as an
 * outline, checked as it is typed, added after the selection in one undo step.
 * A popover, so the canvas where the steps land stays in view.
 */
export function KindTextPanel({
  capture,
  disabled,
}: {
  capture: KindTextCapture;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [result, setResult] = useState<KindTextResult | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // The check depends on the diagram and the selection too (where the text goes, jump targets).
  const diagramVersion = useDiagramStore((s) =>
    s.activeDiagramId ? s.diagrams[s.activeDiagramId]?.snapshot : undefined,
  );
  const selection = useCanvasSelectionStore((s) => s.selectedNodeIds);

  useEffect(() => {
    if (!open) return;
    if (!text.trim()) {
      setResult(null);
      return;
    }
    const timer = setTimeout(() => setResult(buildKindText(text)), CHECK_DELAY_MS);
    return () => clearTimeout(timer);
  }, [open, text, diagramVersion, selection]);

  const errors = result && "errors" in result ? result.errors : [];
  const ready = result !== null && !("errors" in result);

  const apply = () => {
    const built = buildKindText(text);
    if (!built) return;
    setResult(built);
    if (applyKindTextBuild(built)) {
      setText("");
      setResult(null);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // The canvas's own shortcuts stay out of the text area.
    event.stopPropagation();
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      apply();
    }
  };

  const copy = async () => {
    const outline = serializeKindText();
    if (outline === null) return;
    try {
      await navigator.clipboard.writeText(outline);
      toast.success(t("diagramKinds.guided.outline.copied"));
    } catch {
      // No clipboard permission: put the text in the area to copy by hand.
      setText(outline);
    }
  };

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
        className="w-[min(100vw-2rem,28rem)] p-3"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          textareaRef.current?.focus();
        }}
        onPointerDown={(event) => event.stopPropagation()}
        data-testid="kind-text-panel"
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-foreground">
            {t("diagramKinds.guided.outline.title")}
          </p>
          <button
            type="button"
            className={`${ACTION} inline-flex items-center gap-1`}
            onClick={() => void copy()}
            data-testid="kind-text-copy"
          >
            <Copy className="h-3 w-3" aria-hidden />
            {t("diagramKinds.guided.outline.copy")}
          </button>
        </div>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={onKeyDown}
          spellCheck={false}
          rows={9}
          placeholder={capture.placeholder ? resolveKindText(capture.placeholder) : undefined}
          aria-label={t("diagramKinds.guided.outline.title")}
          aria-invalid={errors.length > 0}
          className="w-full resize-y rounded-md border border-border bg-background p-2 font-mono text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
          data-testid="kind-text-input"
        />
        <p className="mt-1 text-[11px] text-muted-foreground">{resolveKindText(capture.syntax)}</p>
        {errors.length > 0 && (
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
        )}
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
            className="rounded-md bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
            disabled={!ready}
            title={t("diagramKinds.guided.outline.applyHint")}
            onClick={apply}
            data-testid="kind-text-apply"
          >
            {t("diagramKinds.guided.outline.apply")}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
