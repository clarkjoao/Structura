import type { DragEvent } from "react";
import { useTranslation } from "react-i18next";
import { ChevronRight, GripVertical, Plus, X } from "lucide-react";
import type { FlowOutlineRow, FlowStep } from "@/features/diagram";
import { getBranchColor } from "../branchColors";
import type { FlowScriptActions } from "../useFlowScriptActions";

export interface FlowScriptRowProps {
  row: FlowOutlineRow;
  step: FlowStep;
  /** What the step points at on the canvas, already resolved to a name. */
  title: string;
  isSelected: boolean;
  isLast: boolean;
  actions: FlowScriptActions;
  /** Opens the step in its own panel; the row itself holds no fields. */
  onOpen: () => void;
  /**
   * Recorder-only, on a branch's first row: whether the recorder writes into this branch, and
   * choosing it (again, to go back to the main sequence).
   */
  writeTarget?: { active: boolean; onWrite: () => void };
  /** Set while a row is being dragged; absent outside a reorderable list. */
  drag?: {
    isDragging: boolean;
    isDragOver: boolean;
    onDragStart: (event: DragEvent, stepId: string) => void;
    onDragOver: (event: DragEvent, stepId: string) => void;
    onDrop: (event: DragEvent, stepId: string) => void;
    onDragEnd: () => void;
  };
}

const INDENT_PX = 14;

/**
 * One step in the script: number, name, and what it costs. Clicking opens the step in its own
 * panel — the fields used to unfold inside the row and pushed the rest of the script off screen.
 */
export function FlowScriptRow({
  row,
  step,
  title,
  isSelected,
  isLast,
  actions,
  onOpen,
  writeTarget,
  drag,
}: FlowScriptRowProps) {
  const { t } = useTranslation();
  const branchColor = row.branch ? getBranchColor(row.branch.branchIndex) : undefined;

  return (
    <div data-step-id={row.stepId} style={{ paddingLeft: row.depth * INDENT_PX }}>
      {row.isBranchHead && row.branch && (
        <div className="flex items-center gap-1.5 pb-0.5 pt-1.5 text-[11px] font-semibold">
          <span className="h-2.5 w-1 rounded-full" style={{ backgroundColor: branchColor }} />
          <span className="min-w-0 flex-1 truncate" style={{ color: branchColor }}>
            {row.branch.label}
          </span>
          {writeTarget && (
            <button
              type="button"
              data-testid="script-branch-target"
              aria-pressed={writeTarget.active}
              onClick={writeTarget.onWrite}
              title={
                writeTarget.active
                  ? t("flowScript.writeTrunkTitle")
                  : t("flowScript.writeHereTitle")
              }
              className={`flex shrink-0 items-center gap-1 rounded-full border px-2 py-px text-[11px] font-medium transition-colors ${
                writeTarget.active
                  ? "border-red-500/40 bg-red-500/10 text-red-500"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {writeTarget.active && (
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
              )}
              {writeTarget.active ? t("flowScript.writingHere") : t("flowScript.writeHere")}
            </button>
          )}
        </div>
      )}
      <div
        draggable={Boolean(drag)}
        onDragStart={drag ? (event) => drag.onDragStart(event, row.stepId) : undefined}
        onDragOver={drag ? (event) => drag.onDragOver(event, row.stepId) : undefined}
        onDrop={drag ? (event) => drag.onDrop(event, row.stepId) : undefined}
        onDragEnd={drag?.onDragEnd}
        onClick={onOpen}
        className={`group flex cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-1.5 text-[13px] transition-colors hover:bg-secondary/50 ${
          isSelected ? "bg-primary/15 text-primary" : isLast ? "bg-primary/10" : "text-foreground"
        } ${row.isBranchPoint ? "border-l-2 border-amber-400" : ""} ${
          drag?.isDragging ? "opacity-40" : ""
        } ${drag?.isDragOver ? "ring-1 ring-primary/50" : ""}`}
        style={
          row.branch && !row.isBranchPoint
            ? { borderLeft: `1px solid ${branchColor}55` }
            : undefined
        }
      >
        {drag && (
          <GripVertical className="h-3.5 w-3.5 shrink-0 cursor-grab text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
        )}
        <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
          {row.label}
        </span>
        <span className="flex-1 truncate">{title}</span>
        {step.duration && (
          <span className="shrink-0 font-mono text-[10px] text-primary/80">{step.duration}</span>
        )}
        {step.isAsync && (
          <span className="shrink-0 font-mono text-[10px] text-amber-500">
            {t("flowScript.async")}
          </span>
        )}
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            actions.insertStepAfter(row.stepId);
          }}
          title={t("flowScript.addStepAfter")}
          className="shrink-0 text-muted-foreground opacity-0 transition-all hover:text-foreground group-hover:opacity-100"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            actions.removeStep(row.stepId);
          }}
          title={t("flowScript.removeStep")}
          className="shrink-0 text-muted-foreground opacity-0 transition-all hover:text-destructive group-hover:opacity-100"
        >
          <X className="h-3.5 w-3.5" />
        </button>
        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-40 transition-opacity group-hover:opacity-100" />
      </div>
    </div>
  );
}
