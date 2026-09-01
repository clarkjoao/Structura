import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  stepsToMermaid,
  useComponents,
  useConnections,
  useDiagramActions,
  useFlows,
} from "@/features/diagram";
import type { RecordingContext } from "./flowMode.types";
import { RecorderHeader } from "./recorder/RecorderHeader";
import { RecorderMetadataForm } from "./recorder/RecorderMetadataForm";
import { BranchRecordingStrip } from "./recorder/BranchRecordingStrip";
import { BranchSelectView } from "./recorder/BranchSelectView";
import { MermaidPreview } from "./recorder/MermaidPreview";
import { FlowScriptList } from "./script/FlowScriptList";

interface Props {
  flowId: string;
  recordingContext: RecordingContext;
  setRecordingContext: React.Dispatch<React.SetStateAction<RecordingContext>>;
  onCancel: () => void;
  onFinalize: () => void;
  isEditing?: boolean;
}

const FlowRecorderPanel = ({
  flowId,
  recordingContext,
  setRecordingContext,
  onCancel,
  onFinalize,
  isEditing,
}: Props) => {
  const { t } = useTranslation();
  const components = useComponents();
  const connections = useConnections();
  const flows = useFlows();
  const { updateFlow } = useDiagramActions();

  const flow = useMemo(() => flows.find((candidate) => candidate.id === flowId), [flows, flowId]);

  const participants = useMemo(() => {
    if (!flow) return [];
    return [
      ...new Set(
        Object.values(flow.steps)
          .map((step) => (step.componentId ? components[step.componentId]?.name : null))
          .filter(Boolean) as string[],
      ),
    ];
  }, [flow, components]);

  const mermaidPreview = useMemo(
    () => (flow ? stepsToMermaid(flow, components, connections) : ""),
    [flow, components, connections],
  );

  const handleFinalize = useCallback(() => {
    if (!flow) return;
    if (!flow.name.trim()) toast.warning(t("flowRecorder.emptyNameWarning"));
    if (Object.keys(flow.steps).length === 0) toast.warning(t("flowRecorder.noStepsWarning"));
    onFinalize();
  }, [flow, onFinalize, t]);

  const onAddTag = useCallback(
    (tag: string) => {
      if (!flow) return;
      const tags = flow.tags ?? [];
      if (tags.includes(tag)) return;
      updateFlow(flow.id, { tags: [...tags, tag] });
    },
    [flow, updateFlow],
  );

  const onRemoveTag = useCallback(
    (index: number) => {
      if (!flow) return;
      updateFlow(flow.id, { tags: (flow.tags ?? []).filter((_, i) => i !== index) });
    },
    [flow, updateFlow],
  );

  if (!flow) return null;

  const branchSelectCondition =
    recordingContext.mode === "branch-select"
      ? flow.steps[recordingContext.conditionStepId]
      : undefined;

  const showScript = recordingContext.mode === "trunk" || recordingContext.mode === "branch-record";

  return (
    <div className="flex h-full min-h-0 w-80 flex-col overflow-hidden border-l border-border bg-card">
      <RecorderHeader isEditing={isEditing} onCancel={onCancel} />
      <RecorderMetadataForm
        name={flow.name}
        onNameChange={(name) => updateFlow(flow.id, { name })}
        description={flow.description ?? ""}
        onDescriptionChange={(description) => updateFlow(flow.id, { description })}
        tags={flow.tags ?? []}
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
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {recordingContext.mode === "branch-select" && branchSelectCondition && (
          <BranchSelectView
            branchSelectCondition={branchSelectCondition}
            flow={flow}
            conditionStepId={recordingContext.conditionStepId}
            onEnterBranch={(conditionStepId, branchIndex) => {
              const branch = flow.steps[conditionStepId]?.branches?.[branchIndex];
              if (!branch) return;
              setRecordingContext({
                mode: "branch-record",
                conditionStepId,
                branchIndex,
                branchLabel: branch.label,
              });
            }}
            onContinueMainFlow={() => setRecordingContext({ mode: "trunk" })}
          />
        )}
        {showScript && (
          <div className="min-h-0 flex-1 space-y-3 p-3">
            <FlowScriptList
              flow={flow}
              onOpenBranchSelect={(conditionStepId) =>
                setRecordingContext({ mode: "branch-select", conditionStepId })
              }
            />
            {Object.keys(flow.steps).length > 0 && <MermaidPreview mermaid={mermaidPreview} />}
          </div>
        )}
      </div>
      <div className="flex shrink-0 gap-2 border-t border-border p-3">
        <button
          type="button"
          onClick={handleFinalize}
          className="flex-1 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {t("flowRecorder.finalize")}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-border px-3 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          {t("flowRecorder.cancel")}
        </button>
      </div>
    </div>
  );
};

export default FlowRecorderPanel;
