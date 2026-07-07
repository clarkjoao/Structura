import { useCallback, type Dispatch } from "react";
import { useTranslation } from "react-i18next";
import type { RecordingFinalizeData } from "@/features/canvas";
import {
  buildFlowFromRecordingSnapshot,
  resolveSceneSnapshot,
  stepsToMermaid,
  useDiagramActions,
  useDiagramStore,
} from "@/features/diagram";
import { useWalkthroughActions } from "../store/selectors/walkthroughs.selectors";
import type { WalkthroughRecordingTarget } from "../types";
import type { WalkthroughBridgeAction } from "../components/WalkthroughPlayerContext";

export function useWalkthroughRecordingFinalize(
  recordingTarget: WalkthroughRecordingTarget | null,
  dispatch: Dispatch<WalkthroughBridgeAction>,
): (data: RecordingFinalizeData) => void {
  const { t } = useTranslation();
  const { addFlow, updateFlow } = useDiagramActions();
  const { updateWalkthroughStep } = useWalkthroughActions();

  return useCallback(
    (data: RecordingFinalizeData) => {
      const target = recordingTarget;
      const store = useDiagramStore.getState();
      const diagramId = target?.diagramId ?? store.activeDiagramId ?? null;
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

      let persistedFlowId: string | null = null;

      if (data.editingFlowId) {
        updateFlow(data.editingFlowId, {
          name: data.name || t("flows.unnamed"),
          mermaid,
          steps: stepsRecord,
          description,
          tags: flowTags,
          entryStepId,
        });
        persistedFlowId = data.editingFlowId;
      } else {
        const flow = addFlow(diagram.id, data.name || t("flows.unnamed"), mermaid, stepsRecord);
        persistedFlowId = flow ? flow.id : null;
        if (flow && (description || flowTags || entryStepId)) {
          updateFlow(flow.id, { description, tags: flowTags, entryStepId });
        }
      }

      if (target && persistedFlowId) {
        updateWalkthroughStep(target.walkthroughId, target.targetStepId, {
          flowId: persistedFlowId,
        });
      }

      if (target) {
        dispatch({ type: "EXIT" });
      }
    },
    [addFlow, dispatch, recordingTarget, t, updateFlow, updateWalkthroughStep],
  );
}
