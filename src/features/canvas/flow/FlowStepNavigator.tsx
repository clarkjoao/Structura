import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, X, MessageSquare, Clock, ChevronDown, ChevronUp } from "lucide-react";
import {
  getOrderedStepIds,
  resolveSceneSnapshot,
  useActiveDiagram,
  type Flow,
  type FlowStep,
} from "@/features/diagram";
import { useTranslation } from "react-i18next";
import { BRANCH_COLORS } from "./branchColors";

interface DotInfo {
  id: string;
  type: "action" | "condition" | "note";
  branchIndex?: number;
  branchColor?: string;
  isBranchStart?: boolean;
  title?: string;
}

function buildDotInfos(flow: Flow, stepTitles: Map<string, string>): DotInfo[] {
  const orderedIds = getOrderedStepIds(flow);
  const dots: DotInfo[] = orderedIds.map((id) => {
    const step = flow.steps[id];
    return {
      id,
      type: step?.type ?? "action",
      title: stepTitles.get(id),
    };
  });

  const dotsById = new Map(dots.map((dot) => [dot.id, dot]));
  const incomingCounts = new Map<string, number>();

  Object.values(flow.steps).forEach((step) => {
    if (step.next) {
      incomingCounts.set(step.next, (incomingCounts.get(step.next) ?? 0) + 1);
    }
    step.branches?.forEach((branch) => {
      incomingCounts.set(
        branch.nextId,
        (incomingCounts.get(branch.nextId) ?? 0) + 1,
      );
    });
  });

  const walkBranch = (
    stepId: string | undefined,
    branchIndex: number,
    branchColor: string,
    isBranchStart: boolean,
    visited: Set<string>,
  ) => {
    if (!stepId || visited.has(stepId)) return;
    if ((incomingCounts.get(stepId) ?? 0) > 1) return;

    const step = flow.steps[stepId];
    const dot = dotsById.get(stepId);
    if (!step || !dot) return;

    visited.add(stepId);
    if (dot.branchColor === undefined) {
      dot.branchIndex = branchIndex;
      dot.branchColor = branchColor;
      dot.isBranchStart = isBranchStart;
    }

    if (step.next) {
      walkBranch(step.next, branchIndex, branchColor, false, visited);
    }
  };

  orderedIds.forEach((id) => {
    const step = flow.steps[id];
    if (!step?.branches?.length) return;

    step.branches.forEach((branch, index) => {
      walkBranch(
        branch.nextId,
        index,
        BRANCH_COLORS[index % BRANCH_COLORS.length],
        true,
        new Set<string>(),
      );
    });
  });

  return dots;
}

interface Props {
  flow: Flow;
  currentStepId: string | null;
  currentStep: FlowStep | null;
  isCondition: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  onGoNext: () => void;
  onGoBack: () => void;
  onChooseBranch: (branchIndex: number) => void;
  onExit: () => void;
}

const FlowStepNavigator = ({
  flow,
  currentStepId,
  currentStep,
  isCondition,
  canGoBack,
  canGoForward,
  onGoNext,
  onGoBack,
  onChooseBranch,
  onExit,
}: Props) => {
  const { t } = useTranslation();
  const diagram = useActiveDiagram();
  const step = currentStep;
  const [showPayload, setShowPayload] = useState(false);

  const stepTitles = useMemo(() => {
    const titles = new Map<string, string>();

    if (!diagram) {
      Object.values(flow.steps).forEach((flowStep, index) => {
        titles.set(flowStep.id, `${index + 1}. ${flowStep.type}`);
      });
      return titles;
    }

    const { components, connections } = resolveSceneSnapshot(
      diagram,
      diagram.activeSceneId ?? null,
    );

    Object.values(flow.steps).forEach((flowStep, index) => {
      const prefix = `${index + 1}. `;
      if (flowStep.componentId) {
        const component = components[flowStep.componentId];
        titles.set(
          flowStep.id,
          component
            ? `${prefix}${component.name}`
            : `${prefix}${t("flowStepNav.componentRemoved")}`,
        );
        return;
      }
      if (flowStep.connectionId) {
        const connection = connections[flowStep.connectionId];
        titles.set(
          flowStep.id,
          connection?.label?.trim()
            ? `${prefix}${connection.label}`
            : connection
              ? `${prefix}${t("common.connection")}`
              : `${prefix}${t("flowStepNav.connectionRemoved")}`,
        );
        return;
      }
      if (flowStep.conditionLabel?.trim()) {
        titles.set(flowStep.id, `${prefix}${flowStep.conditionLabel}`);
        return;
      }
      if (flowStep.note?.trim()) {
        titles.set(flowStep.id, `${prefix}${flowStep.note}`);
        return;
      }
      titles.set(flowStep.id, `${prefix}${flowStep.type}`);
    });

    return titles;
  }, [diagram, flow.steps, t]);

  const dotInfos = useMemo(
    () => buildDotInfos(flow, stepTitles),
    [flow, stepTitles],
  );
  const total = dotInfos.length;
  const currentIndex = currentStepId
    ? dotInfos.findIndex((dot) => dot.id === currentStepId)
    : -1;

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 w-[460px] rounded-xl border border-border bg-card/95 backdrop-blur-sm shadow-2xl">
      <div className="px-4 py-2 flex items-center gap-1 overflow-x-auto border-b border-border">
        {dotInfos.map((dot, i) => {
          const isCurrent = dot.id === currentStepId;
          const isPast = currentIndex >= 0 && i < currentIndex;
          const isCond = dot.type === "condition";
          return (
            <div key={dot.id} className="relative flex shrink-0 flex-col items-center gap-0.5 group">
              {i > 0 && (
                <div
                  className="absolute right-full top-[7px] h-px w-full"
                  style={{
                    background: isPast
                      ? (dot.branchColor ?? "hsl(var(--primary))")
                      : "hsl(var(--border))",
                  }}
                />
              )}
              {dot.isBranchStart && dot.branchColor ? (
                <div
                  className="absolute -top-2.5 left-1/2 h-2.5 w-0.5 -translate-x-1/2 rounded-full opacity-70"
                  style={{ background: dot.branchColor }}
                />
              ) : null}
              <div
                title={dot.title}
                className={`
                  ${total > 20 ? "h-2 w-2" : "h-3.5 w-3.5"}
                  ${isCond ? "rotate-45 rounded-sm" : "rounded-full"}
                  border-2 transition-all duration-200
                  ${isCurrent
                    ? "scale-110 border-primary bg-primary ring-2 ring-primary/30"
                    : isPast
                      ? dot.branchColor
                        ? "border-opacity-80"
                        : isCond
                          ? "border-amber-400/70 bg-amber-400/70"
                          : "border-primary/60 bg-primary/60"
                      : isCond
                        ? "border-amber-400/70 bg-amber-400/10"
                        : "border-border bg-background"}
                `}
                style={
                  isPast && dot.branchColor
                    ? {
                        backgroundColor: dot.branchColor,
                        borderColor: dot.branchColor,
                        opacity: 0.7,
                      }
                    : undefined
                }
              />
              {total <= 20 && (
                <span className="text-[9px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity absolute top-4">
                  {i + 1}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
        <div className="flex items-center gap-2 min-w-0">
          <button onClick={onGoBack} disabled={!canGoBack}
            className="rounded-md p-1 text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex items-center gap-1.5">
            <span className="text-xs font-semibold text-foreground truncate">{flow.name}</span>
            {flow.description && (
              <span className="text-[10px] text-muted-foreground italic truncate hidden sm:inline">
                {t("flowStepNav.inlineDescription", { text: flow.description })}
              </span>
            )}
          </div>
          <span className="text-[10px] font-mono text-muted-foreground shrink-0">
            {currentIndex >= 0 ? currentIndex + 1 : "—"} / {total}
          </span>
          {!isCondition && (
            <button onClick={onGoNext} disabled={!canGoForward}
              className="rounded-md p-1 text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors">
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
        <button onClick={onExit} className="text-muted-foreground hover:text-foreground transition-colors" title={t("flowStepNav.exitTitle")}>
          <X className="h-4 w-4" />
        </button>
      </div>

      {isCondition && step?.branches && (
        <div className="px-4 py-3">
          <p className="text-xs font-semibold text-amber-400 mb-3">
            ◇ {step.conditionLabel}
          </p>
          <div className="grid gap-2">
            {step.branches.map((branch, i) => (
              <button
                key={i}
                onClick={() => onChooseBranch(i)}
                className="w-full text-left rounded-lg border border-border bg-secondary hover:bg-surface-hover hover:border-primary/40 px-4 py-3 text-sm font-medium transition-all"
              >
                {branch.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {!isCondition && (step?.note || step?.description || step?.duration) && (
        <div className="px-4 py-3 flex items-start gap-2">
          <MessageSquare className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            {step.note && <p className="text-xs text-foreground leading-relaxed">{step.note}</p>}
            {step.description && <p className="text-xs text-muted-foreground italic leading-relaxed">{step.description}</p>}
          </div>
          {step.duration && (
            <span className="inline-flex items-center gap-1 text-[10px] font-mono text-primary shrink-0">
              <Clock className="h-3 w-3" /> {step.duration}
            </span>
          )}
        </div>
      )}

      {}
      {!isCondition && step?.payload && (
        <div className="px-4 pb-2">
          <button
            onClick={() => setShowPayload((v) => !v)}
            className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            {showPayload ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            <span>{step.payloadDirection === 'response' ? t("flowStepNav.response") : t("flowStepNav.request")}</span>
          </button>
          {showPayload && (
            <pre className="mt-1 rounded-md border border-border bg-secondary p-2 text-[10px] font-mono text-foreground whitespace-pre-wrap overflow-auto max-h-28">
              {step.payload}
            </pre>
          )}
        </div>
      )}

      {}
      {!isCondition && (
        <div className="px-4 py-2 flex justify-center gap-2">
          <button onClick={onGoBack} disabled={!canGoBack}
            className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors">
            <ChevronLeft className="h-3.5 w-3.5" /> {t("common.previous")}
          </button>
          <button onClick={onGoNext} disabled={!canGoForward}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
            {t("common.next")} <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};

export default FlowStepNavigator;
