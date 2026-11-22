import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, PencilRuler, Workflow, X } from "lucide-react";
import { toast } from "sonner";
import type { Diagram, DiagramModel } from "@/features/diagram";
import { resolveKindPolicy } from "@/features/diagram-kinds/policy";
import { editKindFreehand, returnToKind } from "@/features/diagram-kinds/actions";
import { resolveKindText } from "@/features/diagram-kinds/context";
import type { KindIssue } from "@/features/diagram-kinds/kind.types";
import { KindTextPanel } from "./KindTextPanel";
import { kindMarkersFor } from "@/features/diagram-kinds/markers";

interface KindModeBarProps {
  diagram: Diagram | DiagramModel;
  /** The author may change the diagram (not a viewer, not reading a flow). */
  canEdit: boolean;
  /** Selects an element an issue names. */
  onSelectElement: (id: string) => void;
  /** Selects an element and brings it into view (the kind's focus markers). */
  onFocusElement?: (id: string) => void;
}

/**
 * In the canvas's top-left corner, out of the way of the selection's floating bar, which
 * centres over whatever is selected — a lane's bar and this one met at the top centre.
 */
const PLACED = "absolute top-3 left-3 z-10";
const BOX =
  "flex max-w-[min(100vw-2rem,40rem)] items-center gap-2 rounded-xl border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground shadow-sm";
const BAR = `${PLACED} ${BOX}`;
const ACTION =
  "rounded-md border border-border px-2 py-0.5 text-[11px] font-medium text-foreground hover:bg-muted disabled:pointer-events-none disabled:opacity-50";

/**
 * The diagram kind's mode on the canvas (ADR-0014): which editor is guiding
 * the diagram, and the way across — "Edit freehand", and back to the kind when
 * the diagram still conforms; or why a kind is not available here.
 */
export function KindModeBar({
  diagram,
  canEdit,
  onSelectElement,
  onFocusElement,
}: KindModeBarProps) {
  const { t } = useTranslation();
  const [issues, setIssues] = useState<KindIssue[] | null>(null);
  const [focusIndex, setFocusIndex] = useState(-1);
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
  // Markers worth walking (guided: pain points), in the order the kind's checks give them.
  const focus = policy.type === "kind" ? policy.descriptor.focusMarkers : undefined;
  const focusIds = focus
    ? kindMarkersFor(diagram as DiagramModel)
        .markers.filter((m) => m.code === focus.code && !m.onConnection)
        .map((m) => m.elementId)
    : [];

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
          <KindTextPanel capture={policy.descriptor.textCapture} disabled={!canEdit} />
        )}
        {focus && focusIds.length > 0 && (
          <button
            type="button"
            className={`${ACTION} inline-flex items-center gap-1 border-red-500/40 text-red-700 dark:text-red-300`}
            onClick={() => {
              const next = (focusIndex + 1) % focusIds.length;
              setFocusIndex(next);
              (onFocusElement ?? onSelectElement)(focusIds[next]!);
            }}
            data-testid="kind-focus-markers"
          >
            {resolveKindText(focus.label, { count: focusIds.length })}
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
