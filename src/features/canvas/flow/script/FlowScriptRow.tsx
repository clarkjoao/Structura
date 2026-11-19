import type { DragEvent } from "react";
import { useTranslation } from "react-i18next";
import { JsonField } from "./JsonField";
import { GitBranch, GripVertical, Plus, X } from "lucide-react";
import { FLOW_CONDITION_KINDS, conditionKindOf } from "@/features/diagram";
import type { FlowConditionKind, FlowOutlineRow, FlowStep } from "@/features/diagram";
import { getBranchColor } from "../branchColors";
import { CONDITION_KIND_LABEL, conditionGlyph } from "../conditionKinds";
import type { FlowScriptActions } from "../useFlowScriptActions";

/** One route an author can point a step at, already named for a list. */
export interface EndpointOption {
  id: string;
  /** `POST /urls`. */
  label: string;
  /** The api-group it hangs off, so two services with the same path stay apart. */
  groupName: string;
}

/** A step claiming a route its own call does not arrive at, in names. */
export interface RouteMismatch {
  arrivesAt: string;
  belongsTo: string;
}

const SECTION = "text-xs font-semibold text-foreground";
const FIELD =
  "w-full rounded-md border border-border bg-secondary px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring";

/**
 * A field that still says what it is once it holds something.
 *
 * These were an emoji and a placeholder: the emoji had to be decoded, and the
 * placeholder — the only place the field was named — disappeared the moment
 * anyone typed.
 */
function Labelled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

/**
 * The same label over something that is not one input.
 *
 * A `<label>` around a pair of buttons would make clicking the word press the
 * first of them, so the direction — the only control here that is a choice
 * rather than a field — gets the label without the association.
 */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
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
  /** Every route on the diagram, for the step to point at one. */
  endpoints: readonly EndpointOption[];
  /** Set when the route this step names is not where its call arrives. */
  routeMismatch?: RouteMismatch | null;
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
  endpoints,
  routeMismatch,
  onToggleExpand,
  onSelect,
  onConvertToCondition,
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
        onClick={() => {
          onSelect();
          onToggleExpand();
        }}
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
        <span className="shrink-0 text-[11px] text-muted-foreground">{isExpanded ? "▾" : "▸"}</span>
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
        {step.handleId && (
          <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
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
      </div>

      {isExpanded && (
        <div className="space-y-2 pb-2 pl-7 pr-2 pt-1">
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
                  className="shrink-0 rounded-md border border-border bg-secondary px-1.5 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
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
                  className="w-full rounded-md border border-border bg-secondary px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  onClick={(event) => event.stopPropagation()}
                />
              </div>
              <div className="space-y-0.5 pt-1">
                <p className="text-[11px] font-medium text-muted-foreground">
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
                      className="flex-1 rounded-md border border-border bg-secondary px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
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
                        <X className="h-3.5 w-3.5" />
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
                  className="text-xs text-primary hover:underline"
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
                  className={`${FIELD} font-semibold placeholder:font-normal`}
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
                  {/*
                    Direction leads: it is what makes the step a call going out
                    or the answer coming back, it is what pairs the two halves
                    in the reading, and it is what decides whether the shape
                    expected back is a field at all. It used to be asked third,
                    with no label — the two buttons named the answers and
                    nothing named the question.
                  */}
                  <Field label={t("flowScript.directionLabel")}>
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
                            className={`px-2.5 py-1 text-[11px] font-medium transition-colors ${
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
                  </Field>
                  <Labelled label={t("flowScript.routeLabel")}>
                    <select
                      data-testid="step-route"
                      value={step.endpointId ?? ""}
                      onChange={(event) =>
                        actions.updateStep(row.stepId, {
                          endpointId: event.target.value || undefined,
                        })
                      }
                      onClick={(event) => event.stopPropagation()}
                      className={FIELD}
                    >
                      <option value="">{t("flowScript.routeNone")}</option>
                      {Object.entries(
                        endpoints.reduce<Record<string, EndpointOption[]>>((groups, option) => {
                          (groups[option.groupName] ??= []).push(option);
                          return groups;
                        }, {}),
                      ).map(([groupName, options]) => (
                        <optgroup key={groupName} label={groupName}>
                          {options.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.label}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </Labelled>
                  {routeMismatch && (
                    <span
                      data-testid="step-route-mismatch"
                      className="text-[11px] leading-relaxed text-amber-500"
                    >
                      {t("flowScript.routeElsewhere", {
                        arrivesAt: routeMismatch.arrivesAt,
                        belongsTo: routeMismatch.belongsTo,
                      })}
                    </span>
                  )}
                  {/* The body and the shape expected back are written together, so
                      nothing is put between them. */}
                  <JsonField
                    testId="step-payload"
                    label={t("flowScript.payloadLabel")}
                    value={step.payload ?? ""}
                    onChange={(value) =>
                      actions.updateStep(row.stepId, { payload: value || undefined })
                    }
                  />
                  {(step.payloadDirection ?? "request") === "request" && (
                    <JsonField
                      testId="step-context-expects"
                      label={t("flowScript.contextExpects")}
                      value={step.context?.expects ?? ""}
                      onChange={(value) =>
                        actions.updateStep(row.stepId, {
                          context: { ...step.context, expects: value || undefined },
                        })
                      }
                    />
                  )}
                  <label
                    className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground"
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
                className="mt-1 flex items-center gap-1.5 text-xs text-amber-500 hover:text-amber-600"
              >
                <GitBranch className="h-3.5 w-3.5" /> {t("flowScript.convertToCondition")}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
