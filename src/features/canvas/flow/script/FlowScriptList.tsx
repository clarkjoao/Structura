import { Fragment, useCallback, useMemo, useState } from "react";
import type { DragEvent } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle } from "lucide-react";
import type { Flow } from "@/features/diagram";
import { buildFlowOutline, getFlowTail, isPlaceholderStep } from "@/features/diagram";
import { recordingCursor, type RecordingContext } from "../flowMode.types";
import { useFlowScriptActions } from "../useFlowScriptActions";
import { FlowScriptRow, WaitingLine } from "./FlowScriptRow";
import { nextStepLabel } from "./nextStepLabel";
import { useStepNaming } from "./useStepNaming";

/** Recorder-only: where the next canvas click is written, and how to move it. */
export interface ScriptRecording {
  target: RecordingContext;
  onTarget: (target: RecordingContext) => void;
}

export interface FlowScriptListProps {
  flow: Flow;
  /** Step highlighted on the canvas, if any. */
  selectedStepId?: string | null;
  /** Opens a step in its own panel. */
  onOpenStep?: (stepId: string) => void;
  /** Recorder-only: branch heads become places to write into. */
  recording?: ScriptRecording;
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
  onOpenStep,
  recording,
}: FlowScriptListProps) {
  const { t } = useTranslation();
  const { subjectOf, callOf } = useStepNaming();
  const actions = useFlowScriptActions(flow.id);
  const [draggingStepId, setDraggingStepId] = useState<string | null>(null);
  const [dragOverStepId, setDragOverStepId] = useState<string | null>(null);

  const outline = useMemo(() => buildFlowOutline(flow), [flow]);

  const lastStepId = outline.rows[outline.rows.length - 1]?.stepId;

  /**
   * Recorder-only: where the next click lands. A placeholder holding the sequence open is that
   * place itself; otherwise a dashed line after the sequence's last step names the number the
   * click will take.
   */
  const waiting = useMemo(() => {
    if (!recording) return null;
    const tailId = getFlowTail(flow, recordingCursor(recording.target));
    const tail = tailId ? flow.steps[tailId] : undefined;
    const tailRow = outline.rows.find((row) => row.stepId === tailId);
    if (!tail || !tailRow) return null;
    if (isPlaceholderStep(tail)) return { kind: "fill" as const, stepId: tail.id };
    // Below the tail's own subtree: a condition at the end keeps its branches above the line.
    const from = outline.rows.indexOf(tailRow);
    let anchor = tailRow;
    for (const row of outline.rows.slice(from + 1)) {
      if (row.depth <= tailRow.depth) break;
      anchor = row;
    }
    return {
      kind: "after" as const,
      stepId: anchor.stepId,
      label: nextStepLabel(tailRow.label),
      depth: tailRow.depth,
    };
  }, [flow, outline.rows, recording]);

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
      {outline.rows.length === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">{t("flowScript.empty")}</p>
      ) : (
        <div className="space-y-0.5">
          {outline.rows.map((row) => {
            const step = flow.steps[row.stepId];
            if (!step) return null;
            const call = step.title?.trim() ? callOf(step)?.label : undefined;
            return (
              <Fragment key={row.stepId}>
                <FlowScriptRow
                  row={row}
                  step={step}
                  title={
                    step.branches?.length ? subjectOf(step) : step.title?.trim() || subjectOf(step)
                  }
                  isSelected={selectedStepId === row.stepId}
                  isLast={lastStepId === row.stepId}
                  actions={actions}
                  onOpen={() => onOpenStep?.(row.stepId)}
                  call={call}
                  waiting={waiting?.kind === "fill" && waiting.stepId === row.stepId}
                  writeTarget={
                    recording && row.isBranchHead && row.branch
                      ? writeTargetFor(recording, row.branch)
                      : undefined
                  }
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
                {waiting?.kind === "after" && waiting.stepId === row.stepId && (
                  <WaitingLine label={waiting.label} depth={waiting.depth} />
                )}
              </Fragment>
            );
          })}
        </div>
      )}

      {outline.unreachable.length > 0 && (
        <p className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          {t("flowScript.unreachable", { count: outline.unreachable.length })}
        </p>
      )}
    </div>
  );
}

function writeTargetFor(
  recording: ScriptRecording,
  branch: { conditionStepId: string; branchIndex: number; label: string },
) {
  const { target } = recording;
  const active =
    target.mode === "branch-record" &&
    target.conditionStepId === branch.conditionStepId &&
    target.branchIndex === branch.branchIndex;
  return {
    active,
    onWrite: () =>
      recording.onTarget(
        active
          ? { mode: "trunk" }
          : {
              mode: "branch-record",
              conditionStepId: branch.conditionStepId,
              branchIndex: branch.branchIndex,
              branchLabel: branch.label,
            },
      ),
  };
}
