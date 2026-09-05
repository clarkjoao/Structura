import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, EyeOff, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  resolveSceneSnapshot,
  useActiveDiagram,
  type Component,
  type Connection,
  type Diagram,
  type Flow,
  type FlowStep,
} from "@/features/diagram";
import { describeStepElement } from "../flowState";
import FlowReadingScene from "./FlowReadingScene";
import { describeStepHeading, describeStepTarget, type StepHeadingLabels } from "./readingScene";
import { buildReadingSpine, type ReadingRow } from "./readingSpine";
import { describeStepCall } from "./stepCall";

/** Stable identities, so the derivations are not rebuilt on every render. */
const EMPTY_COMPONENTS: Record<string, Component> = {};
const EMPTY_CONNECTIONS: Record<string, Connection> = {};

interface Props {
  flow: Flow;
  currentStepId: string | null;
  currentStep: FlowStep | null;
  /** The steps already walked, in order — the reading, not the script. */
  history: readonly string[];
  /**
   * Every script on the diagram, so the reader can move to another one.
   *
   * The diagram is the thing being read; a script is one route through it, and
   * with three of them the likeliest next gesture is to read a different one.
   */
  flows: readonly Flow[];
  onSelectFlow: (flowId: string) => void;
  /**
   * The diagram the steps are read against.
   *
   * The editor takes it from the store, which is where the diagram being
   * edited lives. The viewer has no store — its diagram arrives in a link —
   * so it passes one in and the same reading works there.
   */
  diagram?: Diagram;
  isCondition: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  onGoNext: () => void;
  onGoBack: () => void;
  onChooseBranch: (branchIndex: number) => void;
  onExit: () => void;
}

/**
 * The reading, in a column of its own beside the canvas.
 *
 * It does not float over the diagram: a reading is text, and text laid over
 * the thing it describes hides the half of the answer that is a picture. The
 * spine is the only progress indicator — one vertical list carrying where the
 * reader has been, where they are, and what is still ahead — which is why the
 * dots, the counter and the duplicated next/back of the old floating card are
 * all gone.
 */
const FlowReadingRail = ({
  flow,
  currentStepId,
  currentStep,
  history,
  flows,
  onSelectFlow,
  diagram: diagramProp,
  isCondition,
  canGoBack,
  canGoForward,
  onGoNext,
  onGoBack,
  onChooseBranch,
  onExit,
}: Props) => {
  const { t } = useTranslation();
  const storeDiagram = useActiveDiagram();
  const diagram = diagramProp ?? storeDiagram;
  const [showFlowList, setShowFlowList] = useState(false);
  const canSwitch = flows.length > 1;

  const view = useMemo(
    () => (diagram ? resolveSceneSnapshot(diagram, diagram.activeSceneId ?? null) : null),
    [diagram],
  );
  const components = view?.components ?? EMPTY_COMPONENTS;
  const connections = view?.connections ?? EMPTY_CONNECTIONS;

  const headingLabels = useMemo<StepHeadingLabels>(
    () => ({
      componentRemoved: t("flowStepNav.componentRemoved"),
      connectionRemoved: t("flowStepNav.connectionRemoved"),
      connection: t("common.connection"),
      untitled: t("flowReading.untitledStep"),
    }),
    [t],
  );

  const spine = useMemo(
    () =>
      buildReadingSpine(flow, currentStepId, history, (step) =>
        describeStepHeading(step, components, connections, headingLabels),
      ),
    [flow, currentStepId, history, components, connections, headingLabels],
  );

  const call = useMemo(
    () => describeStepCall(currentStep, connections),
    [currentStep, connections],
  );
  const target = useMemo(
    () => describeStepTarget(currentStep, components, connections),
    [currentStep, components, connections],
  );
  const elementState = useMemo(
    () => describeStepElement(currentStep, diagram),
    [currentStep, diagram],
  );

  const sceneRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const node = sceneRef.current;
    // jsdom has no layout, so the method is simply absent under test.
    if (node && typeof node.scrollIntoView === "function") {
      node.scrollIntoView({ block: "center" });
    }
  }, [currentStepId]);

  return (
    <aside
      data-testid="flow-reading-rail"
      className="flex h-full w-[392px] shrink-0 flex-col border-r border-border bg-card"
    >
      <div className="border-b border-border px-5 pb-4 pt-[18px]">
        <div className="mb-2 flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
            {t("flowReading.eyebrow")}
          </span>
          <div className="flex-1" />
          {canSwitch && (
            <button
              type="button"
              onClick={() => setShowFlowList((open) => !open)}
              title={t("flowStepNav.switchFlow")}
              className="flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {t("flowReading.switchFlow")}
              <ChevronDown className="h-3 w-3 shrink-0" />
            </button>
          )}
          <button
            type="button"
            onClick={onExit}
            title={t("flowStepNav.exitTitle")}
            className="p-0.5 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <h1 className="mb-1.5 text-[19px] leading-[1.25] text-foreground [font-weight:650] [text-wrap:pretty]">
          {flow.name}
        </h1>
        {flow.description && (
          <p className="text-[13px] leading-[1.5] text-muted-foreground [text-wrap:pretty]">
            {flow.description}
          </p>
        )}
      </div>

      {showFlowList && canSwitch && (
        <div data-testid="flow-switcher" className="border-b border-border px-3 py-1.5">
          {flows.map((candidate) => (
            <button
              type="button"
              key={candidate.id}
              onClick={() => {
                setShowFlowList(false);
                onSelectFlow(candidate.id);
              }}
              className={`flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-secondary ${
                candidate.id === flow.id ? "text-primary" : "text-foreground"
              }`}
            >
              <Check
                className={`h-3 w-3 shrink-0 ${candidate.id === flow.id ? "" : "opacity-0"}`}
              />
              <span className="truncate">{candidate.name}</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-5 pt-3.5">
        {elementState.kind !== "present" && (
          <div
            data-testid="flow-step-element-state"
            className="mb-2 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2"
          >
            <EyeOff className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
            <p className="text-[11px] text-amber-500">
              {elementState.kind === "hidden"
                ? t("flowStepNav.elementHidden", { scene: elementState.sceneName })
                : elementState.kind === "elsewhere"
                  ? t("flowStepNav.elementElsewhere", { scene: elementState.sceneName })
                  : t("flowStepNav.elementGone")}
            </p>
          </div>
        )}

        {spine.past.map((row) => (
          <SpineRow key={row.stepId} row={row} walked />
        ))}

        {spine.current && currentStep && (
          <div ref={sceneRef} className="my-1.5 flex items-start gap-3">
            <span
              className={`w-[34px] shrink-0 pt-3.5 text-right font-mono text-[15px] font-bold ${
                isCondition ? "text-amber-600" : "text-primary"
              }`}
            >
              {spine.current.number}
            </span>
            <FlowReadingScene
              step={currentStep}
              call={call}
              target={target}
              heading={spine.current.heading}
              isCondition={isCondition}
              branches={spine.branches}
              onChooseBranch={onChooseBranch}
            />
          </div>
        )}

        {spine.upcoming.map((row) => (
          <SpineRow key={row.stepId} row={row} walked={false} />
        ))}

        {!isCondition &&
          spine.branches.map((branch) => (
            <div key={branch.index} className="flex gap-3 py-0.5 pl-[46px]">
              <span className="w-0.5 shrink-0 rounded-[2px]" style={{ background: branch.color }} />
              <span className="py-[3px] text-[12.5px] text-muted-foreground">
                {t("flowReading.branchSummary", {
                  label: branch.label,
                  steps: t("flowReading.steps", { count: branch.stepCount }),
                })}
              </span>
            </div>
          ))}
      </div>

      <div className="flex shrink-0 items-center gap-2.5 border-t border-border px-5 py-3">
        <button
          type="button"
          onClick={onGoBack}
          disabled={!canGoBack}
          className="rounded-[7px] border border-border bg-card px-3.5 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
        >
          ← {t("common.previous")}
        </button>
        {!isCondition && (
          <button
            type="button"
            onClick={onGoNext}
            disabled={!canGoForward}
            className="rounded-[7px] bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {t("common.next")} →
          </button>
        )}
        <div className="flex-1" />
        {isCondition ? (
          <span className="text-xs text-muted-foreground">{t("flowReading.chooseBranch")}</span>
        ) : (
          <span className="font-mono text-[11px] text-muted-foreground">← →</span>
        )}
      </div>
    </aside>
  );
};

interface SpineRowProps {
  row: ReadingRow;
  /** True for a step the reading has already been through. */
  walked: boolean;
}

const SpineRow = ({ row, walked }: SpineRowProps) => {
  const { t } = useTranslation();

  return (
    <div
      data-testid="flow-reading-step"
      className={`flex items-start gap-3 py-[7px] ${walked ? "opacity-75" : ""}`}
    >
      <span className="w-[34px] shrink-0 pt-px text-right font-mono text-xs font-semibold text-muted-foreground">
        {row.number}
      </span>
      {row.isCondition ? (
        <span className="mt-0.5 shrink-0 text-xs leading-none text-amber-600">◇</span>
      ) : (
        <span
          className={`mt-[5px] h-[9px] w-[9px] shrink-0 rounded-full ${
            walked ? "bg-primary" : "border border-border bg-background"
          }`}
        />
      )}
      <span className="text-[13.5px] leading-[1.35] text-muted-foreground">
        {row.heading}
        {row.isCondition && row.exits > 0 && (
          <span className="opacity-70"> {t("flowReading.exits", { count: row.exits })}</span>
        )}
      </span>
    </div>
  );
};

export default FlowReadingRail;
