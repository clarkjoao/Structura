import { useCallback, useMemo } from "react";
import type { Dispatch, RefObject, SetStateAction } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { heldBackMessage, refusalMessage } from "./flowRefusalMessage";
import type { Flow, FlowStoreResult, RecordedStepContent } from "@/features/diagram";
import { useActiveDiagramId, useDiagramActions, useDiagramStore } from "@/features/diagram";
import type { FlowMode, RecordingContext } from "./flowMode.types";
import { recordingCursor } from "./flowMode.types";
import { useFlowViewStore } from "./useFlowViewStore";
import { useCanvasSelectionStore } from "../hooks/useCanvasSelectionStore";

export interface FlowRecordingSlice {
  recordingFlowId: string | null;
  recordingContext: RecordingContext;
  setRecordingContext: Dispatch<SetStateAction<RecordingContext>>;
  startRecording: () => void;
  editFlow: (flow: Flow) => void;
  cancelRecording: () => void;
  finalizeRecording: () => void;
  onRecordNodeClick: (nodeId: string) => void;
  onRecordEdgeClick: (edgeId: string, handleId?: string) => void;
  onRecordHandleClick: (nodeId: string, handleId: string) => void;
  onRecordUndo: () => void;
}

const TRUNK: RecordingContext = { mode: "trunk" };

/**
 * The recorder's half of flow mode. It owns where the next step goes and
 * nothing else: every click is written straight into the store, so the flow on
 * screen and the flow on disk are the same flow from the first step on.
 */

/**
 * Clears what the recording left selected on the canvas.
 *
 * Every click that records a step also selects the node it landed on, and that
 * selection outlived the recording: the canvas kept dimming everything else,
 * because "dim all but the selection" is a live rule and the selection was
 * still there. Nothing on screen said why, and only a reload cleared it — the
 * selection is not persisted, which is exactly why undo never helped.
 *
 * The selection belongs to the recording, so it ends with it.
 */
function clearRecordingSelection(): void {
  useCanvasSelectionStore.getState().clearSelection();
}

export function useFlowRecording(
  mode: FlowMode,
  setMode: Dispatch<SetStateAction<FlowMode>>,
  onStartRecordingRef: RefObject<(() => void) | undefined>,
): FlowRecordingSlice {
  const { t } = useTranslation();
  const activeDiagramId = useActiveDiagramId();
  const {
    addFlow,
    updateFlow,
    beginFlowSession,
    commitFlowSession,
    cancelFlowSession,
    recordFlowStep,
    undoLastRecordedStep,
  } = useDiagramActions();

  const openScript = useFlowViewStore((state) => state.openScript);
  const recording = mode.kind === "recording" ? mode : null;
  const recordingFlowId = recording?.flowId ?? null;
  const recordingContext = recording?.context ?? TRUNK;

  const setRecordingContext = useCallback(
    (action: SetStateAction<RecordingContext>) => {
      setMode((prev) => {
        if (prev.kind !== "recording") return prev;
        const next = typeof action === "function" ? action(prev.context) : action;
        return { ...prev, context: next };
      });
    },
    [setMode],
  );

  /** A refused write is said out loud; the recorder never drops a click in silence. */
  const announce = useCallback(
    (result: FlowStoreResult) => {
      if (!result.ok) {
        toast.warning(refusalMessage(t, result.code));
        return;
      }
      for (const held of result.blocked) {
        toast.warning(heldBackMessage(t, held.code));
      }
    },
    [t],
  );

  const write = useCallback(
    (content: RecordedStepContent) => {
      if (!recording) return;
      const cursor = recordingCursor(recording.context);
      if (!cursor) return;
      announce(recordFlowStep(recording.flowId, content, cursor));
    },
    [announce, recordFlowStep, recording],
  );

  const startRecording = useCallback(() => {
    if (!activeDiagramId) return;
    if (mode.kind !== "idle") return;
    onStartRecordingRef.current?.();
    beginFlowSession();
    const flow = addFlow(activeDiagramId, "", "");
    if (!flow) {
      cancelFlowSession();
      return;
    }
    openScript(flow.id);
    setMode({ kind: "recording", flowId: flow.id, context: TRUNK, isNewFlow: true });
  }, [
    activeDiagramId,
    addFlow,
    beginFlowSession,
    cancelFlowSession,
    mode.kind,
    onStartRecordingRef,
    openScript,
    setMode,
  ]);

  const editFlow = useCallback(
    (flow: Flow) => {
      onStartRecordingRef.current?.();
      beginFlowSession();
      openScript(flow.id);
      setMode({ kind: "recording", flowId: flow.id, context: TRUNK, isNewFlow: false });
    },
    [beginFlowSession, onStartRecordingRef, openScript, setMode],
  );

  const cancelRecording = useCallback(() => {
    if (!recording) return;
    cancelFlowSession();
    openScript(null);
    clearRecordingSelection();
    setMode({ kind: "idle" });
  }, [cancelFlowSession, openScript, recording, setMode]);

  const finalizeRecording = useCallback(() => {
    if (!recording) return;
    const store = useDiagramStore.getState();
    const diagramId = store.activeDiagramId;
    const flow = diagramId
      ? store.diagrams[diagramId]?.snapshot.flows[recording.flowId]
      : undefined;
    if (flow && !flow.name.trim()) updateFlow(recording.flowId, { name: t("flows.unnamed") });
    commitFlowSession();
    clearRecordingSelection();
    setMode({ kind: "idle" });
  }, [commitFlowSession, recording, setMode, t, updateFlow]);

  const onRecordNodeClick = useCallback(
    (nodeId: string) => write({ componentId: nodeId }),
    [write],
  );

  const onRecordEdgeClick = useCallback(
    (edgeId: string, handleId?: string) => write({ connectionId: edgeId, handleId }),
    [write],
  );

  const onRecordHandleClick = useCallback(
    (nodeId: string, handleId: string) => write({ componentId: nodeId, handleId }),
    [write],
  );

  const onRecordUndo = useCallback(() => {
    if (!recording) return;
    const cursor = recordingCursor(recording.context);
    if (!cursor) return;
    announce(undoLastRecordedStep(recording.flowId, cursor));
  }, [announce, recording, undoLastRecordedStep]);

  return useMemo(
    () => ({
      recordingFlowId,
      recordingContext,
      setRecordingContext,
      startRecording,
      editFlow,
      cancelRecording,
      finalizeRecording,
      onRecordNodeClick,
      onRecordEdgeClick,
      onRecordHandleClick,
      onRecordUndo,
    }),
    [
      cancelRecording,
      editFlow,
      finalizeRecording,
      onRecordEdgeClick,
      onRecordHandleClick,
      onRecordNodeClick,
      onRecordUndo,
      recordingContext,
      recordingFlowId,
      setRecordingContext,
      startRecording,
    ],
  );
}
