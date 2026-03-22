import { useState, useCallback, type DragEvent, type MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { FlowStep, Connection } from "@/features/diagram";
import type { BranchOwnerInfo } from "../RecordingModeContext";
import { GitBranch } from "lucide-react";
import { StepItem } from "./StepItem";
import { ConditionStepForm, type ConditionFormState } from "./ConditionStepForm";

export interface StepListProps {
  steps: FlowStep[];
  connections: Record<string, Connection>;
  branchOwnership: Map<string, BranchOwnerInfo>;
  getStepLabel: (step: FlowStep) => string;
  onDeleteStep: (index: number) => void;
  onReorderSteps: (from: number, to: number) => void;
  onUpdateStepDescription: (index: number, value: string) => void;
  onUpdateStepDuration: (index: number, value: string) => void;
  onUpdateStepPayload: (index: number, value: string) => void;
  onUpdateStepPayloadDirection: (index: number, direction: "request" | "response") => void;
  onUpdateStepIsAsync: (index: number, value: boolean) => void;
  onUpdateConditionLabel: (index: number, label: string) => void;
  onAddBranchLabel: (conditionStepId: string, label: string) => void;
  onRemoveBranchLabel: (conditionStepId: string, branchIndex: number) => void;
  onUpdateBranchLabel: (conditionStepId: string, branchIndex: number, label: string) => void;
  onOpenBranchSelect: (conditionStepId: string) => void;
  onConvertStepToCondition: (index: number, conditionLabel: string, branchLabels: string[]) => void;
  onAddConditionStep: (conditionLabel: string, branchLabels: string[]) => void;
}

export function StepList({
  steps,
  connections: _connections,
  branchOwnership,
  getStepLabel,
  onDeleteStep,
  onReorderSteps,
  onUpdateStepDescription,
  onUpdateStepDuration,
  onUpdateStepPayload,
  onUpdateStepPayloadDirection,
  onUpdateStepIsAsync,
  onUpdateConditionLabel,
  onAddBranchLabel,
  onRemoveBranchLabel,
  onUpdateBranchLabel,
  onOpenBranchSelect,
  onConvertStepToCondition,
  onAddConditionStep,
}: StepListProps) {
  void _connections;
  const { t } = useTranslation();
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [conditionForm, setConditionForm] = useState<ConditionFormState | null>(null);

  const handleDelete = useCallback(
    (i: number, e: MouseEvent) => {
      e.stopPropagation();
      if (expandedStep === i) setExpandedStep(null);
      else if (expandedStep !== null && expandedStep > i) setExpandedStep(expandedStep - 1);
      onDeleteStep(i);
    },
    [expandedStep, onDeleteStep],
  );

  const handleConditionFormSubmit = useCallback(() => {
    if (!conditionForm) return;
    const validBranches = conditionForm.branches.filter((b) => b.trim());
    if (validBranches.length < 2) {
      toast.warning(t("flowRecorder.minBranchesWarning", "At least 2 branches required"));
      return;
    }
    if (conditionForm.index === -1) {
      onAddConditionStep(conditionForm.label, validBranches);
    } else {
      onConvertStepToCondition(conditionForm.index, conditionForm.label, validBranches);
    }
    setConditionForm(null);
  }, [conditionForm, onAddConditionStep, onConvertStepToCondition, t]);

  const cancelConditionDialog = useCallback(() => setConditionForm(null), []);

  const onDragStart = useCallback((e: DragEvent, i: number) => {
    e.dataTransfer.effectAllowed = "move";
    setDragIdx(i);
  }, []);

  const onDragOver = useCallback(
    (e: DragEvent, i: number) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (dragIdx !== null) setOverIdx(i);
    },
    [dragIdx],
  );

  const onDrop = useCallback(
    (e: DragEvent, i: number) => {
      e.preventDefault();
      if (dragIdx !== null && dragIdx !== i) onReorderSteps(dragIdx, i);
      setDragIdx(null);
      setOverIdx(null);
    },
    [dragIdx, onReorderSteps],
  );

  const onDragEnd = useCallback(() => {
    setDragIdx(null);
    setOverIdx(null);
  }, []);

  return (
    <>
      <div className="space-y-1">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
          {t("flowRecorder.stepsHeading", { count: steps.length })}
        </p>
        {steps.length === 0 ? (
          <p className="text-xs text-muted-foreground italic py-2">{t("flowRecorder.recordHint")}</p>
        ) : (
          <div className="space-y-0.5 max-h-48 overflow-auto">
            {steps.map((step, i) => {
              const ownerInfo = branchOwnership.get(step.id);
              const isBranchStep = !!ownerInfo;
              const isDragOver = overIdx === i && dragIdx !== null && dragIdx !== i;
              return (
                <StepItem
                  key={step.id}
                  step={step}
                  index={i}
                  isLast={i === steps.length - 1}
                  isExpanded={expandedStep === i}
                  isBranchStep={isBranchStep}
                  isDragging={dragIdx === i}
                  isDragOver={isDragOver}
                  onToggleExpand={() => setExpandedStep(expandedStep === i ? null : i)}
                  onDelete={(e) => handleDelete(i, e)}
                  onDragStart={onDragStart}
                  onDragOver={onDragOver}
                  onDrop={onDrop}
                  onDragEnd={onDragEnd}
                  onUpdateDescription={onUpdateStepDescription}
                  onUpdateDuration={onUpdateStepDuration}
                  onUpdatePayload={onUpdateStepPayload}
                  onUpdatePayloadDirection={onUpdateStepPayloadDirection}
                  onUpdateIsAsync={onUpdateStepIsAsync}
                  onUpdateConditionLabel={onUpdateConditionLabel}
                  onAddBranchLabel={onAddBranchLabel}
                  onRemoveBranchLabel={onRemoveBranchLabel}
                  onUpdateBranchLabel={onUpdateBranchLabel}
                  onOpenBranchSelect={onOpenBranchSelect}
                  onConvertToCondition={(idx) => setConditionForm({ index: idx, label: "", branches: ["", ""] })}
                  getStepLabel={getStepLabel}
                />
              );
            })}
          </div>
        )}
      </div>

      {!conditionForm && (
        <button
          type="button"
          onClick={() => setConditionForm({ index: -1, label: "", branches: ["", ""] })}
          className="flex items-center gap-1 text-[10px] text-amber-400 hover:text-amber-300 font-medium"
        >
          <GitBranch className="h-3 w-3" /> {t("flowRecorder.addCondition", "Add condition step")}
        </button>
      )}

      {conditionForm && (
        <ConditionStepForm
          conditionForm={conditionForm}
          onChange={setConditionForm}
          onSubmit={handleConditionFormSubmit}
          onCancel={cancelConditionDialog}
        />
      )}
    </>
  );
}
