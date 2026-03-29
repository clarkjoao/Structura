import { useCallback, useEffect, useMemo, useState } from "react";
import {
  useComponents,
  useConnections,
  stepsToMermaid,
  buildFlowFromRecordingSnapshot,
} from "@/features/diagram";
import type { FlowLinkTarget, FlowStep, Flow } from "@/features/diagram";
import { isConditionStep, isFlowLinkStep } from "@/features/diagram";
import { useTranslation } from "react-i18next";
import { ArrowLeft, X } from "lucide-react";
import { toast } from "sonner";
import type { BranchOwnerInfo, RecordingContext } from "./flowMode.types";
import { RecorderHeader } from "./recorder/RecorderHeader";
import { RecorderMetadataForm } from "./recorder/RecorderMetadataForm";
import { StepList } from "./recorder/StepList";
import { MermaidPreview } from "./recorder/MermaidPreview";
import { StepDetailEditor } from "./recorder/StepDetailEditor";

interface Props {
  recordingContext: RecordingContext;
  name: string;
  onNameChange: (name: string) => void;
  description: string;
  onDescriptionChange: (desc: string) => void;
  tags: string[];
  onAddTag: (tag: string) => void;
  onRemoveTag: (index: number) => void;
  /** Steps shown in the list (full trunk or current branch only). */
  steps: FlowStep[];
  /** Full recording sequence for Mermaid preview and branch metrics. */
  recordingSteps: FlowStep[];
  branchOwnership: Map<string, BranchOwnerInfo>;
  /** Step id selected from the branch map — scrolls and highlights the row. */
  selectedStepId?: string | null;
  /** Clears map/panel step selection (back to list + Mermaid). */
  onClearSelectedStep: () => void;
  onCancel: () => void;
  onFinalize: () => void;
  onUpdateStepDescription: (index: number, description: string) => void;
  onUpdateStepDuration: (index: number, duration: string) => void;
  onUpdateStepPayload: (index: number, payload: string) => void;
  onUpdateStepPayloadDirection: (index: number, direction: "request" | "response") => void;
  onUpdateStepIsAsync: (index: number, isAsync: boolean) => void;
  onDeleteStep: (index: number) => void;
  onReorderSteps: (fromIndex: number, toIndex: number) => void;
  editingFlowId: string | null;
  onSetFlowLink: (stepId: string, target: FlowLinkTarget) => void;
  onRemoveFlowLink: (stepId: string) => void;
  onConvertStepToCondition: (index: number, conditionLabel: string, branchLabels: string[]) => void;
  isEditing?: boolean;
}

const FlowRecorderPanel = ({
  recordingContext,
  name,
  onNameChange,
  description,
  onDescriptionChange,
  tags,
  onAddTag,
  onRemoveTag,
  steps,
  recordingSteps,
  branchOwnership,
  selectedStepId = null,
  onClearSelectedStep,
  onCancel,
  onFinalize,
  onUpdateStepDescription,
  onUpdateStepDuration,
  onUpdateStepPayload,
  onUpdateStepPayloadDirection,
  onUpdateStepIsAsync,
  onDeleteStep,
  onReorderSteps,
  editingFlowId,
  onSetFlowLink,
  onRemoveFlowLink,
  onConvertStepToCondition,
  isEditing,
}: Props) => {
  const { t } = useTranslation();
  const [mermaidVisible, setMermaidVisible] = useState(false);
  const components = useComponents();
  const connections = useConnections();

  const previewFlow: Flow = useMemo(
    () => buildFlowFromRecordingSnapshot(recordingSteps, branchOwnership, { name }),
    [recordingSteps, branchOwnership, name],
  );

  const selectedStep = useMemo(() => {
    if (!selectedStepId) return null;
    return recordingSteps.find((recordingStep) => recordingStep.id === selectedStepId) ?? null;
  }, [recordingSteps, selectedStepId]);

  /** Index in the panel list (`steps`); update handlers resolve steps via this list. */
  const selectedStepIndex = useMemo(() => {
    if (!selectedStep) return -1;
    return steps.findIndex((panelStep) => panelStep.id === selectedStep.id);
  }, [steps, selectedStep]);

  const showStepDetail = selectedStep !== null && selectedStepIndex >= 0;

  const conditionSteps = useMemo(
    () => recordingSteps.filter((recordingStep) => isConditionStep(recordingStep)),
    [recordingSteps],
  );

  const isLeafSelected = useMemo((): boolean => {
    if (!selectedStep) return false;
    const record = previewFlow.steps[selectedStep.id];
    if (!record) return false;
    if (isConditionStep(record)) return !record.next;
    if (isFlowLinkStep(record)) return true;
    return !record.next;
  }, [previewFlow, selectedStep]);

  useEffect(() => {
    if (!selectedStepId) return;
    if (!recordingSteps.some((recordingStep) => recordingStep.id === selectedStepId)) {
      onClearSelectedStep();
    }
  }, [recordingSteps, selectedStepId, onClearSelectedStep]);

  const leafStepIds = useMemo(() => {
    const graphLeaves = new Set<string>();
    for (const [stepId, flowStep] of Object.entries(previewFlow.steps)) {
      if (isConditionStep(flowStep)) continue;
      if (isFlowLinkStep(flowStep)) continue;
      if (!flowStep.next) graphLeaves.add(stepId);
    }
    return graphLeaves;
  }, [previewFlow]);

  useEffect(() => {
    if (!selectedStepId || showStepDetail) return;
    const stepRow = document.querySelector(`[data-step-id="${CSS.escape(selectedStepId)}"]`);
    stepRow?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedStepId, steps, showStepDetail]);

  const participants = useMemo(() => {
    return [
      ...new Set(
        recordingSteps
          .map((step) =>
            !isFlowLinkStep(step) && step.componentId ? components[step.componentId]?.name : null,
          )
          .filter(Boolean) as string[],
      ),
    ];
  }, [recordingSteps, components]);

  const getStepLabel = useCallback(
    (step: FlowStep): string => {
      if (isFlowLinkStep(step)) {
        return `→ ${step.targetFlowName}`;
      }
      if (isConditionStep(step)) {
        return `◇ ${step.conditionLabel ?? t("flowRecorder.condition")}`;
      }
      if (step.connectionId) {
        const connection = connections[step.connectionId];
        if (connection) return `${t("flowRecorder.connectionLabelPrefix")}${connection.label}`;
      }
      if (step.componentId) {
        return components[step.componentId]?.name ?? t("flowRecorder.unknownStep");
      }
      return t("flowRecorder.unknownStep");
    },
    [components, connections, t],
  );

  const handleFinalize = () => {
    if (!name.trim()) toast.warning(t("flowRecorder.emptyNameWarning"));
    if (recordingSteps.length === 0) toast.warning(t("flowRecorder.noStepsWarning"));
    onFinalize();
  };

  const mermaidPreview = useMemo(() => {
    const stepsRecord: Record<string, FlowStep> = {};
    for (const step of recordingSteps) stepsRecord[step.id] = step;
    for (let i = 0; i < recordingSteps.length - 1; i++) {
      const step = recordingSteps[i];
      if (isFlowLinkStep(step) || isConditionStep(step) || step.next) continue;
      stepsRecord[step.id] = { ...step, next: recordingSteps[i + 1].id };
    }
    const tempFlow: Flow = {
      id: "preview",
      name,
      mermaid: "",
      diagramId: "",
      entryStepId: recordingSteps[0]?.id,
      steps: stepsRecord,
    };
    return stepsToMermaid(tempFlow, components, connections);
  }, [recordingSteps, components, connections, name]);

  return (
    <div className="w-80 h-full min-h-0 border-l border-border bg-card overflow-hidden flex flex-col">
      <RecorderHeader
        isEditing={isEditing}
        onCancel={onCancel}
        mermaidVisible={mermaidVisible}
        onToggleMermaid={() => setMermaidVisible((previous) => !previous)}
      />
      <RecorderMetadataForm
        name={name}
        onNameChange={onNameChange}
        description={description}
        onDescriptionChange={onDescriptionChange}
        tags={tags}
        onAddTag={onAddTag}
        onRemoveTag={onRemoveTag}
        participants={participants}
        recordingMode={recordingContext.mode}
        autoFocusName={recordingContext.mode === "trunk"}
      />
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col">
        <div className="p-3 space-y-3 flex-1 min-h-0">
          {showStepDetail && selectedStep ? (
            <>
              <div className="flex items-center gap-2 border-b border-border pb-2 shrink-0">
                <button
                  type="button"
                  onClick={onClearSelectedStep}
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
                  aria-label={t("stepDetail.backAria")}
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                </button>
                <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
                  {getStepLabel(selectedStep)}
                </span>
                <button
                  type="button"
                  onClick={onClearSelectedStep}
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
                  aria-label={t("stepDetail.closeAria")}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <StepDetailEditor
                step={selectedStep}
                stepIndex={selectedStepIndex}
                conditionSteps={conditionSteps}
                editingFlowId={editingFlowId}
                isLeaf={isLeafSelected}
                onUpdateStepDescription={onUpdateStepDescription}
                onUpdateStepDuration={onUpdateStepDuration}
                onUpdateStepPayload={onUpdateStepPayload}
                onUpdateStepPayloadDirection={onUpdateStepPayloadDirection}
                onUpdateStepIsAsync={onUpdateStepIsAsync}
                onConvertStepToCondition={onConvertStepToCondition}
                onSetFlowLink={onSetFlowLink}
                onRemoveFlowLink={onRemoveFlowLink}
                onClose={onClearSelectedStep}
              />
            </>
          ) : (
            <>
              <StepList
                steps={steps}
                connections={connections}
                branchOwnership={branchOwnership}
                getStepLabel={getStepLabel}
                selectedStepId={selectedStepId}
                onDeleteStep={onDeleteStep}
                onReorderSteps={onReorderSteps}
                onUpdateStepDescription={onUpdateStepDescription}
                onUpdateStepDuration={onUpdateStepDuration}
                onUpdateStepPayload={onUpdateStepPayload}
                onUpdateStepPayloadDirection={onUpdateStepPayloadDirection}
                onUpdateStepIsAsync={onUpdateStepIsAsync}
                editingFlowId={editingFlowId}
                leafStepIds={leafStepIds}
                onSetFlowLink={onSetFlowLink}
                onRemoveFlowLink={onRemoveFlowLink}
              />
              {mermaidVisible && recordingSteps.length > 0 && <MermaidPreview mermaid={mermaidPreview} />}
            </>
          )}
        </div>
      </div>
      <div className="p-3 border-t border-border flex gap-2 shrink-0">
        <button
          type="button"
          onClick={handleFinalize}
          className="flex-1 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          {t("flowRecorder.finalize")}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-2 text-xs text-muted-foreground hover:text-foreground border border-border rounded-md transition-colors"
        >
          {t("flowRecorder.cancel")}
        </button>
      </div>
    </div>
  );
};

export default FlowRecorderPanel;
