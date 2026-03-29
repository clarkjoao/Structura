import { useState, useCallback, type DragEvent, type MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import type { FlowStep, Connection } from "@/features/diagram";
import type { BranchOwnerInfo } from "../flowMode.types";
import { StepItem } from "./StepItem";

export interface StepListProps {
  steps: FlowStep[];
  connections: Record<string, Connection>;
  branchOwnership: Map<string, BranchOwnerInfo>;
  getStepLabel: (step: FlowStep) => string;
  selectedStepId?: string | null;
  onDeleteStep: (index: number) => void;
  onReorderSteps: (from: number, to: number) => void;
  onUpdateStepDescription: (index: number, value: string) => void;
  onUpdateStepDuration: (index: number, value: string) => void;
  onUpdateStepPayload: (index: number, value: string) => void;
  onUpdateStepPayloadDirection: (index: number, direction: "request" | "response") => void;
  onUpdateStepIsAsync: (index: number, value: boolean) => void;
  editingFlowId: string | null;
  /** Step ids that are leaves in the preview graph (eligible for a flow link). */
  leafStepIds: Set<string>;
  onSetFlowLink: (
    stepId: string,
    target: {
      targetFlowId: string;
      targetFlowName: string;
      targetDiagramId: string;
      targetDiagramName: string;
    },
  ) => void;
  onRemoveFlowLink: (stepId: string) => void;
}

export function StepList({
  steps,
  connections: _connections,
  branchOwnership,
  getStepLabel,
  selectedStepId = null,
  onDeleteStep,
  onReorderSteps,
  onUpdateStepDescription,
  onUpdateStepDuration,
  onUpdateStepPayload,
  onUpdateStepPayloadDirection,
  onUpdateStepIsAsync,
  editingFlowId,
  leafStepIds,
  onSetFlowLink,
  onRemoveFlowLink,
}: StepListProps) {
  const { t } = useTranslation();
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  const handleDelete = useCallback(
    (i: number, e: MouseEvent) => {
      e.stopPropagation();
      if (expandedStep === i) setExpandedStep(null);
      else if (expandedStep !== null && expandedStep > i) setExpandedStep(expandedStep - 1);
      onDeleteStep(i);
    },
    [expandedStep, onDeleteStep],
  );

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
                  isSelectedFromMap={step.id === selectedStepId}
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
                  getStepLabel={getStepLabel}
                  editingFlowId={editingFlowId}
                  isFlowGraphLeaf={leafStepIds.has(step.id)}
                  onSetFlowLink={onSetFlowLink}
                  onRemoveFlowLink={onRemoveFlowLink}
                />
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
