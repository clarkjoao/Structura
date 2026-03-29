import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, X, MessageSquare, Clock, ChevronDown, ChevronUp } from "lucide-react";
import type { Flow, FlowStep } from "@/features/diagram";
import { useComponents, useConnections, isConditionStep, isFlowLinkStep } from "@/features/diagram";
import { useTranslation } from "react-i18next";
import type { PendingFlowLink } from "./flowMode.types";
import { FlowBranchGraph } from "./FlowBranchGraph";
import { useBranchGraphLayout } from "./useBranchGraphLayout";

interface Props {
  flow: Flow;
  currentStepId: string | null;
  currentStep: FlowStep | null;
  isCondition: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  visitedStepIds: Set<string>;
  pendingFlowLink: PendingFlowLink | null;
  onGoNext: () => void;
  onGoBack: () => void;
  onChooseBranch: (branchIndex: number) => void;
  onFollowFlowLink: (target: { targetFlowId: string; targetDiagramId: string }) => void;
  onClearPendingFlowLink: () => void;
  onExit: () => void;
}

function FlowStepNavigator({
  flow,
  currentStepId,
  currentStep,
  isCondition,
  canGoBack,
  canGoForward,
  visitedStepIds,
  pendingFlowLink,
  onGoNext,
  onGoBack,
  onChooseBranch,
  onFollowFlowLink,
  onClearPendingFlowLink,
  onExit,
}: Props) {
  const { t } = useTranslation();
  const step = currentStep;
  const [showPayload, setShowPayload] = useState(false);

  const components = useComponents();
  const connections = useConnections();
  const layout = useBranchGraphLayout(flow, components, connections);

  const total = layout.nodes.length;
  const currentIndex = currentStepId
    ? layout.nodes.findIndex((node) => node.id === currentStepId)
    : -1;

  const isFlowLinkPreview = step !== null && isFlowLinkStep(step) && !pendingFlowLink;
  const flowLinkTarget = useMemo(() => {
    if (pendingFlowLink) return pendingFlowLink;
    if (step && isFlowLinkStep(step)) {
      return {
        targetFlowId: step.targetFlowId,
        targetFlowName: step.targetFlowName,
        targetDiagramId: step.targetDiagramId,
        targetDiagramName: step.targetDiagramName,
      };
    }
    return null;
  }, [pendingFlowLink, step]);

  const showFlowLinkPrompt = !!pendingFlowLink && !!flowLinkTarget;

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 w-[460px] rounded-xl border border-border bg-card/95 backdrop-blur-sm shadow-2xl">
      <div className="px-3 py-2 overflow-x-auto border-b border-border" style={{ minHeight: 32 }}>
        <FlowBranchGraph
          layout={layout}
          orientation="horizontal"
          currentStepId={currentStepId ?? undefined}
          visitedStepIds={visitedStepIds}
        />
      </div>

      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={onGoBack}
            disabled={!canGoBack}
            className="rounded-md p-1 text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
          >
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
          {!isCondition &&
            (!showFlowLinkPrompt || !!(step && isFlowLinkStep(step) && !pendingFlowLink)) && (
            <button
              type="button"
              onClick={onGoNext}
              disabled={!canGoForward}
              className="rounded-md p-1 text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={onExit}
          className="text-muted-foreground hover:text-foreground transition-colors"
          title={t("flowStepNav.exitTitle")}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {step && isConditionStep(step) && (
        <div className="px-4 py-3">
          <p className="text-xs font-semibold text-amber-400 mb-3">◇ {step.conditionLabel}</p>
          <div className="grid gap-2">
            {step.branches.map((branch, branchIndex) => (
              <button
                key={branchIndex}
                type="button"
                onClick={() => onChooseBranch(branchIndex)}
                className="w-full text-left rounded-lg border border-border bg-secondary hover:bg-surface-hover hover:border-primary/40 px-4 py-3 text-sm font-medium transition-all"
              >
                {branch.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {showFlowLinkPrompt && (
        <div className="px-4 py-4 border-b border-border bg-amber-500/10">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400 mb-2">
            {t("flowLink.continuesIn")}
          </p>

          <div className="rounded-lg border border-border bg-card p-3 mb-3">
            <p className="text-sm font-semibold text-foreground truncate">
              🔗 {flowLinkTarget?.targetFlowName}
            </p>
            <p className="text-[11px] text-muted-foreground truncate">
              {t("flowLink.continuesInDiagram", { name: flowLinkTarget?.targetDiagramName })}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                flowLinkTarget &&
                onFollowFlowLink({
                  targetFlowId: flowLinkTarget.targetFlowId,
                  targetDiagramId: flowLinkTarget.targetDiagramId,
                })
              }
              className="inline-flex flex-1 min-w-[120px] items-center justify-center rounded-md bg-amber-500 px-3 py-2 text-xs font-semibold text-amber-950 hover:bg-amber-500/90 transition-colors"
            >
              {t("flowLink.follow")}
            </button>
            <button
              type="button"
              onClick={onClearPendingFlowLink}
              className="inline-flex flex-1 min-w-[120px] items-center justify-center rounded-md border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {t("flowLink.stayHere")}
            </button>
          </div>
        </div>
      )}

      {!showFlowLinkPrompt &&
        !isCondition &&
        (!!step?.note ||
          !!step?.description ||
          (step !== null && "duration" in step && !!step.duration) ||
          isFlowLinkPreview) && (
        <div className="px-4 py-3 flex items-start gap-2">
          <MessageSquare className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            {step?.note ? (
              <p className="text-xs text-foreground leading-relaxed">{step.note}</p>
            ) : null}
            {step?.description ? (
              <p className="text-xs text-muted-foreground italic leading-relaxed">{step.description}</p>
            ) : null}
            {isFlowLinkPreview && flowLinkTarget && (
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                ↗ {t("flowLink.continuesIn")} {flowLinkTarget.targetFlowName}
              </p>
            )}
          </div>
          {step !== null && "duration" in step && step.duration ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-mono text-primary shrink-0">
              <Clock className="h-3 w-3" /> {step.duration}
            </span>
          ) : null}
        </div>
      )}

      {!showFlowLinkPrompt &&
        !isCondition &&
        step !== null &&
        "payload" in step &&
        step.payload && (
        <div className="px-4 pb-2">
          <button
            type="button"
            onClick={() => setShowPayload((value) => !value)}
            className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            {showPayload ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            <span>
              {step.payloadDirection === "response" ? t("flowStepNav.response") : t("flowStepNav.request")}
            </span>
          </button>
          {showPayload ? (
            <pre className="mt-1 rounded-md border border-border bg-secondary p-2 text-[10px] font-mono text-foreground whitespace-pre-wrap overflow-auto max-h-28">
              {step.payload}
            </pre>
          ) : null}
        </div>
      )}

      {!isCondition &&
        (!showFlowLinkPrompt || !!(step && isFlowLinkStep(step) && !pendingFlowLink)) && (
        <div className="px-4 py-2 flex justify-center gap-2">
          <button
            type="button"
            onClick={onGoBack}
            disabled={!canGoBack}
            className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> {t("common.previous")}
          </button>
          <button
            type="button"
            onClick={onGoNext}
            disabled={!canGoForward}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {t("common.next")} <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

export default FlowStepNavigator;
