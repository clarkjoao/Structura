import type { DragEvent } from "react";
import { useTranslation } from "react-i18next";
import { GitBranch, GripVertical, Plus, X } from "lucide-react";
import type { FlowOutlineRow, FlowStep } from "@/features/diagram";
import { getBranchColor } from "../branchColors";
import type { FlowScriptActions } from "../useFlowScriptActions";

export interface FlowScriptRowProps {
  row: FlowOutlineRow;
  step: FlowStep;
  /** What the step points at on the canvas, already resolved to a name. */
  title: string;
  isExpanded: boolean;
  isSelected: boolean;
  isLast: boolean;
  actions: FlowScriptActions;
  onToggleExpand: () => void;
  onSelect: () => void;
  onConvertToCondition: (stepId: string) => void;
  /** Recorder-only: jump into this condition's branches. */
  onOpenBranchSelect?: (conditionStepId: string) => void;
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

/** Named rather than built from the value, so a renamed key is a type error. */
const PAYLOAD_DIRECTION_KEYS = {
  request: "flowScript.request",
  response: "flowScript.response",
} as const;

export function FlowScriptRow({
  row,
  step,
  title,
  isExpanded,
  isSelected,
  isLast,
  actions,
  onToggleExpand,
  onSelect,
  onConvertToCondition,
  onOpenBranchSelect,
  drag,
}: FlowScriptRowProps) {
  const { t } = useTranslation();
  const branchColor = row.branch ? getBranchColor(row.branch.branchIndex) : undefined;

  return (
    <div data-step-id={row.stepId} style={{ paddingLeft: row.depth * INDENT_PX }}>
      {row.isBranchHead && row.branch && (
        <div className="flex items-center gap-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider">
          <span className="h-2 w-1 rounded-full" style={{ backgroundColor: branchColor }} />
          <span style={{ color: branchColor }}>{row.branch.label}</span>
        </div>
      )}
      <div
        draggable={Boolean(drag)}
        onDragStart={drag ? (event) => drag.onDragStart(event, row.stepId) : undefined}
        onDragOver={drag ? (event) => drag.onDragOver(event, row.stepId) : undefined}
        onDrop={drag ? (event) => drag.onDrop(event, row.stepId) : undefined}
        onDragEnd={drag?.onDragEnd}
        onClick={() => {
          onSelect();
          onToggleExpand();
        }}
        className={`group flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-1.5 text-xs transition-colors hover:bg-secondary/50 ${
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
          <GripVertical className="h-3 w-3 shrink-0 cursor-grab text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
        )}
        <span className="shrink-0 text-[10px] text-muted-foreground">{isExpanded ? "▾" : "▸"}</span>
        <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">
          {row.label}
        </span>
        <span className="flex-1 truncate">{title}</span>
        {step.duration && (
          <span className="shrink-0 font-mono text-[9px] text-primary/70">{step.duration}</span>
        )}
        {step.isAsync && (
          <span className="shrink-0 font-mono text-[9px] text-amber-400">
            {t("flowScript.async")}
          </span>
        )}
        {step.handleId && (
          <span className="shrink-0 font-mono text-[9px] text-muted-foreground">
            [{step.handleId}]
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
          <Plus className="h-3 w-3" />
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
          <X className="h-3 w-3" />
        </button>
      </div>

      {isExpanded && (
        <div className="space-y-1 pb-1 pl-7 pr-2 pt-0.5">
          {row.isBranchPoint ? (
            <>
              <div className="flex items-start gap-1">
                <span className="mt-1 shrink-0 text-[10px]">◇</span>
                <input
                  value={step.conditionLabel ?? ""}
                  onChange={(event) =>
                    actions.updateStep(row.stepId, { conditionLabel: event.target.value })
                  }
                  placeholder={t("flowScript.conditionLabel")}
                  className="w-full rounded border border-border bg-secondary px-2 py-1 text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  onClick={(event) => event.stopPropagation()}
                />
              </div>
              {onOpenBranchSelect && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onOpenBranchSelect(row.stepId);
                  }}
                  className="w-full rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-[10px] font-semibold text-amber-400 hover:bg-amber-500/15"
                >
                  {t("flowScript.recordBranches")}
                </button>
              )}
              <div className="space-y-0.5 pt-1">
                <p className="text-[9px] font-semibold uppercase text-muted-foreground">
                  {t("flowScript.branches")}
                </p>
                {step.branches?.map((branch, branchIndex) => (
                  <div key={branchIndex} className="flex items-center gap-1">
                    <div
                      className="h-6 w-1 shrink-0 rounded-full"
                      style={{ backgroundColor: getBranchColor(branchIndex) }}
                    />
                    <input
                      value={branch.label}
                      onChange={(event) =>
                        actions.setBranchLabel(row.stepId, branchIndex, event.target.value)
                      }
                      className="flex-1 rounded border border-border bg-secondary px-2 py-0.5 text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                      onClick={(event) => event.stopPropagation()}
                    />
                    {(step.branches?.length ?? 0) > 2 && (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          actions.removeBranch(row.stepId, branchIndex);
                        }}
                        title={t("flowScript.removeBranch")}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    actions.addBranch(row.stepId, t("flowScript.newBranch"));
                  }}
                  className="text-[9px] text-primary hover:underline"
                >
                  + {t("flowScript.addBranch")}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-start gap-1">
                <span className="mt-1 shrink-0 text-[10px]">📝</span>
                <input
                  value={step.description ?? ""}
                  onChange={(event) =>
                    actions.updateStep(row.stepId, { description: event.target.value })
                  }
                  placeholder={t("flowScript.descriptionPlaceholder")}
                  className="w-full rounded border border-border bg-secondary px-2 py-1 text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  onClick={(event) => event.stopPropagation()}
                />
              </div>
              <div className="flex items-start gap-1">
                <span className="mt-1 shrink-0 text-[10px]">⏱</span>
                <input
                  value={step.duration ?? ""}
                  onChange={(event) =>
                    actions.updateStep(row.stepId, { duration: event.target.value || undefined })
                  }
                  placeholder={t("flowScript.durationPlaceholder")}
                  className="w-full rounded border border-border bg-secondary px-2 py-1 text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  onClick={(event) => event.stopPropagation()}
                />
              </div>
              {step.connectionId && (
                <>
                  <div
                    className="flex items-center gap-1"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <span className="mt-0.5 shrink-0 text-[10px]">📦</span>
                    <div className="flex overflow-hidden rounded border border-border">
                      {(["request", "response"] as const).map((direction) => (
                        <button
                          key={direction}
                          type="button"
                          onClick={() =>
                            actions.updateStep(row.stepId, { payloadDirection: direction })
                          }
                          className={`px-2 py-0.5 text-[9px] font-medium transition-colors ${
                            (step.payloadDirection ?? "request") === direction
                              ? direction === "request"
                                ? "bg-cyan-500/20 text-cyan-400"
                                : "bg-emerald-500/20 text-emerald-400"
                              : "bg-secondary text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {t(PAYLOAD_DIRECTION_KEYS[direction])}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-start gap-1">
                    <span className="mt-1 shrink-0 text-[10px]">
                      {step.payloadDirection === "response" ? "📥" : "📤"}
                    </span>
                    <textarea
                      value={step.payload ?? ""}
                      onChange={(event) =>
                        actions.updateStep(row.stepId, { payload: event.target.value || undefined })
                      }
                      placeholder={t("flowScript.payloadPlaceholder")}
                      rows={2}
                      className="w-full resize-y rounded border border-border bg-secondary px-2 py-1 font-mono text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                      onClick={(event) => event.stopPropagation()}
                    />
                  </div>
                  <label
                    className="flex cursor-pointer items-center gap-1 text-[10px] text-muted-foreground"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={step.isAsync ?? false}
                      onChange={(event) =>
                        actions.updateStep(row.stepId, { isAsync: event.target.checked })
                      }
                      className="rounded"
                    />
                    {t("flowScript.async")}
                  </label>
                </>
              )}
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onConvertToCondition(row.stepId);
                }}
                className="mt-1 flex items-center gap-1 text-[9px] text-amber-400 hover:text-amber-300"
              >
                <GitBranch className="h-3 w-3" /> {t("flowScript.convertToCondition")}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
