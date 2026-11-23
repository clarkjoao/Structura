import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ChevronDown,
  PencilRuler,
  Presentation,
  Sparkles,
  Workflow,
  X,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import type { Diagram, DiagramDirection, DiagramModel } from "@/features/diagram";
import { resolveKindPolicy } from "@/features/diagram-kinds/policy";
import { editKindFreehand, returnToKind } from "@/features/diagram-kinds/actions";
import { resolveKindText } from "@/features/diagram-kinds/context";
import type { KindIssue } from "@/features/diagram-kinds/kind.types";
import { KindTextPanel } from "./KindTextPanel";

interface KindModeBarProps {
  diagram: Diagram | DiagramModel;
  /** The author may change the diagram (not a viewer, not reading a flow). */
  canEdit: boolean;
  /** Selects an element an issue names. */
  onSelectElement: (id: string) => void;
  /**
   * The diagram's reading direction and its switch (spec guided-vertical-journeys): the
   * same switch as Arrange → Direction, offered here where the journey is edited.
   */
  direction?: {
    value: DiagramDirection;
    onChange: (direction: DiagramDirection) => void;
    lockedReasonKey: string | null;
  };
  /** Presents the diagram scene by scene (guided: by phase), when the kind offers it. */
  onPresent?: () => void;
  /** Asks the assistant one of the kind's preset requests. */
  onReview?: (prompt: string) => void;
  /** Selects an element and brings it into view (the text panel's cursor on its line). */
  onFocusElement?: (id: string) => void;
}

/**
 * In the canvas's top-left corner, out of the way of the selection's floating bar, which
 * centres over whatever is selected — a lane's bar and this one met at the top centre.
 */
const PLACED = "absolute top-3 left-3 z-10";
const BOX =
  "flex max-w-[min(100vw-2rem,56rem)] flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground shadow-sm";
const BAR = `${PLACED} ${BOX}`;
const ACTION =
  "whitespace-nowrap rounded-md border border-border px-2 py-0.5 text-[11px] font-medium text-foreground hover:bg-muted disabled:pointer-events-none disabled:opacity-50";

/**
 * The diagram kind's mode on the canvas (ADR-0014): which editor is guiding
 * the diagram, and the way across — "Edit freehand", and back to the kind when
 * the diagram still conforms; or why a kind is not available here.
 */
export function KindModeBar({
  diagram,
  canEdit,
  onSelectElement,
  direction,
  onPresent,
  onReview,
  onFocusElement,
}: KindModeBarProps) {
  const { t } = useTranslation();
  const [issues, setIssues] = useState<KindIssue[] | null>(null);
  const policy = resolveKindPolicy(diagram);
  if (policy.type === "freehand") return null;

  if (policy.type === "kind-unavailable") {
    return (
      <div className={BAR} role="status" data-testid="kind-mode-bar">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" aria-hidden />
        <span>{t("diagramKinds.unavailable", { kind: policy.kindId })}</span>
      </div>
    );
  }

  const kindName = resolveKindText(policy.descriptor.label);
  if (policy.type === "kind") {
    return (
      <div className={BAR} data-testid="kind-mode-bar">
        <Workflow className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
        <span className="font-medium text-foreground">{kindName}</span>
        <button
          type="button"
          className={ACTION}
          disabled={!canEdit}
          title={t("diagramKinds.editFreehandHint")}
          onClick={() => editKindFreehand(diagram.id)}
        >
          {t("diagramKinds.editFreehand")}
        </button>
        {policy.descriptor.textCapture && (
          <KindTextPanel
            capture={policy.descriptor.textCapture}
            disabled={!canEdit}
            {...(onFocusElement && { onFocusStep: onFocusElement })}
          />
        )}
        {onPresent &&
          (policy.descriptor.presentation?.(diagram as DiagramModel)?.length ?? 0) > 0 && (
            <button
              type="button"
              className={`${ACTION} inline-flex items-center gap-1`}
              onClick={onPresent}
              data-testid="kind-present"
            >
              <Presentation className="h-3 w-3" aria-hidden />
              {t("diagramKinds.present")}
            </button>
          )}
        {onReview && canEdit && policy.descriptor.reviewPresets && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={`${ACTION} inline-flex items-center gap-1`}
                data-testid="kind-review"
              >
                <Sparkles className="h-3 w-3" aria-hidden />
                {t("diagramKinds.review")}
                <ChevronDown className="h-3 w-3" aria-hidden />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" onPointerDown={(e) => e.stopPropagation()}>
              {policy.descriptor.reviewPresets.map((preset) => (
                <DropdownMenuItem
                  key={preset.id}
                  className="text-xs"
                  onSelect={() => onReview(resolveKindText(preset.prompt))}
                  data-testid={`kind-review-${preset.id}`}
                >
                  {resolveKindText(preset.label)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {direction && (
          <button
            type="button"
            className={`${ACTION} inline-flex items-center gap-1`}
            disabled={!canEdit || direction.lockedReasonKey !== null}
            title={t(direction.lockedReasonKey ?? "diagramKinds.direction.switchHint")}
            aria-label={t(
              direction.value === "TB"
                ? "diagramKinds.direction.toHorizontal"
                : "diagramKinds.direction.toVertical",
            )}
            onClick={() => direction.onChange(direction.value === "TB" ? "LR" : "TB")}
            data-testid="kind-direction-toggle"
          >
            {direction.value === "TB" ? (
              <ArrowDown className="h-3 w-3" aria-hidden />
            ) : (
              <ArrowRight className="h-3 w-3" aria-hidden />
            )}
            {t(
              direction.value === "TB"
                ? "diagramKinds.direction.vertical"
                : "diagramKinds.direction.horizontal",
            )}
          </button>
        )}
      </div>
    );
  }

  const tryReturn = () => {
    const result = returnToKind(diagram.id);
    if (result.ok) {
      setIssues(null);
      toast.success(t("diagramKinds.returned", { kind: kindName }));
    } else if (result.reason === "issues") {
      setIssues(result.issues);
    }
  };

  return (
    <div className={`${PLACED} flex flex-col items-center gap-2`}>
      <div className={BOX} data-testid="kind-mode-bar">
        <PencilRuler className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>{t("diagramKinds.freehandBanner", { kind: kindName })}</span>
        <button type="button" className={ACTION} disabled={!canEdit} onClick={tryReturn}>
          {resolveKindText(policy.descriptor.returnLabel)}
        </button>
      </div>
      {issues && issues.length > 0 && (
        <div
          role="alert"
          className="w-[min(100vw-2rem,26rem)] rounded-xl border border-amber-500/40 bg-card p-3 text-xs shadow-md"
          data-testid="kind-issues"
        >
          <div className="mb-1 flex items-start justify-between gap-2">
            <p className="font-semibold text-foreground">
              {t("diagramKinds.issuesTitle", { kind: kindName })}
            </p>
            <button
              type="button"
              aria-label={t("common.close")}
              className="text-muted-foreground hover:text-foreground"
              onClick={() => setIssues(null)}
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
          <p className="mb-2 text-[11px] text-muted-foreground">{t("diagramKinds.issuesHint")}</p>
          <ul className="max-h-48 space-y-1 overflow-y-auto">
            {issues.map((issue, index) => (
              <li key={`${issue.code}-${issue.elementId ?? index}`}>
                {issue.elementId ? (
                  <button
                    type="button"
                    className="w-full rounded px-1.5 py-1 text-left text-foreground hover:bg-muted"
                    onClick={() => onSelectElement(issue.elementId!)}
                  >
                    {resolveKindText(issue.message, issue.values)}
                  </button>
                ) : (
                  <span className="block px-1.5 py-1 text-foreground">
                    {resolveKindText(issue.message, issue.values)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
