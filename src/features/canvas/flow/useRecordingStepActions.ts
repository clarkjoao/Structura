import { useCallback } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { generateId } from "@/features/diagram";
import type { FlowStep } from "@/features/diagram";
import type { FlowMode } from "./flowMode.types";
import type { BranchOwnerInfo, RecordingContext } from "./flowMode.types";
import { appendRecordedStep, getDisplayStepsFromRecording } from "./flowModeRecording.utils";

export interface UseRecordingStepActionsResult {
  setRecordingName: (name: string) => void;
  setRecordingDescription: (desc: string) => void;
  setRecordingContext: (action: SetStateAction<RecordingContext>) => void;
  onAddTag: (tag: string) => void;
  onRemoveTag: (index: number) => void;
  onRecordNodeClick: (nodeId: string) => void;
  onRecordEdgeClick: (edgeId: string, handleId?: string) => void;
  onRecordHandleClick: (nodeId: string, handleId: string) => void;
  onRecordUndo: () => void;
  onDeleteStep: (index: number) => void;
  onReorderSteps: (from: number, to: number) => void;
  onUpdateStepDescription: (index: number, description: string) => void;
  onUpdateStepDuration: (index: number, duration: string) => void;
  onUpdateStepPayload: (index: number, payload: string) => void;
  onUpdateStepPayloadDirection: (index: number, direction: "request" | "response") => void;
  onUpdateStepIsAsync: (index: number, isAsync: boolean) => void;
}

export function useRecordingStepActions(
  mode: FlowMode,
  setMode: Dispatch<SetStateAction<FlowMode>>,
  branchOwnershipRef: MutableRefObject<Map<string, BranchOwnerInfo>>,
): UseRecordingStepActionsResult {
  const onRecordNodeClick = useCallback(
    (nodeId: string) => {
      setMode((prev: FlowMode) => {
        if (prev.kind !== "recording" || prev.context.mode === "branch-select") return prev;
        const step: FlowStep = { id: generateId("step"), type: "action", componentId: nodeId };
        return appendRecordedStep(prev, step, branchOwnershipRef);
      });
    },
    [branchOwnershipRef, setMode],
  );

  const onRecordEdgeClick = useCallback(
    (edgeId: string, handleId?: string) => {
      setMode((prev) => {
        if (prev.kind !== "recording" || prev.context.mode === "branch-select") return prev;
        const step: FlowStep = {
          id: generateId("step"),
          type: "action",
          connectionId: edgeId,
          handleId,
        };
        return appendRecordedStep(prev, step, branchOwnershipRef);
      });
    },
    [branchOwnershipRef, setMode],
  );

  const onRecordHandleClick = useCallback(
    (nodeId: string, handleId: string) => {
      setMode((prev) => {
        if (prev.kind !== "recording" || prev.context.mode === "branch-select") return prev;
        const step: FlowStep = {
          id: generateId("step"),
          type: "action",
          componentId: nodeId,
          handleId,
        };
        return appendRecordedStep(prev, step, branchOwnershipRef);
      });
    },
    [branchOwnershipRef, setMode],
  );

  const onRecordUndo = useCallback(() => {
    setMode((prev) => {
      if (prev.kind !== "recording" || prev.steps.length === 0) return prev;
      const last = prev.steps[prev.steps.length - 1];
      let nextOwnership = prev.branchOwnership;
      if (nextOwnership.has(last.id)) {
        nextOwnership = new Map(nextOwnership);
        nextOwnership.delete(last.id);
      }
      branchOwnershipRef.current = nextOwnership;
      return { ...prev, steps: prev.steps.slice(0, -1), branchOwnership: nextOwnership };
    });
  }, [branchOwnershipRef, setMode]);

  const setRecordingName = useCallback(
    (name: string) => {
      setMode((prev) => (prev.kind !== "recording" ? prev : { ...prev, name }));
    },
    [setMode],
  );

  const setRecordingDescription = useCallback(
    (desc: string) => {
      setMode((prev) => (prev.kind !== "recording" ? prev : { ...prev, description: desc }));
    },
    [setMode],
  );

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

  const onAddTag = useCallback(
    (tag: string) => {
      setMode((prev) => {
        if (prev.kind !== "recording") return prev;
        if (prev.tags.includes(tag)) return prev;
        return { ...prev, tags: [...prev.tags, tag] };
      });
    },
    [setMode],
  );

  const onRemoveTag = useCallback(
    (index: number) => {
      setMode((prev) => {
        if (prev.kind !== "recording") return prev;
        return { ...prev, tags: prev.tags.filter((_, i) => i !== index) };
      });
    },
    [setMode],
  );

  const onUpdateStepDescription = useCallback(
    (index: number, description: string) => {
      setMode((prev) => {
        if (prev.kind !== "recording") return prev;
        const panel = getDisplayStepsFromRecording(prev.steps, prev.context, prev.branchOwnership);
        const step = panel[index];
        if (!step) return prev;
        return {
          ...prev,
          steps: prev.steps.map((flowStep) =>
            flowStep.id === step.id ? { ...flowStep, description } : flowStep,
          ),
        };
      });
    },
    [setMode],
  );

  const onUpdateStepDuration = useCallback(
    (index: number, duration: string) => {
      setMode((prev) => {
        if (prev.kind !== "recording") return prev;
        const panel = getDisplayStepsFromRecording(prev.steps, prev.context, prev.branchOwnership);
        const step = panel[index];
        if (!step) return prev;
        return {
          ...prev,
          steps: prev.steps.map((flowStep) =>
            flowStep.id === step.id ? { ...flowStep, duration: duration || undefined } : flowStep,
          ),
        };
      });
    },
    [setMode],
  );

  const onUpdateStepPayload = useCallback(
    (index: number, payload: string) => {
      setMode((prev) => {
        if (prev.kind !== "recording") return prev;
        const panel = getDisplayStepsFromRecording(prev.steps, prev.context, prev.branchOwnership);
        const step = panel[index];
        if (!step) return prev;
        return {
          ...prev,
          steps: prev.steps.map((flowStep) =>
            flowStep.id === step.id ? { ...flowStep, payload: payload || undefined } : flowStep,
          ),
        };
      });
    },
    [setMode],
  );

  const onUpdateStepPayloadDirection = useCallback(
    (index: number, direction: "request" | "response") => {
      setMode((prev) => {
        if (prev.kind !== "recording") return prev;
        const panel = getDisplayStepsFromRecording(prev.steps, prev.context, prev.branchOwnership);
        const step = panel[index];
        if (!step) return prev;
        return {
          ...prev,
          steps: prev.steps.map((flowStep) =>
            flowStep.id === step.id ? { ...flowStep, payloadDirection: direction } : flowStep,
          ),
        };
      });
    },
    [setMode],
  );

  const onUpdateStepIsAsync = useCallback(
    (index: number, isAsync: boolean) => {
      setMode((prev) => {
        if (prev.kind !== "recording") return prev;
        const panel = getDisplayStepsFromRecording(prev.steps, prev.context, prev.branchOwnership);
        const step = panel[index];
        if (!step) return prev;
        return {
          ...prev,
          steps: prev.steps.map((flowStep) =>
            flowStep.id === step.id ? { ...flowStep, isAsync } : flowStep,
          ),
        };
      });
    },
    [setMode],
  );

  const onDeleteStep = useCallback(
    (index: number) => {
      setMode((prev) => {
        if (prev.kind !== "recording") return prev;
        const panel = getDisplayStepsFromRecording(prev.steps, prev.context, prev.branchOwnership);
        const step = panel[index];
        if (!step) return prev;
        let nextOwnership = prev.branchOwnership;
        if (nextOwnership.has(step.id)) {
          nextOwnership = new Map(nextOwnership);
          nextOwnership.delete(step.id);
        }
        branchOwnershipRef.current = nextOwnership;
        return {
          ...prev,
          steps: prev.steps.filter((flowStep) => flowStep.id !== step.id),
          branchOwnership: nextOwnership,
        };
      });
    },
    [branchOwnershipRef, setMode],
  );

  const onReorderSteps = useCallback(
    (from: number, to: number) => {
      setMode((prev) => {
        if (prev.kind !== "recording") return prev;
        const panel = getDisplayStepsFromRecording(prev.steps, prev.context, prev.branchOwnership);
        const idFrom = panel[from]?.id;
        const idTo = panel[to]?.id;
        if (!idFrom || !idTo || idFrom === idTo) return prev;
        const fullFrom = prev.steps.findIndex((flowStep) => flowStep.id === idFrom);
        const fullTo = prev.steps.findIndex((flowStep) => flowStep.id === idTo);
        if (fullFrom < 0 || fullTo < 0) return prev;
        const n = [...prev.steps];
        const [moved] = n.splice(fullFrom, 1);
        const insertAt = n.findIndex((flowStep) => flowStep.id === idTo);
        if (insertAt < 0) return prev;
        n.splice(insertAt, 0, moved);
        return { ...prev, steps: n };
      });
    },
    [setMode],
  );

  return {
    setRecordingName,
    setRecordingDescription,
    setRecordingContext,
    onAddTag,
    onRemoveTag,
    onRecordNodeClick,
    onRecordEdgeClick,
    onRecordHandleClick,
    onRecordUndo,
    onDeleteStep,
    onReorderSteps,
    onUpdateStepDescription,
    onUpdateStepDuration,
    onUpdateStepPayload,
    onUpdateStepPayloadDirection,
    onUpdateStepIsAsync,
  };
}
