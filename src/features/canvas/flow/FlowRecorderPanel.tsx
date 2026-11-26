import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Copy, Route } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { PanelColumn } from "../panels/ElementPanel/shell/PanelFrame";
import { PanelHeader, type PanelMenuItem } from "../panels/ElementPanel/shell/PanelHeader";
import { PanelSection } from "../panels/ElementPanel/shell/PanelSection";
import { RecorderMetadataForm } from "./recorder/RecorderMetadataForm";
import { MermaidPreview } from "./recorder/MermaidPreview";
import { FlowScriptPanel } from "./script/FlowScriptPanel";
import { FlowStepPanel } from "./script/FlowStepPanel";
import { selectStepOnCanvas } from "./script/selectStepOnCanvas";
import { suggestFlowName } from "./suggestFlowName";
import { useFlowScriptActions } from "./useFlowScriptActions";
import { useFlowViewStore } from "./useFlowViewStore";

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
  const scriptActions = useFlowScriptActions(flowId);
  const selectStep = useFlowViewStore((state) => state.selectStep);

  /** The step drilled into, in place of the script; null shows the flow. */
  const [openStepId, setOpenStepId] = useState<string | null>(null);
  useEffect(() => setOpenStepId(null), [flowId]);
  const openStep = useCallback(
    (stepId: string) => {
      selectStep(stepId);
      selectStepOnCanvas(flow?.steps[stepId]);
      setOpenStepId(stepId);
    },
    [flow, selectStep],
  );

  // A new recording opens on its name: it is the one field a flow needs.
  const nameRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const focusName = recordingContext.mode === "trunk" && !isEditing;
  useEffect(() => {
    if (focusName) nameRef.current?.focus();
    // Only on open: re-focusing on every context change would steal the caret.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  /** What the flow would be called if nobody names it: first participant → last. */
  const suggestedName = useMemo(
    () => (flow ? suggestFlowName(flow, (id) => components[id]?.name, connections) : null),
    [flow, components, connections],
  );

  const mermaidPreview = useMemo(
    () => (flow ? stepsToMermaid(flow, components, connections) : ""),
    [flow, components, connections],
  );

  const handleFinalize = useCallback(() => {
    if (!flow) return;
    // Unnamed, finishing takes the suggested name (see `finalizeRecording`); only a flow with
    // nothing to suggest a name from is worth a warning.
    if (!flow.name.trim() && !suggestedName) toast.warning(t("flowRecorder.emptyNameWarning"));
    if (Object.keys(flow.steps).length === 0) toast.warning(t("flowRecorder.noStepsWarning"));
    onFinalize();
  }, [flow, onFinalize, suggestedName, t]);

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

  const stepCount = Object.keys(flow.steps).length;
  const menu: PanelMenuItem[] = [
    {
      key: "copy-mermaid",
      label: t("flowRecorder.copyMermaidTitle"),
      icon: Copy,
      onSelect: () => {
        void navigator.clipboard?.writeText(mermaidPreview);
        toast.success(t("flows.copiedMermaid"));
      },
    },
  ];

  const footer = (
    <div className="flex shrink-0 gap-2 border-t border-border px-4 py-3">
      <Button size="sm" onClick={handleFinalize} className="h-8 flex-1">
        {t("flowRecorder.finalize")}
      </Button>
      <Button size="sm" variant="outline" onClick={onCancel} className="h-8">
        {t("flowRecorder.cancel")}
      </Button>
    </div>
  );

  if (openStepId && flow.steps[openStepId]) {
    return (
      <PanelColumn testId="flow-recorder-panel">
        <FlowStepPanel
          key={openStepId}
          flow={flow}
          stepId={openStepId}
          actions={scriptActions}
          onBack={() => setOpenStepId(null)}
          onOpenStep={openStep}
        />
        {footer}
      </PanelColumn>
    );
  }

  return (
    <PanelColumn testId="flow-recorder-panel">
      <PanelHeader
        icon={<Route className="h-3.5 w-3.5" />}
        typeLabel={t("flows.panelTitle")}
        name={flow.name}
        namePlaceholder={suggestedName ?? t("flowRecorder.namePlaceholder")}
        onCommitName={(name) => updateFlow(flow.id, { name })}
        nameInputRef={nameRef}
        menu={menu}
        onClose={onCancel}
      />
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <RecorderMetadataForm
          description={flow.description ?? ""}
          onDescriptionChange={(description) => updateFlow(flow.id, { description })}
          tags={flow.tags ?? []}
          onAddTag={onAddTag}
          onRemoveTag={onRemoveTag}
          participants={participants}
          defaultDetailsOpen={!isEditing}
        />
        <PanelSection
          title={t("flowRecorder.stepsSection")}
          summary={t("flowPanel.stepsCount", { count: stepCount })}
        >
          <FlowScriptPanel
            flow={flow}
            recording={{ target: recordingContext, onTarget: setRecordingContext }}
            onOpenStep={setOpenStepId}
          />
        </PanelSection>
        {stepCount > 0 && (
          <PanelSection title={t("flowRecorder.mermaid")} defaultOpen={false}>
            <MermaidPreview mermaid={mermaidPreview} />
          </PanelSection>
        )}
      </div>
      {footer}
    </PanelColumn>
  );
};

export default FlowRecorderPanel;
