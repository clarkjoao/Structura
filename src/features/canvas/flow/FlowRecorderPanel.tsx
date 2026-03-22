import { useCallback, useMemo } from "react";
import {
  useComponents,
  useConnections,
  stepsToMermaid,
  buildFlowFromRecordingSnapshot,
} from "@/features/diagram";
import type { FlowStep, Flow } from "@/features/diagram";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { BranchOwnerInfo, RecordingContext } from "./FlowModeContext";
import { RecorderHeader } from "./recorder/RecorderHeader";
import { RecorderMetadataForm } from "./recorder/RecorderMetadataForm";
import { BranchRecordingStrip } from "./recorder/BranchRecordingStrip";
import { BranchSelectView } from "./recorder/BranchSelectView";
import { StepList } from "./recorder/StepList";
import { MermaidPreview } from "./recorder/MermaidPreview";

interface Props {
  recordingContext: RecordingContext;
  setRecordingContext: React.Dispatch<React.SetStateAction<RecordingContext>>;
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
  onCancel: () => void;
  onFinalize: () => void;
  onUpdateStepDescription: (index: number, description: string) => void;
  onUpdateStepDuration: (index: number, duration: string) => void;
  onUpdateStepPayload: (index: number, payload: string) => void;
  onUpdateStepPayloadDirection: (index: number, direction: "request" | "response") => void;
  onUpdateStepIsAsync: (index: number, isAsync: boolean) => void;
  onDeleteStep: (index: number) => void;
  onReorderSteps: (fromIndex: number, toIndex: number) => void;
  onConvertStepToCondition: (index: number, conditionLabel: string, branchLabels: string[]) => void;
  onUpdateConditionLabel: (index: number, label: string) => void;
  onAddBranchLabel: (conditionStepId: string, label: string) => void;
  onRemoveBranchLabel: (conditionStepId: string, branchIndex: number) => void;
  onUpdateBranchLabel: (conditionStepId: string, branchIndex: number, label: string) => void;
  onAddConditionStep: (conditionLabel: string, branchLabels: string[]) => void;
  onEnterBranchRecording: (conditionStepId: string, branchIndex: number) => void;
  onOpenBranchSelect: (conditionStepId: string) => void;
  isEditing?: boolean;
}

const FlowRecorderPanel = ({
  recordingContext,
  setRecordingContext,
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
  onCancel,
  onFinalize,
  onUpdateStepDescription,
  onUpdateStepDuration,
  onUpdateStepPayload,
  onUpdateStepPayloadDirection,
  onUpdateStepIsAsync,
  onDeleteStep,
  onReorderSteps,
  onConvertStepToCondition,
  onUpdateConditionLabel,
  onAddBranchLabel,
  onRemoveBranchLabel,
  onUpdateBranchLabel,
  onAddConditionStep,
  onEnterBranchRecording,
  onOpenBranchSelect,
  isEditing,
}: Props) => {
  const { t } = useTranslation();
  const components = useComponents();
  const connections = useConnections();

  const previewFlow: Flow = useMemo(
    () => buildFlowFromRecordingSnapshot(recordingSteps, branchOwnership, { name }),
    [recordingSteps, branchOwnership, name],
  );

  const participants = useMemo(() => {
    return [
      ...new Set(
        recordingSteps
          .map((s) => (s.componentId ? components[s.componentId]?.name : null))
          .filter(Boolean) as string[],
      ),
    ];
  }, [recordingSteps, components]);

  const getStepLabel = useCallback(
    (step: FlowStep): string => {
      if (step.type === "condition") {
        return `◇ ${step.conditionLabel ?? t("flowRecorder.condition")}`;
      }
      if (step.connectionId) {
        const conn = connections[step.connectionId];
        if (conn) return `${t("flowRecorder.connectionLabelPrefix")}${conn.label}`;
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
    for (const s of recordingSteps) stepsRecord[s.id] = s;
    for (let i = 0; i < recordingSteps.length - 1; i++) {
      if (recordingSteps[i].type !== "condition" && !recordingSteps[i].next) {
        stepsRecord[recordingSteps[i].id] = { ...stepsRecord[recordingSteps[i].id], next: recordingSteps[i + 1].id };
      }
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

  const branchSelectCondition =
    recordingContext.mode === "branch-select"
      ? previewFlow.steps[recordingContext.conditionStepId]
      : undefined;

  const showTrunkBody =
    recordingContext.mode === "trunk" || recordingContext.mode === "branch-record";

  return (
    <div className="w-80 h-full min-h-0 border-l border-border bg-card overflow-hidden flex flex-col">
      <RecorderHeader isEditing={isEditing} onCancel={onCancel} />
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
      {recordingContext.mode === "branch-record" && (
        <BranchRecordingStrip
          conditionStepId={recordingContext.conditionStepId}
          branchIndex={recordingContext.branchIndex}
          branchLabel={recordingContext.branchLabel}
          onDone={(conditionStepId) =>
            setRecordingContext({ mode: "branch-select", conditionStepId })
          }
        />
      )}
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col">
        {recordingContext.mode === "branch-select" && branchSelectCondition && (
          <BranchSelectView
            branchSelectCondition={branchSelectCondition}
            previewFlow={previewFlow}
            conditionStepId={recordingContext.conditionStepId}
            onEnterBranch={onEnterBranchRecording}
            onContinueMainFlow={() => setRecordingContext({ mode: "trunk" })}
          />
        )}
        {showTrunkBody && (
          <div className="p-3 space-y-3 flex-1 min-h-0">
            <StepList
              steps={steps}
              connections={connections}
              branchOwnership={branchOwnership}
              getStepLabel={getStepLabel}
              onDeleteStep={onDeleteStep}
              onReorderSteps={onReorderSteps}
              onUpdateStepDescription={onUpdateStepDescription}
              onUpdateStepDuration={onUpdateStepDuration}
              onUpdateStepPayload={onUpdateStepPayload}
              onUpdateStepPayloadDirection={onUpdateStepPayloadDirection}
              onUpdateStepIsAsync={onUpdateStepIsAsync}
              onUpdateConditionLabel={onUpdateConditionLabel}
              onAddBranchLabel={onAddBranchLabel}
              onRemoveBranchLabel={onRemoveBranchLabel}
              onUpdateBranchLabel={onUpdateBranchLabel}
              onOpenBranchSelect={onOpenBranchSelect}
              onConvertStepToCondition={onConvertStepToCondition}
              onAddConditionStep={onAddConditionStep}
            />
            {recordingSteps.length > 0 && <MermaidPreview mermaid={mermaidPreview} />}
          </div>
        )}
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
