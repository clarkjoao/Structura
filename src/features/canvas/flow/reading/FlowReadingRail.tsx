import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, EyeOff, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  isParallelStep,
  resolveSceneSnapshot,
  useActiveDiagram,
  type Component,
  type Connection,
  type Diagram,
  type Flow,
  type FlowCallStack,
  type FlowStep,
} from "@/features/diagram";
import { describeStepElement } from "../flowState";
import { CONDITION_KIND_LABEL, conditionGlyph, conditionGlyphClass } from "../conditionKinds";
import FlowReadingScene from "./FlowReadingScene";
import { describeStepHeading, describeStepTarget, type StepHeadingLabels } from "./readingScene";
import { buildReadingSpine, type ReadingRow } from "./readingSpine";
import { describeStepCall } from "./stepCall";
import FlowVariablesPanel from "./FlowVariablesPanel";
import {
  buildRunningContext,
  checkContract,
  describeContextChange,
  describeExpected,
  keyLife,
  describePayload,
} from "./readingVariables";

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
   * Every step this reading has stood on, which going back does not shorten.
   * Absent, the path is used, and a reader who turned back looks as though they
   * were never there.
   */
  seen?: readonly string[];
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
  /** The calls in the air, or null when the reading has none paired. */
  callStack?: FlowCallStack | null;
  /** True when the step in hand makes a call whose result can be skipped to. */
  canStepOver?: boolean;
  onStepOver?: () => void;
  /** The call the reader is inside, or null at the outermost level. */
  stepOutFrameId?: string | null;
  onStepOut?: () => void;
  /** Keys the reader is following across the reading. */
  pinnedKeys?: readonly string[];
  onTogglePin?: (key: string) => void;
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
  seen = history,
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
  callStack = null,
  canStepOver = false,
  onStepOver,
  stepOutFrameId = null,
  onStepOut,
  pinnedKeys,
  onTogglePin,
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
      conditionKinds: {
        alt: t(CONDITION_KIND_LABEL.alt),
        opt: t(CONDITION_KIND_LABEL.opt),
        loop: t(CONDITION_KIND_LABEL.loop),
        par: t(CONDITION_KIND_LABEL.par),
        critical: t(CONDITION_KIND_LABEL.critical),
        break: t(CONDITION_KIND_LABEL.break),
      },
    }),
    [t],
  );

  const spine = useMemo(
    () =>
      buildReadingSpine(
        flow,
        currentStepId,
        history,
        (step) => describeStepHeading(step, components, connections, headingLabels),
        seen,
      ),
    [flow, currentStepId, history, seen, components, connections, headingLabels],
  );

  // The one thing the rail asks about a branch point: whether the ways out are
  // a choice or threads that all run. Everything it says differently — glyph,
  // colour, the footer's prompt — hangs off this and nothing else.
  const isParallel = currentStep ? isParallelStep(currentStep) : false;

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

  /**
   * Names the component a call comes *from* — the one left waiting for it.
   *
   * Both the breadcrumb and the return rows ask this, and both mean the source
   * of the connection: a call to Pagamentos is a call the API is waiting on, so
   * leaving it goes back to the API.
   */
  const callerOf = useMemo(
    () => (connectionId: string) => {
      const connection = connections[connectionId];
      const source = connection ? components[connection.sourceId] : undefined;
      return source?.name ?? t("common.connection");
    },
    [components, connections, t],
  );

  /** The callers still waiting, outermost first. Empty at the top level. */
  const stackTrail = useMemo(() => {
    if (!callStack || !currentStepId) return [];
    const info = callStack.byStep.get(currentStepId);
    if (!info || info.callDepth === 0) return [];
    return info.openFrameIds.map((frameId) => ({
      frameId,
      name: callerOf(callStack.frames.get(frameId)?.connectionId ?? ""),
    }));
  }, [callStack, currentStepId, callerOf]);

  const stepOutName = stepOutFrameId
    ? callerOf(callStack?.frames.get(stepOutFrameId)?.connectionId ?? "")
    : null;

  /** Everything the variables panel needs, folded over the walk so far. */
  const walked = useMemo(
    () => (currentStepId ? [...history, currentStepId] : [...history]),
    [history, currentStepId],
  );
  const sends = useMemo(() => describePayload(flow, currentStepId), [flow, currentStepId]);
  const expected = useMemo(
    () => (callStack ? describeExpected(flow, callStack, currentStepId) : null),
    [flow, callStack, currentStepId],
  );
  const runningContext = useMemo(
    () =>
      callStack
        ? buildRunningContext(flow, callStack, walked)
        : { groups: [], byKey: new Map(), unsetReads: [], reads: [], size: 0 },
    [flow, callStack, walked],
  );
  /** What the step in hand did to it — the same fold, one step apart. */
  const contextChange = useMemo(
    () => (callStack ? describeContextChange(flow, callStack, walked) : null),
    [flow, callStack, walked],
  );
  const contract = useMemo(
    () => (callStack && currentStepId ? checkContract(flow, callStack, currentStepId) : null),
    [flow, callStack, currentStepId],
  );
  const numbers = useMemo(
    () =>
      new Map(
        [...spine.past, ...(spine.current ? [spine.current] : []), ...spine.upcoming].map((r) => [
          r.stepId,
          r.number,
        ]),
      ),
    [spine],
  );
  const numberOf = useMemo(() => (stepId: string) => numbers.get(stepId) ?? "", [numbers]);
  const frameName = useMemo(
    () => (frameId: string) => callerOf(callStack?.frames.get(frameId)?.connectionId ?? ""),
    [callStack, callerOf],
  );

  /** What the step being read consumes, resolved to the values it will see. */
  const readValues = useMemo(
    () =>
      runningContext.reads
        .map((key) => runningContext.byKey.get(key))
        .filter((entry): entry is NonNullable<typeof entry> => entry !== undefined)
        .map((entry) => ({
          key: entry.key,
          value: entry.value,
          fromNumber: numberOf(entry.fromStepId),
        })),
    [runningContext, numberOf],
  );

  /** Built per key on demand: most readings pin nothing, and none pin many. */
  const lifeOf = useMemo(
    () => (key: string) => (callStack ? keyLife(flow, callStack, walked, key) : []),
    [flow, callStack, walked],
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
          <SpineRow key={row.stepId} row={row} walked callerOf={callerOf} />
        ))}

        {spine.current && currentStep && (
          <>
            {spine.current.returnsBefore?.map((entry) => (
              <ReturnRow
                key={entry.frameId}
                callDepth={entry.callDepth}
                caller={callerOf(entry.connectionId)}
              />
            ))}
            <div ref={sceneRef} className="my-1.5 flex items-start gap-3">
              <span
                className={`w-[34px] shrink-0 pt-3.5 text-right font-mono text-[15px] font-bold ${
                  isCondition ? conditionGlyphClass(spine.current.conditionKind) : "text-primary"
                }`}
              >
                {spine.current.number}
              </span>
              <CallGuides depth={spine.current.callDepth} />
              <FlowReadingScene
                step={currentStep}
                call={call}
                target={target}
                heading={spine.current.heading}
                isCondition={isCondition}
                branches={spine.branches}
                onChooseBranch={onChooseBranch}
                stackTrail={stackTrail}
                onLeaveFrame={onStepOut}
                readValues={readValues}
              />
            </div>
          </>
        )}

        {spine.upcoming.map((row) => (
          <SpineRow key={row.stepId} row={row} walked={false} callerOf={callerOf} />
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

      <FlowVariablesPanel
        sends={sends}
        expected={expected}
        context={runningContext}
        change={contextChange}
        contract={contract}
        contractStepNumber={
          currentStepId
            ? numberOf(callStack?.byStep.get(currentStepId)?.closesFrameId ?? "")
            : undefined
        }
        numberOf={numberOf}
        frameName={frameName}
        pinnedKeys={pinnedKeys}
        onTogglePin={onTogglePin}
        lifeOf={lifeOf}
      />

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
        {canStepOver && (
          <button
            type="button"
            data-testid="flow-reading-step-over"
            onClick={onStepOver}
            title={t("flowReading.stepOverKey")}
            aria-label={t("flowReading.stepOver")}
            className="rounded-[7px] border border-border bg-card px-2.5 py-2 font-mono text-[13px] leading-none text-muted-foreground transition-colors hover:text-foreground"
          >
            ⤵
          </button>
        )}
        {stepOutName && (
          <button
            type="button"
            data-testid="flow-reading-step-out"
            onClick={onStepOut}
            title={t("flowReading.stepOutKey", { name: stepOutName })}
            aria-label={t("flowReading.stepOut", { name: stepOutName })}
            className="rounded-[7px] border border-border bg-card px-2.5 py-2 font-mono text-[13px] leading-none text-muted-foreground transition-colors hover:text-foreground"
          >
            ↰
          </button>
        )}
        {isCondition ? (
          <span className="text-xs text-muted-foreground">
            {t(isParallel ? "flowReading.chooseThread" : "flowReading.chooseBranch")}
          </span>
        ) : (
          !canStepOver &&
          !stepOutName && <span className="font-mono text-[11px] text-muted-foreground">← →</span>
        )}
      </div>
    </aside>
  );
};

/**
 * One guide per call open around a row, drawn the full height of it.
 *
 * Continuous across consecutive rows on purpose: what the reader needs to see
 * is how far a call *reaches*, not merely that this one line sits deeper.
 */
const CallGuides = ({ depth }: { depth: number }) => {
  if (depth <= 0) return null;
  return (
    <span data-testid="flow-reading-guides" className="flex shrink-0 gap-[11px] self-stretch">
      {Array.from({ length: depth }, (_, index) => (
        <span key={index} data-testid="flow-reading-guide" className="block w-px bg-border" />
      ))}
    </span>
  );
};

/** A call ending where the script never wrote the return. */
const ReturnRow = ({ callDepth, caller }: { callDepth: number; caller: string }) => {
  const { t } = useTranslation();

  return (
    <div data-testid="flow-reading-return" className="flex items-start gap-3 py-[5px] opacity-70">
      <span className="w-[34px] shrink-0" />
      <CallGuides depth={callDepth} />
      <span className="mt-px shrink-0 text-[11px] leading-none text-muted-foreground">↩</span>
      <span className="text-[12.5px] italic leading-[1.35] text-muted-foreground">
        {t("flowReading.returnsTo", { name: caller })}
        <span className="ml-1.5 rounded-[3px] bg-secondary px-1 py-px text-[9px] not-italic uppercase tracking-[0.06em]">
          {t("flowReading.derived")}
        </span>
      </span>
    </div>
  );
};

interface SpineRowProps {
  row: ReadingRow;
  /** True for a step the reading has already been through. */
  walked: boolean;
  /** Names the component a call returns to, for the rows the script omits. */
  callerOf: (connectionId: string) => string;
}

const SpineRow = ({ row, walked, callerOf }: SpineRowProps) => {
  const { t } = useTranslation();

  return (
    <>
      {row.returnsBefore?.map((entry) => (
        <ReturnRow
          key={entry.frameId}
          callDepth={entry.callDepth}
          caller={callerOf(entry.connectionId)}
        />
      ))}
      <div
        data-testid="flow-reading-step"
        className={`flex items-start gap-3 py-[7px] ${walked ? "opacity-75" : ""}`}
      >
        <span className="w-[34px] shrink-0 pt-px text-right font-mono text-xs font-semibold text-muted-foreground">
          {row.number}
        </span>
        <CallGuides depth={row.callDepth} />
        {row.isCondition ? (
          <span
            data-testid="flow-reading-branch-glyph"
            className={`mt-0.5 shrink-0 text-xs leading-none ${conditionGlyphClass(row.conditionKind)}`}
          >
            {conditionGlyph(row.conditionKind)}
          </span>
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
            <span className="opacity-70">
              {" "}
              {t(row.conditionKind === "par" ? "flowReading.threads" : "flowReading.exits", {
                count: row.exits,
              })}
            </span>
          )}
        </span>
      </div>
    </>
  );
};

export default FlowReadingRail;
