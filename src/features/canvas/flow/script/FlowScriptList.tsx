import { useCallback, useMemo, useState } from "react";
import type { DragEvent } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import type { Flow, FlowStep } from "@/features/diagram";
import {
  buildCallStack,
  buildFlowOutline,
  canReachStep,
  conditionKindOf,
  getPathToStep,
  useComponents,
  useConnections,
} from "@/features/diagram";
import { buildRunningContext, framesClosedByStep } from "../reading/readingVariables";
import type { ScopeGroup } from "./StepContextEditor";

const EMPTY_SCOPE: readonly ScopeGroup[] = [];
import { CONDITION_KIND_LABEL, conditionGlyph } from "../conditionKinds";
import { useFlowScriptActions } from "../useFlowScriptActions";
import { ConditionForm, type ConditionFormState } from "./ConditionForm";
import { FlowScriptRow } from "./FlowScriptRow";

export interface FlowScriptListProps {
  flow: Flow;
  /** Step highlighted on the canvas, if any. */
  selectedStepId?: string | null;
  onSelectStep?: (stepId: string) => void;
  /** Recorder-only: jump into a condition's branches. */
  onOpenBranchSelect?: (conditionStepId: string) => void;
}

/**
 * The flow as a script: one row per step, numbered from the graph, branches
 * indented under the condition that opens them.
 *
 * Every row edits the stored flow directly — there is no draft copy to
 * reconcile, and the numbers are derived on each render rather than stored.
 */
export function FlowScriptList({
  flow,
  selectedStepId,
  onSelectStep,
  onOpenBranchSelect,
}: FlowScriptListProps) {
  const { t } = useTranslation();
  const components = useComponents();
  const connections = useConnections();
  const actions = useFlowScriptActions(flow.id);
  const [expandedStepId, setExpandedStepId] = useState<string | null>(null);
  const [conditionForm, setConditionForm] = useState<ConditionFormState | null>(null);
  const [draggingStepId, setDraggingStepId] = useState<string | null>(null);
  const [dragOverStepId, setDragOverStepId] = useState<string | null>(null);

  const outline = useMemo(() => buildFlowOutline(flow), [flow]);

  /**
   * What is in scope where a step runs — the reading's own fold, given the
   * reading's own path, with only this step's contribution held back.
   *
   * It used to fold the path one step shorter, which reads as the same thing
   * and is not: the walk never reached the step, so the call that step answers
   * was never closed, and every value that call was holding stayed on offer.
   * The reading, standing on that step, called those same keys undefined.
   */
  const scopeOf = useMemo(() => {
    const callStack = buildCallStack(flow, outline);
    const numbers = new Map(outline.rows.map((row) => [row.stepId, row.label]));
    const closedBy = framesClosedByStep(callStack);
    /** A call is named by who is waiting on it — the source of its connection. */
    const callerOf = (connectionId: string) => {
      const connection = connections[connectionId];
      const source = connection ? components[connection.sourceId] : undefined;
      return source?.name ?? t("common.connection");
    };

    return (stepId: string): ScopeGroup[] => {
      const path = getPathToStep(flow, stepId);
      if (path.length === 0) return [];
      const running = buildRunningContext(flow, callStack, path, stepId);
      return running.groups.map((group) => {
        const closer = group.frameId ? closedBy.get(group.frameId) : undefined;
        // Only when the reading could actually get there: a call answered
        // inside one branch is never answered on the other, and saying "these
        // go at step 3a" to someone writing 3b would be the same kind of claim
        // this panel was built to stop making.
        const ends = closer && canReachStep(flow, stepId, closer) ? closer : undefined;
        return {
          frameId: group.frameId,
          name: group.frameId
            ? callerOf(callStack.frames.get(group.frameId)?.connectionId ?? "")
            : null,
          endsAtNumber: ends ? (numbers.get(ends) ?? null) : null,
          entries: group.entries.map((entry) => ({
            key: entry.key,
            value: entry.value,
            fromNumber: numbers.get(entry.fromStepId) ?? "",
          })),
        };
      });
    };
  }, [flow, outline, components, connections, t]);

  const titleOf = useCallback(
    (step: FlowStep): string => {
      if (step.branches && step.branches.length > 0) {
        const kind = conditionKindOf(step);
        return `${conditionGlyph(kind)} ${step.conditionLabel?.trim() || t(CONDITION_KIND_LABEL[kind])}`;
      }
      if (step.connectionId) {
        const connection = connections[step.connectionId];
        if (connection) return `${t("flowScript.connectionPrefix")}${connection.label}`;
      }
      if (step.componentId) {
        return components[step.componentId]?.name ?? t("flowScript.unknownStep");
      }
      if (step.description?.trim()) return step.description;
      return t("flowScript.emptyStep");
    },
    [components, connections, t],
  );

  const submitConditionForm = useCallback(() => {
    if (!conditionForm) return;
    const branches = conditionForm.branches.filter((branch) => branch.trim());
    if (branches.length < 2) {
      toast.warning(t("flowScript.minBranches"));
      return;
    }
    actions.convertToCondition(conditionForm.stepId, conditionForm.label, branches);
    setConditionForm(null);
  }, [actions, conditionForm, t]);

  const lastStepId = outline.rows[outline.rows.length - 1]?.stepId;

  const onDragStart = useCallback((event: DragEvent, stepId: string) => {
    event.dataTransfer.effectAllowed = "move";
    setDraggingStepId(stepId);
  }, []);

  const onDragOver = useCallback(
    (event: DragEvent, stepId: string) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      if (draggingStepId !== null) setDragOverStepId(stepId);
    },
    [draggingStepId],
  );

  const endDrag = useCallback(() => {
    setDraggingStepId(null);
    setDragOverStepId(null);
  }, []);

  /**
   * Dropping onto a row means "take the place of that row": from above, the
   * dragged step lands behind it; from below, in front of it. The graph has
   * the last word — a move it will not make is refused with a reason, not
   * quietly undone.
   */
  const onDrop = useCallback(
    (event: DragEvent, stepId: string) => {
      event.preventDefault();
      const dragged = draggingStepId;
      endDrag();
      if (dragged === null || dragged === stepId) return;
      const from = outline.rows.findIndex((row) => row.stepId === dragged);
      const to = outline.rows.findIndex((row) => row.stepId === stepId);
      if (from < 0 || to < 0) return;
      actions.moveStep(dragged, { kind: from < to ? "after" : "before", stepId });
    },
    [actions, draggingStepId, endDrag, outline.rows],
  );

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {t("flowScript.stepsHeading", { count: outline.rows.length })}
      </p>

      {outline.rows.length === 0 ? (
        <p className="py-2 text-xs italic text-muted-foreground">{t("flowScript.empty")}</p>
      ) : (
        <div className="space-y-0.5">
          {outline.rows.map((row) => {
            const step = flow.steps[row.stepId];
            if (!step) return null;
            return (
              <FlowScriptRow
                key={row.stepId}
                row={row}
                step={step}
                title={titleOf(step)}
                isExpanded={expandedStepId === row.stepId}
                isSelected={selectedStepId === row.stepId}
                isLast={lastStepId === row.stepId}
                actions={actions}
                scope={expandedStepId === row.stepId ? scopeOf(row.stepId) : EMPTY_SCOPE}
                onToggleExpand={() =>
                  setExpandedStepId(expandedStepId === row.stepId ? null : row.stepId)
                }
                onSelect={() => onSelectStep?.(row.stepId)}
                onConvertToCondition={(stepId) =>
                  setConditionForm({ stepId, label: "", branches: ["", ""] })
                }
                onOpenBranchSelect={onOpenBranchSelect}
                drag={{
                  isDragging: draggingStepId === row.stepId,
                  isDragOver:
                    dragOverStepId === row.stepId &&
                    draggingStepId !== null &&
                    draggingStepId !== row.stepId,
                  onDragStart,
                  onDragOver,
                  onDrop,
                  onDragEnd: endDrag,
                }}
              />
            );
          })}
        </div>
      )}

      {outline.unreachable.length > 0 && (
        <p className="flex items-center gap-1 text-[10px] text-amber-400">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          {t("flowScript.unreachable", { count: outline.unreachable.length })}
        </p>
      )}

      {conditionForm && (
        <ConditionForm
          form={conditionForm}
          onChange={setConditionForm}
          onSubmit={submitConditionForm}
          onCancel={() => setConditionForm(null)}
        />
      )}
    </div>
  );
}
