import { useTranslation } from "react-i18next";
import { Check, ChevronRight, ArrowLeft } from "lucide-react";
import type { FlowStep, Flow } from "@/features/diagram";
import { getBranchStepCount } from "@/features/diagram";
import { getBranchColor } from "../branchColors";

export interface BranchSelectViewProps {
  branchSelectCondition: FlowStep;
  previewFlow: Flow;
  onEnterBranch: (conditionStepId: string, branchIndex: number) => void;
  conditionStepId: string;
  onContinueMainFlow: () => void;
}

export function BranchSelectView({
  branchSelectCondition,
  previewFlow,
  onEnterBranch,
  conditionStepId,
  onContinueMainFlow,
}: BranchSelectViewProps) {
  const { t } = useTranslation();
  const allBranchesDone =
    branchSelectCondition.branches?.every((b) => getBranchStepCount(previewFlow, b.nextId) > 0) ??
    false;

  return (
    <div className="flex-1 flex flex-col p-4 space-y-4">
      <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2">
        <span className="text-amber-400 text-lg">◇</span>
        <span className="text-sm font-medium text-foreground">
          {branchSelectCondition.conditionLabel}
        </span>
      </div>

      <p className="text-xs text-muted-foreground">
        {t("flowRecorder.selectBranchPrompt", "Selecione um branch para gravar:")}
      </p>

      <div className="space-y-2">
        {branchSelectCondition.branches?.map((branch, i) => {
          const stepCount = getBranchStepCount(previewFlow, branch.nextId);
          const isDone = stepCount > 0;
          const color = getBranchColor(i);
          return (
            <button
              key={i}
              type="button"
              onClick={() => onEnterBranch(conditionStepId, i)}
              className="w-full flex items-center gap-3 rounded-lg border bg-card hover:bg-surface-hover transition-colors px-4 py-3 text-left"
              style={{ borderColor: `${color}40` }}
            >
              <div className="w-1 self-stretch rounded-full" style={{ backgroundColor: color }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">{branch.label}</p>
                <p className="text-[11px] text-muted-foreground">
                  {isDone
                    ? t("flowRecorder.branchStepCount", {
                        count: stepCount,
                        defaultValue: `${stepCount} passo(s)`,
                      })
                    : t("flowRecorder.branchEmptyHint", "Vazio — clique para gravar")}
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
          <ArrowLeft className="h-4 w-4" />{" "}
          {t("flowRecorder.continueMainFlow", "Continuar fluxo principal")}
        </button>
      )}
    </div>
  );
}
