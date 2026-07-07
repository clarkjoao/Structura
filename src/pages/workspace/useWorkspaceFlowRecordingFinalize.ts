import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { RecordingFinalizeData } from "@/features/canvas";
import {
  buildFlowFromRecordingSnapshot,
  resolveSceneSnapshot,
  stepsToMermaid,
  useDiagramActions,
  useDiagramStore,
} from "@/features/diagram";

export function useWorkspaceFlowRecordingFinalize(): (data: RecordingFinalizeData) => void {
  const { t } = useTranslation();
  const { addFlow, updateFlow } = useDiagramActions();

  return useCallback(
    (data: RecordingFinalizeData) => {
      const store = useDiagramStore.getState();
      const diagramId = store.activeDiagramId ?? null;
      const diagram = diagramId ? store.diagrams[diagramId] : null;
      if (!diagram) return;

      const tempFlow = buildFlowFromRecordingSnapshot(data.steps, data.branchOwnership, {
        id: "temp",
        name: data.name,
        diagramId: diagram.id,
      });
      const stepsRecord = tempFlow.steps;
      const entryStepId = data.entryStepId ?? data.steps[0]?.id ?? tempFlow.entryStepId;
      const resolved = resolveSceneSnapshot(diagram, diagram.activeSceneId ?? null);
      const mermaid = stepsToMermaid(
        { ...tempFlow, entryStepId },
        resolved.components,
        resolved.connections,
      );
      const description = data.description || undefined;
      const flowTags = data.tags.length ? data.tags : undefined;

      if (data.editingFlowId) {
        updateFlow(data.editingFlowId, {
          name: data.name || t("flows.unnamed"),
          mermaid,
          steps: stepsRecord,
          description,
          tags: flowTags,
          entryStepId,
        });
      } else {
        const flow = addFlow(diagram.id, data.name || t("flows.unnamed"), mermaid, stepsRecord);
        if (flow && (description || flowTags || entryStepId)) {
          updateFlow(flow.id, { description, tags: flowTags, entryStepId });
        }
      }
    },
    [addFlow, t, updateFlow],
  );
}
