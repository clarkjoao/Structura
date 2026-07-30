import { useCallback } from "react";
import type { Dispatch, MutableRefObject, RefObject, SetStateAction } from "react";
import type { Flow } from "@/features/diagram";
import type { FlowMode, BranchOwnerInfo, RecordingFinalizeData } from "./flowMode.types";
import { buildOrderedSteps } from "./flowModeRecording.utils";

export interface UseRecordingLifecycleResult {
  startRecording: () => void;
  cancelRecording: () => void;
  finalizeRecording: () => void;
  editFlow: (flow: Flow) => void;
  onStartRecordingRef: RefObject<(() => void) | undefined>;
}

export function useRecordingLifecycle(
  mode: FlowMode,
  setMode: Dispatch<SetStateAction<FlowMode>>,
  branchOwnershipRef: MutableRefObject<Map<string, BranchOwnerInfo>>,
  onFinalizeRef: RefObject<(data: RecordingFinalizeData) => void>,
  onStartRecordingRef: RefObject<(() => void) | undefined>,
): UseRecordingLifecycleResult {
  const startRecording = useCallback(() => {
    onStartRecordingRef.current?.();
    setMode((prevMode) => {
      if (prevMode.kind !== "idle") return prevMode;
      return {
        kind: "recording",
        steps: [],
        context: { mode: "trunk" },
        name: "",
        description: "",
        tags: [],
        editingFlowId: null,
        branchOwnership: new Map(),
      };
    });
  }, [onStartRecordingRef, setMode]);

  const cancelRecording = useCallback(() => {
    setMode((prevMode) => {
      if (prevMode.kind !== "recording") return prevMode;
      branchOwnershipRef.current = new Map();
      return { kind: "idle" };
    });
  }, [branchOwnershipRef, setMode]);

  const finalizeRecording = useCallback(() => {
    setMode((prevMode) => {
      if (prevMode.kind !== "recording") return prevMode;
      onFinalizeRef.current?.({
        name: prevMode.name,
        description: prevMode.description,
        tags: prevMode.tags,
        steps: prevMode.steps,
        entryStepId: prevMode.steps[0]?.id,
        editingFlowId: prevMode.editingFlowId,
        branchOwnership: prevMode.branchOwnership,
      });
      branchOwnershipRef.current = new Map();
      return { kind: "idle" };
    });
  }, [branchOwnershipRef, onFinalizeRef, setMode]);

  const editFlow = useCallback(
    (flow: Flow) => {
      const { ordered, ownership } = buildOrderedSteps(flow);
      onStartRecordingRef.current?.();
      branchOwnershipRef.current = ownership;
      setMode({
        kind: "recording",
        steps: ordered,
        context: { mode: "trunk" },
        name: flow.name,
        description: flow.description ?? "",
        tags: [...(flow.tags ?? [])],
        editingFlowId: flow.id,
        branchOwnership: ownership,
      });
    },
    [branchOwnershipRef, onStartRecordingRef, setMode],
  );

  return {
    startRecording,
    cancelRecording,
    finalizeRecording,
    editFlow,
    onStartRecordingRef,
  };
}
