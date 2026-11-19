import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import {
  ArrowRight,
  Box,
  ChevronLeft,
  ChevronRight,
  GitBranch,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { FLOW_CONDITION_KINDS, buildFlowOutline, conditionKindOf } from "@/features/diagram";
import type { Flow, FlowConditionKind, FlowStep } from "@/features/diagram";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { PanelHeader, type PanelMenuItem } from "../../panels/ElementPanel/shell/PanelHeader";
import { PanelSection } from "../../panels/ElementPanel/shell/PanelSection";
import {
  PANEL_ADD_CLASS,
  PANEL_INPUT_CLASS,
  PANEL_LABEL_CLASS,
} from "../../panels/ElementPanel/shell/fieldStyles";
import { getBranchColor } from "../branchColors";
import { CONDITION_KIND_LABEL, conditionGlyph } from "../conditionKinds";
import type { FlowScriptActions } from "../useFlowScriptActions";
import { FlowObjectPanel } from "./FlowObjectPanel";
import { JsonField } from "./JsonField";
import { useStepNaming } from "./useStepNaming";

const TEXTAREA_CLASS =
  "w-full resize-y rounded-md border border-border bg-secondary px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring";

/** Named rather than built from the value, so a renamed key is a type error. */
const PAYLOAD_DIRECTION_KEYS = {
  request: "flowScript.request",
  response: "flowScript.response",
} as const;

export interface FlowStepPanelProps {
  flow: Flow;
  stepId: string;
  actions: FlowScriptActions;
  /** Back to the flow's script. */
  onBack: () => void;
  /** Opens a sibling step — ‹ › walk the script in its own order. */
  onOpenStep: (stepId: string) => void;
}

/**
 * One step of a flow, in the inspector's anatomy: the step's name in the header, its fields in
 * folding sections, the rare gestures in ⋯.
 *
 * The fields used to unfold inside the script row — title, note, description, duration,
 * direction, route, body, all at one weight — and pushed the rest of the script off screen. Here
 * the section a reader sees comes first, the call next, and the data last and folded.
 */
export function FlowStepPanel({ flow, stepId, actions, onBack, onOpenStep }: FlowStepPanelProps) {
  const { t } = useTranslation();
  const { subjectOf, callOf, endpoints, routeMismatchOf } = useStepNaming();
  const outline = useMemo(() => buildFlowOutline(flow), [flow]);
  const step = flow.steps[stepId];
  if (!step) return null;

  const index = outline.rows.findIndex((row) => row.stepId === stepId);
  const row = outline.rows[index];
  const previous = index > 0 ? outline.rows[index - 1]?.stepId : undefined;
  const next = index >= 0 ? outline.rows[index + 1]?.stepId : undefined;
  const isCondition = (step.branches?.length ?? 0) > 0;
  const call = callOf(step);
  const update = (patch: Partial<FlowStep>) => actions.updateStep(stepId, patch);

  const menu: PanelMenuItem[] = [
    {
      key: "insert-after",
      label: t("flowScript.addStepAfter"),
      icon: Plus,
      onSelect: () => actions.insertStepAfter(stepId),
    },
    ...(isCondition
      ? []
      : [
          {
            key: "convert",
            label: t("flowStep.convert"),
            icon: GitBranch,
            onSelect: () =>
              actions.convertToCondition(stepId, "", [
                t("flowRecorder.fork.yes"),
                t("flowRecorder.fork.no"),
              ]),
          },
        ]),
    {
      key: "remove",
      label: t("flowScript.removeStep"),
      icon: Trash2,
      destructive: true,
      separated: true,
      onSelect: () => {
        actions.removeStep(stepId);
        onBack();
      },
    },
  ];

  const nav = (
    <span className="flex items-center">
      <NavButton
        label={t("flowStep.previous")}
        disabled={!previous}
        onClick={() => previous && onOpenStep(previous)}
      >
        <ChevronLeft className="h-4 w-4" />
      </NavButton>
      <NavButton
        label={t("flowStep.next")}
        disabled={!next}
        onClick={() => next && onOpenStep(next)}
      >
        <ChevronRight className="h-4 w-4" />
      </NavButton>
    </span>
  );

  const badges = (
    <>
      {step.duration && (
        <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[10px] text-primary">
          {step.duration}
        </span>
      )}
      {step.isAsync && (
        <span className="shrink-0 rounded-full bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] text-amber-500">
          {t("flowScript.async")}
        </span>
      )}
    </>
  );

  const kind = conditionKindOf(step);
  const icon = isCondition ? (
    <span className="text-[11px] leading-none">{conditionGlyph(kind)}</span>
  ) : call ? (
    <ArrowRight className="h-3.5 w-3.5" />
  ) : (
    <Box className="h-3.5 w-3.5" />
  );

  return (
    <div data-testid="flow-step-panel" className="flex min-h-0 flex-1 flex-col">
      <PanelHeader
        back={{ label: t("flowStep.back"), onBack }}
        icon={icon}
        typeLabel={t(isCondition ? "flowStep.conditionType" : "flowStep.stepType", {
          label: row?.label ?? "",
        })}
        badges={badges}
        name={isCondition ? (step.conditionLabel ?? "") : (step.title ?? "")}
        namePlaceholder={
          isCondition ? t(CONDITION_KIND_LABEL[kind]) : subjectOf({ ...step, title: undefined })
        }
        onCommitName={(name) =>
          update(isCondition ? { conditionLabel: name } : { title: name.trim() || undefined })
        }
        actions={nav}
        menu={menu}
        onClose={onBack}
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        {isCondition && (
          <PanelSection
            title={t("flowStep.sections.ways")}
            summary={(step.branches ?? []).map((branch) => branch.label).join(" · ")}
          >
            <div>
              <label htmlFor={`kind-${stepId}`} className={PANEL_LABEL_CLASS}>
                {t("flowStep.kind")}
              </label>
              {/*
                What the branch point *is*, not what it is called: a fork into threads used to be
                authored by typing a keyword into the question.
              */}
              <select
                id={`kind-${stepId}`}
                value={kind}
                onChange={(event) =>
                  update({ conditionKind: event.target.value as FlowConditionKind })
                }
                aria-label={t("flowScript.conditionKind.title")}
                className={PANEL_INPUT_CLASS}
              >
                {FLOW_CONDITION_KINDS.map((option) => (
                  <option key={option} value={option}>
                    {`${conditionGlyph(option)} ${t(CONDITION_KIND_LABEL[option])}`}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              {step.branches?.map((branch, branchIndex) => (
                <div key={branchIndex} className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="h-6 w-1 shrink-0 rounded-full"
                    style={{ backgroundColor: getBranchColor(branchIndex) }}
                  />
                  <input
                    aria-label={t("flowRecorder.fork.branch", { n: branchIndex + 1 })}
                    value={branch.label}
                    onChange={(event) =>
                      actions.setBranchLabel(stepId, branchIndex, event.target.value)
                    }
                    className={PANEL_INPUT_CLASS}
                  />
                  {(step.branches?.length ?? 0) > 2 && (
                    <button
                      type="button"
                      onClick={() => actions.removeBranch(stepId, branchIndex)}
                      title={t("flowScript.removeBranch")}
                      aria-label={t("flowScript.removeBranch")}
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => actions.addBranch(stepId, t("flowScript.newBranch"))}
                className={PANEL_ADD_CLASS}
              >
                + {t("flowRecorder.fork.addBranch")}
              </button>
            </div>
          </PanelSection>
        )}

        <PanelSection
          title={t("flowStep.sections.reading")}
          summary={step.note?.trim() || step.description?.trim()}
        >
          <div>
            <label htmlFor={`note-${stepId}`} className={PANEL_LABEL_CLASS}>
              {t("flowScript.noteLabel")}
            </label>
            <textarea
              id={`note-${stepId}`}
              value={step.note ?? ""}
              onChange={(event) => update({ note: event.target.value || undefined })}
              placeholder={t("flowScript.notePlaceholder")}
              rows={3}
              className={TEXTAREA_CLASS}
            />
          </div>
          {/* The reading shows the description too — as the body when there is no note. */}
          {!isCondition && (
            <div>
              <label htmlFor={`description-${stepId}`} className={PANEL_LABEL_CLASS}>
                {t("flowScript.descriptionLabel")}
              </label>
              <input
                id={`description-${stepId}`}
                value={step.description ?? ""}
                onChange={(event) => update({ description: event.target.value })}
                placeholder={t("flowScript.descriptionPlaceholder")}
                className={PANEL_INPUT_CLASS}
              />
            </div>
          )}
          {!call && !isCondition && (
            <DurationField
              stepId={stepId}
              value={step.duration ?? ""}
              onChange={(duration) => update({ duration: duration || undefined })}
            />
          )}
        </PanelSection>

        {call && step.connectionId && (
          <PanelSection
            title={t("flowStep.sections.call")}
            summary={call.target ? `${call.label} → ${call.target}` : call.label}
          >
            {/*
              Direction leads: it makes the step a call going out or the answer coming back, pairs
              the two halves in the reading, and decides whether a shape expected back is asked.
            */}
            <div>
              <span className={PANEL_LABEL_CLASS}>{t("flowScript.directionLabel")}</span>
              <div
                role="group"
                aria-label={t("flowScript.directionLabel")}
                className="flex rounded-md border border-border bg-secondary p-0.5"
              >
                {(["request", "response"] as const).map((direction) => {
                  const active = (step.payloadDirection ?? "request") === direction;
                  return (
                    <button
                      key={direction}
                      type="button"
                      aria-pressed={active}
                      onClick={() => update({ payloadDirection: direction })}
                      className={cn(
                        "h-7 flex-1 rounded text-xs font-medium transition-colors",
                        active
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {t(PAYLOAD_DIRECTION_KEYS[direction])}
                    </button>
                  );
                })}
              </div>
            </div>
            <RouteField
              stepId={stepId}
              value={step.endpointId ?? ""}
              endpoints={endpoints}
              mismatch={routeMismatchOf(step)}
              onChange={(endpointId) => update({ endpointId: endpointId || undefined })}
            />
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <DurationField
                  stepId={stepId}
                  value={step.duration ?? ""}
                  onChange={(duration) => update({ duration: duration || undefined })}
                />
              </div>
              <label className="flex h-8 shrink-0 items-center gap-2 text-sm text-foreground">
                <Switch
                  checked={step.isAsync ?? false}
                  onCheckedChange={(checked) => update({ isAsync: checked })}
                  aria-label={t("flowScript.async")}
                />
                {t("flowScript.async")}
              </label>
            </div>
          </PanelSection>
        )}

        {call && step.connectionId && (
          <PanelSection
            title={t("flowStep.sections.data")}
            summary={dataSummary(step, t)}
            defaultOpen={Boolean(step.payload || step.context?.expects)}
          >
            {/* The body and the shape expected back are written together, nothing between. */}
            <JsonField
              testId="step-payload"
              label={t("flowScript.payloadLabel")}
              value={step.payload ?? ""}
              onChange={(value) => update({ payload: value || undefined })}
            />
            {(step.payloadDirection ?? "request") === "request" && (
              <JsonField
                testId="step-context-expects"
                label={t("flowScript.contextExpects")}
                value={step.context?.expects ?? ""}
                onChange={(value) =>
                  update({ context: { ...step.context, expects: value || undefined } })
                }
              />
            )}
          </PanelSection>
        )}

        <PanelSection title={t("flowStep.sections.object")} defaultOpen={false}>
          <FlowObjectPanel flow={flow} selectedStepId={stepId} actions={actions} />
        </PanelSection>
      </div>
    </div>
  );
}

function dataSummary(step: FlowStep, t: TFunction): string {
  const filled = [
    step.payload ? t("flowScript.payloadLabel") : null,
    step.context?.expects ? t("flowScript.contextExpects") : null,
  ].filter(Boolean);
  return filled.length > 0 ? filled.join(" · ") : t("flowStep.empty");
}

function NavButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function DurationField({
  stepId,
  value,
  onChange,
}: {
  stepId: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div>
      <label htmlFor={`duration-${stepId}`} className={PANEL_LABEL_CLASS}>
        {t("flowScript.durationLabel")}
      </label>
      <input
        id={`duration-${stepId}`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={t("flowScript.durationPlaceholder")}
        className={PANEL_INPUT_CLASS}
      />
    </div>
  );
}

function RouteField({
  stepId,
  value,
  endpoints,
  mismatch,
  onChange,
}: {
  stepId: string;
  value: string;
  endpoints: ReturnType<typeof useStepNaming>["endpoints"];
  mismatch: ReturnType<ReturnType<typeof useStepNaming>["routeMismatchOf"]>;
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation();
  const groups = endpoints.reduce<Record<string, typeof endpoints>>((all, option) => {
    (all[option.groupName] ??= []).push(option);
    return all;
  }, {});
  return (
    <div>
      <label htmlFor={`route-${stepId}`} className={PANEL_LABEL_CLASS}>
        {t("flowScript.routeLabel")}
      </label>
      <select
        id={`route-${stepId}`}
        data-testid="step-route"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={PANEL_INPUT_CLASS}
      >
        <option value="">{t("flowScript.routeNone")}</option>
        {Object.entries(groups).map(([groupName, options]) => (
          <optgroup key={groupName} label={groupName}>
            {options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      {mismatch && (
        <p
          data-testid="step-route-mismatch"
          className="mt-1 text-[11px] leading-relaxed text-amber-500"
        >
          {t("flowScript.routeElsewhere", {
            arrivesAt: mismatch.arrivesAt,
            belongsTo: mismatch.belongsTo,
          })}
        </p>
      )}
    </div>
  );
}
