import { useState } from "react";
import { ChevronLeft, ChevronRight, X, MessageSquare, Clock, ChevronDown, ChevronUp } from "lucide-react";
import type { Flow, FlowStep } from "@/features/diagram";
import { getOrderedStepIds } from "@/features/diagram";
import { useTranslation } from "react-i18next";

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
  const step = currentStep;
  const [showPayload, setShowPayload] = useState(false);

  const orderedIds = getOrderedStepIds(flow);
  const total = orderedIds.length;
  const currentIndex = currentStepId ? orderedIds.indexOf(currentStepId) : -1;

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 w-[460px] rounded-xl border border-border bg-card/95 backdrop-blur-sm shadow-2xl">
      <div className="px-4 py-2 flex items-center gap-1 overflow-x-auto border-b border-border">
        {orderedIds.map((id, i) => {
          const s = flow.steps[id];
          const isCond = s?.type === 'condition';
          return (
            <div key={id} className="relative flex flex-col items-center gap-0.5 group shrink-0">
              {i > 0 && (
                <div
                  className="absolute right-full top-[7px] w-full h-px bg-border"
                  style={currentIndex >= 0 && i <= currentIndex ? { background: "hsl(var(--primary))" } : undefined}
                />
              )}
              <div className={`
                ${total > 20 ? "w-2 h-2" : "w-3.5 h-3.5"} ${isCond ? "rotate-45" : ""} rounded-${isCond ? "sm" : "full"} border-2 transition-all duration-200
                ${id === currentStepId
                  ? "bg-primary border-primary ring-2 ring-primary/30 scale-110"
                  : currentIndex >= 0 && i < currentIndex
                    ? "bg-primary/60 border-primary/60"
                    : "bg-background border-border"}
              `} />
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
