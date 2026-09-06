import type { DragEvent } from "react";
import { useTranslation } from "react-i18next";
import { JsonField } from "./JsonField";
import { StepContextEditor } from "./StepContextEditor";
import { GitBranch, GripVertical, Plus, X } from "lucide-react";
import { FLOW_CONDITION_KINDS, conditionKindOf } from "@/features/diagram";
import type { FlowConditionKind, FlowOutlineRow, FlowStep } from "@/features/diagram";
import { getBranchColor } from "../branchColors";
import { CONDITION_KIND_LABEL, conditionGlyph } from "../conditionKinds";
import type { FlowScriptActions } from "../useFlowScriptActions";
import type { ScopeGroup } from "./StepContextEditor";

const SECTION = "text-[9px] font-semibold uppercase tracking-wider text-muted-foreground";
const FIELD =
  "w-full rounded border border-border bg-secondary px-2 py-1 text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring";

/**
 * A field that still says what it is once it holds something.
 *
 * These were an emoji and a placeholder: the emoji had to be decoded, and the
 * placeholder — the only place the field was named — disappeared the moment
 * anyone typed.
 */
function Labelled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

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
  /** In scope where this step runs, grouped by the call each value belongs to. */
  scope: readonly ScopeGroup[];
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
  scope,
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
                {/*
                  What the branch point *is*, not what it is called. The two used
                  to be the same field — the importer wrote `par` into the label —
                  so a fork into threads could only be authored by typing a
                  keyword into the question, and nothing said that was a keyword.
                */}
                <select
                  value={conditionKindOf(step)}
                  onChange={(event) =>
                    actions.updateStep(row.stepId, {
                      conditionKind: event.target.value as FlowConditionKind,
                    })
                  }
                  onClick={(event) => event.stopPropagation()}
                  title={t("flowScript.conditionKind.title")}
                  aria-label={t("flowScript.conditionKind.title")}
                  className="shrink-0 rounded border border-border bg-secondary px-1 py-1 text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {FLOW_CONDITION_KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {`${conditionGlyph(kind)} ${t(CONDITION_KIND_LABEL[kind])}`}
                    </option>
                  ))}
                </select>
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
              <span className={SECTION}>{t("flowScript.sectionStep")}</span>
              <Labelled label={t("flowScript.titleLabel")}>
                <input
                  value={step.title ?? ""}
                  onChange={(event) =>
                    actions.updateStep(row.stepId, { title: event.target.value || undefined })
                  }
                  placeholder={t("flowScript.titlePlaceholder")}
                  className={`${FIELD} font-semibold`}
                  onClick={(event) => event.stopPropagation()}
                />
              </Labelled>
              <Labelled label={t("flowScript.noteLabel")}>
                <textarea
                  value={step.note ?? ""}
                  onChange={(event) =>
                    actions.updateStep(row.stepId, { note: event.target.value || undefined })
                  }
                  placeholder={t("flowScript.notePlaceholder")}
                  rows={2}
                  className={`${FIELD} resize-y`}
                  onClick={(event) => event.stopPropagation()}
                />
              </Labelled>
              <Labelled label={t("flowScript.descriptionLabel")}>
                <input
                  value={step.description ?? ""}
                  onChange={(event) =>
                    actions.updateStep(row.stepId, { description: event.target.value })
                  }
                  placeholder={t("flowScript.descriptionPlaceholder")}
                  className={FIELD}
                  onClick={(event) => event.stopPropagation()}
                />
              </Labelled>
              <Labelled label={t("flowScript.durationLabel")}>
                <input
                  value={step.duration ?? ""}
                  onChange={(event) =>
                    actions.updateStep(row.stepId, { duration: event.target.value || undefined })
                  }
                  placeholder={t("flowScript.durationPlaceholder")}
                  className={FIELD}
                  onClick={(event) => event.stopPropagation()}
                />
              </Labelled>
              {step.connectionId && (
                <>
                  <span className={`${SECTION} pt-1`}>{t("flowScript.sectionCall")}</span>
                  <div
                    className="flex items-center gap-1"
                    onClick={(event) => event.stopPropagation()}
                  >
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
                  <JsonField
                    testId="step-payload"
                    label={t("flowScript.payloadLabel")}
                    value={step.payload ?? ""}
                    onChange={(value) =>
                      actions.updateStep(row.stepId, { payload: value || undefined })
                    }
                  />
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
              <span className={`${SECTION} pt-1`}>{t("flowScript.sectionState")}</span>
              <StepContextEditor
                key={step.id}
                step={step}
                scope={scope}
                onChange={(context) => actions.updateStep(row.stepId, { context })}
              />
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
