import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import type { Flow, FlowStep } from "@/features/diagram";
import { buildFlowOutline, useComponents, useConnections } from "@/features/diagram";
import { useFlowScriptActions } from "../useFlowScriptActions";
import { ConditionForm, type ConditionFormState } from "./ConditionForm";
import { FlowScriptRow } from "./FlowScriptRow";

export interface FlowScriptListProps {
  flow: Flow;
  /** Step highlighted on the canvas, if any. */
  selectedStepId?: string | null;
  onSelectStep?: (stepId: string) => void;
  /** Recorder-only: jump into a condition's branches. */
  onOpenBranchSelect?: (conditionStepId: string) => void;
}

/**
 * The flow as a script: one row per step, numbered from the graph, branches
 * indented under the condition that opens them.
 *
 * Every row edits the stored flow directly — there is no draft copy to
 * reconcile, and the numbers are derived on each render rather than stored.
 */
export function FlowScriptList({
  flow,
  selectedStepId,
  onSelectStep,
  onOpenBranchSelect,
}: FlowScriptListProps) {
  const { t } = useTranslation();
  const components = useComponents();
  const connections = useConnections();
  const actions = useFlowScriptActions(flow.id);
  const [expandedStepId, setExpandedStepId] = useState<string | null>(null);
  const [conditionForm, setConditionForm] = useState<ConditionFormState | null>(null);

  const outline = useMemo(() => buildFlowOutline(flow), [flow]);

  const titleOf = useCallback(
    (step: FlowStep): string => {
      if (step.branches && step.branches.length > 0) {
        return `◇ ${step.conditionLabel ?? t("flowScript.condition")}`;
      }
      if (step.connectionId) {
        const connection = connections[step.connectionId];
        if (connection) return `${t("flowScript.connectionPrefix")}${connection.label}`;
      }
      if (step.componentId) {
        return components[step.componentId]?.name ?? t("flowScript.unknownStep");
      }
      if (step.description?.trim()) return step.description;
      return t("flowScript.emptyStep");
    },
    [components, connections, t],
  );

  const submitConditionForm = useCallback(() => {
    if (!conditionForm) return;
    const branches = conditionForm.branches.filter((branch) => branch.trim());
    if (branches.length < 2) {
      toast.warning(t("flowScript.minBranches"));
      return;
    }
    actions.convertToCondition(conditionForm.stepId, conditionForm.label, branches);
    setConditionForm(null);
  }, [actions, conditionForm, t]);

  const lastStepId = outline.rows[outline.rows.length - 1]?.stepId;

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {t("flowScript.stepsHeading", { count: outline.rows.length })}
      </p>

      {outline.rows.length === 0 ? (
        <p className="py-2 text-xs italic text-muted-foreground">{t("flowScript.empty")}</p>
      ) : (
        <div className="space-y-0.5">
          {outline.rows.map((row) => {
            const step = flow.steps[row.stepId];
            if (!step) return null;
            return (
              <FlowScriptRow
                key={row.stepId}
                row={row}
                step={step}
                title={titleOf(step)}
                isExpanded={expandedStepId === row.stepId}
                isSelected={selectedStepId === row.stepId}
                isLast={lastStepId === row.stepId}
                actions={actions}
                onToggleExpand={() =>
                  setExpandedStepId(expandedStepId === row.stepId ? null : row.stepId)
                }
                onSelect={() => onSelectStep?.(row.stepId)}
                onConvertToCondition={(stepId) =>
                  setConditionForm({ stepId, label: "", branches: ["", ""] })
                }
                onOpenBranchSelect={onOpenBranchSelect}
              />
            );
          })}
        </div>
      )}

      {outline.unreachable.length > 0 && (
        <p className="flex items-center gap-1 text-[10px] text-amber-400">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          {t("flowScript.unreachable", { count: outline.unreachable.length })}
        </p>
      )}

      {conditionForm && (
        <ConditionForm
          form={conditionForm}
          onChange={setConditionForm}
          onSubmit={submitConditionForm}
          onCancel={() => setConditionForm(null)}
        />
      )}
    </div>
  );
}
