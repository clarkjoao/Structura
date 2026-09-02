import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Check, ChevronRight } from "lucide-react";
import type { Flow, FlowStep } from "@/features/diagram";
import { buildFlowOutline, getBranchRows, isPlaceholderStep } from "@/features/diagram";
import { getBranchColor } from "../branchColors";

export interface BranchSelectViewProps {
  branchSelectCondition: FlowStep;
  flow: Flow;
  onEnterBranch: (conditionStepId: string, branchIndex: number) => void;
  conditionStepId: string;
  onContinueMainFlow: () => void;
}

export function BranchSelectView({
  branchSelectCondition,
  flow,
  onEnterBranch,
  conditionStepId,
  onContinueMainFlow,
}: BranchSelectViewProps) {
  const { t } = useTranslation();

  /**
   * How much has actually been recorded in each branch. A branch always holds
   * at least the step that keeps it open, so counting rows would call an empty
   * branch done; the steps nobody has filled in yet do not count.
   */
  const recordedCounts = useMemo(() => {
    const outline = buildFlowOutline(flow);
    return (branchSelectCondition.branches ?? []).map(
      (_, branchIndex) =>
        getBranchRows(outline, conditionStepId, branchIndex).filter((row) => {
          const step = flow.steps[row.stepId];
          return step ? !isPlaceholderStep(step) : false;
        }).length,
    );
  }, [branchSelectCondition.branches, conditionStepId, flow]);

  const allBranchesDone = recordedCounts.length > 0 && recordedCounts.every((count) => count > 0);

  return (
    <div className="flex flex-1 flex-col space-y-4 p-4">
      <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2">
        <span className="text-lg text-amber-400">◇</span>
        <span className="text-sm font-medium text-foreground">
          {branchSelectCondition.conditionLabel}
        </span>
      </div>

      <p className="text-xs text-muted-foreground">{t("flowScript.selectBranchPrompt")}</p>

      <div className="space-y-2">
        {branchSelectCondition.branches?.map((branch, branchIndex) => {
          const stepCount = recordedCounts[branchIndex] ?? 0;
          const isDone = stepCount > 0;
          const color = getBranchColor(branchIndex);
          return (
            <button
              key={branchIndex}
              type="button"
              onClick={() => onEnterBranch(conditionStepId, branchIndex)}
              className="flex w-full items-center gap-3 rounded-lg border bg-card px-4 py-3 text-left transition-colors hover:bg-surface-hover"
              style={{ borderColor: `${color}40` }}
            >
              <div className="w-1 self-stretch rounded-full" style={{ backgroundColor: color }} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">{branch.label}</p>
                <p className="text-[11px] text-muted-foreground">
                  {isDone
                    ? t("flowScript.branchStepCount", { count: stepCount })
                    : t("flowScript.branchEmptyHint")}
                </p>
              </div>
              {isDone ? (
                <Check className="h-4 w-4 shrink-0 text-emerald-400" />
              ) : (
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
            </button>
          );
        })}
      </div>

      {allBranchesDone && (
        <button
          type="button"
          onClick={onContinueMainFlow}
          className="flex items-center gap-2 text-sm font-medium text-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> {t("flowScript.continueMainFlow")}
        </button>
      )}
    </div>
  );
}
