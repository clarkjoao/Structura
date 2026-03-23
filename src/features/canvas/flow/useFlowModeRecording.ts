import { useCallback, useMemo } from "react";
import type { Dispatch, MutableRefObject, RefObject, SetStateAction } from "react";
import type { Flow, FlowStep } from "@/features/diagram";
import { generateId } from "@/features/diagram";
import type {
  BranchOwnerInfo,
  FlowMode,
  FlowModeState,
  RecordingContext,
  RecordingFinalizeData,
} from "./flowMode.types";

export type FlowModeRecordingSlice = Pick<
  FlowModeState,
  | "startRecording"
  | "cancelRecording"
  | "finalizeRecording"
  | "editFlow"
  | "setRecordingName"
  | "setRecordingDescription"
  | "onAddTag"
  | "onRemoveTag"
  | "setRecordingContext"
  | "onRecordNodeClick"
  | "onRecordEdgeClick"
  | "onRecordHandleClick"
  | "onRecordUndo"
  | "onDeleteStep"
  | "onReorderSteps"
  | "onUpdateStepDescription"
  | "onUpdateStepDuration"
  | "onUpdateStepPayload"
  | "onUpdateStepPayloadDirection"
  | "onUpdateStepIsAsync"
  | "onConvertStepToCondition"
  | "onUpdateConditionLabel"
  | "onAddBranchLabel"
  | "onRemoveBranchLabel"
  | "onUpdateBranchLabel"
  | "onAddConditionStep"
  | "onEnterBranchRecording"
  | "onOpenBranchSelect"
>;

export function getDisplayStepsFromRecording(
  steps: FlowStep[],
  recordingContext: RecordingContext,
  ownership: Map<string, BranchOwnerInfo>,
): FlowStep[] {
  if (recordingContext.mode !== "branch-record") return steps;
  const { conditionStepId, branchIndex } = recordingContext;
  return steps.filter((step) => {
    const owner = ownership.get(step.id);
    return owner && owner.conditionStepId === conditionStepId && owner.branchIndex === branchIndex;
  });
}

function findLastBranchStepIndex(
  steps: FlowStep[],
  conditionStepId: string,
  branchIndex: number,
  ownership: Map<string, BranchOwnerInfo>,
): number {
  let lastIdx = steps.findIndex((step) => step.id === conditionStepId);
  for (let i = lastIdx + 1; i < steps.length; i++) {
    const info = ownership.get(steps[i].id);
    if (info && info.conditionStepId === conditionStepId && info.branchIndex === branchIndex) {
      lastIdx = i;
    }
  }
  return lastIdx;
}

export function useFlowModeRecording(
  _mode: FlowMode,
  setMode: Dispatch<SetStateAction<FlowMode>>,
  branchOwnershipRef: MutableRefObject<Map<string, BranchOwnerInfo>>,
  onFinalizeRef: RefObject<(data: RecordingFinalizeData) => void>,
  onStartRecordingRef: RefObject<(() => void) | undefined>,
): FlowModeRecordingSlice {
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
      onFinalizeRef.current({
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
      const stepValues = Object.values(flow.steps);
      const ordered: FlowStep[] = [];
      const visited = new Set<string>();
      const ownership = new Map<string, BranchOwnerInfo>();

      function visit(stepId: string | undefined, branchInfo?: BranchOwnerInfo) {
        if (!stepId || visited.has(stepId)) return;
        visited.add(stepId);
        const flowStep = flow.steps[stepId];
        if (!flowStep) return;
        ordered.push({ ...flowStep });
        if (branchInfo) {
          ownership.set(flowStep.id, branchInfo);
        }
        if (flowStep.branches) {
          for (let branchIdx = 0; branchIdx < flowStep.branches.length; branchIdx++) {
            visit(flowStep.branches[branchIdx].nextId, {
              conditionStepId: flowStep.id,
              branchIndex: branchIdx,
            });
          }
        }
        if (flowStep.next) visit(flowStep.next, branchInfo);
      }
      visit(flow.entryStepId);
      for (const flowStep of stepValues) {
        if (!visited.has(flowStep.id)) ordered.push({ ...flowStep });
      }

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

  const onRecordNodeClick = useCallback(
    (nodeId: string) => {
      setMode((prev) => {
        if (prev.kind !== "recording" || prev.context.mode === "branch-select") return prev;
        const step: FlowStep = { id: generateId("step"), type: "action", componentId: nodeId };
        if (prev.context.mode !== "branch-record") {
          return { ...prev, steps: [...prev.steps, step] };
        }
        const { conditionStepId, branchIndex } = prev.context;
        const insertAfterIdx = findLastBranchStepIndex(
          prev.steps,
          conditionStepId,
          branchIndex,
          prev.branchOwnership,
        );
        const newArr = [...prev.steps];
        newArr.splice(insertAfterIdx + 1, 0, step);
        const nextOwnership = new Map(prev.branchOwnership);
        nextOwnership.set(step.id, { conditionStepId, branchIndex });
        branchOwnershipRef.current = nextOwnership;
        return { ...prev, steps: newArr, branchOwnership: nextOwnership };
      });
    },
    [branchOwnershipRef, setMode],
  );

  const onRecordEdgeClick = useCallback(
    (edgeId: string, handleId?: string) => {
      setMode((prev) => {
        if (prev.kind !== "recording" || prev.context.mode === "branch-select") return prev;
        const step: FlowStep = { id: generateId("step"), type: "action", connectionId: edgeId, handleId };
        if (prev.context.mode !== "branch-record") {
          return { ...prev, steps: [...prev.steps, step] };
        }
        const { conditionStepId, branchIndex } = prev.context;
        const insertAfterIdx = findLastBranchStepIndex(
          prev.steps,
          conditionStepId,
          branchIndex,
          prev.branchOwnership,
        );
        const newArr = [...prev.steps];
        newArr.splice(insertAfterIdx + 1, 0, step);
        const nextOwnership = new Map(prev.branchOwnership);
        nextOwnership.set(step.id, { conditionStepId, branchIndex });
        branchOwnershipRef.current = nextOwnership;
        return { ...prev, steps: newArr, branchOwnership: nextOwnership };
      });
    },
    [branchOwnershipRef, setMode],
  );

  const onRecordHandleClick = useCallback(
    (nodeId: string, handleId: string) => {
      setMode((prev) => {
        if (prev.kind !== "recording" || prev.context.mode === "branch-select") return prev;
        const step: FlowStep = { id: generateId("step"), type: "action", componentId: nodeId, handleId };
        if (prev.context.mode !== "branch-record") {
          return { ...prev, steps: [...prev.steps, step] };
        }
        const { conditionStepId, branchIndex } = prev.context;
        const insertAfterIdx = findLastBranchStepIndex(
          prev.steps,
          conditionStepId,
          branchIndex,
          prev.branchOwnership,
        );
        const newArr = [...prev.steps];
        newArr.splice(insertAfterIdx + 1, 0, step);
        const nextOwnership = new Map(prev.branchOwnership);
        nextOwnership.set(step.id, { conditionStepId, branchIndex });
        branchOwnershipRef.current = nextOwnership;
        return { ...prev, steps: newArr, branchOwnership: nextOwnership };
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

  const onConvertStepToCondition = useCallback(
    (index: number, conditionLabel: string, branchLabels: string[]) => {
      setMode((prev) => {
        if (prev.kind !== "recording") return prev;
        const panel = getDisplayStepsFromRecording(prev.steps, prev.context, prev.branchOwnership);
        const target = panel[index];
        if (!target) return prev;
        return {
          ...prev,
          steps: prev.steps.map((flowStep) => {
            if (flowStep.id !== target.id) return flowStep;
            const branches = branchLabels.map((label) => ({
              label,
              nextId: generateId("step"),
            }));
            return {
              ...flowStep,
              type: "condition" as const,
              conditionLabel,
              branches,
              next: undefined,
            };
          }),
          context: { mode: "branch-select", conditionStepId: target.id },
        };
      });
    },
    [setMode],
  );

  const onUpdateConditionLabel = useCallback(
    (index: number, label: string) => {
      setMode((prev) => {
        if (prev.kind !== "recording") return prev;
        const panel = getDisplayStepsFromRecording(prev.steps, prev.context, prev.branchOwnership);
        const target = panel[index];
        if (!target) return prev;
        return {
          ...prev,
          steps: prev.steps.map((flowStep) =>
            flowStep.id === target.id ? { ...flowStep, conditionLabel: label } : flowStep,
          ),
        };
      });
    },
    [setMode],
  );

  const onAddBranchLabel = useCallback(
    (conditionStepId: string, label: string) => {
      setMode((prev) => {
        if (prev.kind !== "recording") return prev;
        const condStep = prev.steps.find((flowStep) => flowStep.id === conditionStepId);
        if (!condStep || condStep.type !== "condition") return prev;
        return {
          ...prev,
          steps: prev.steps.map((flowStep) => {
            if (flowStep.id !== condStep.id) return flowStep;
            return {
              ...flowStep,
              branches: [...(flowStep.branches ?? []), { label, nextId: generateId("step") }],
            };
          }),
        };
      });
    },
    [setMode],
  );

  const onRemoveBranchLabel = useCallback(
    (conditionStepId: string, branchIndex: number) => {
      setMode((prev) => {
        if (prev.kind !== "recording") return prev;
        const condStep = prev.steps.find((flowStep) => flowStep.id === conditionStepId);
        if (!condStep?.branches || condStep.branches.length <= 2) return prev;
        const ownership = prev.branchOwnership;
        const nextSteps = prev
          .steps.filter((flowStep) => {
            const branchOwner = ownership.get(flowStep.id);
            if (
              branchOwner &&
              branchOwner.conditionStepId === condStep.id &&
              branchOwner.branchIndex === branchIndex
            ) {
              return false;
            }
            return true;
          })
          .map((flowStep) => {
            if (flowStep.id !== condStep.id) return flowStep;
            return {
              ...flowStep,
              branches: flowStep.branches!.filter((_, bi) => bi !== branchIndex),
            };
          });
        const nextOwnership = new Map<string, BranchOwnerInfo>();
        for (const [stepId, info] of prev.branchOwnership) {
          if (info.conditionStepId !== conditionStepId) {
            nextOwnership.set(stepId, info);
          } else if (info.branchIndex < branchIndex) {
            nextOwnership.set(stepId, info);
          } else if (info.branchIndex > branchIndex) {
            nextOwnership.set(stepId, { ...info, branchIndex: info.branchIndex - 1 });
          }
        }
        branchOwnershipRef.current = nextOwnership;
        return { ...prev, steps: nextSteps, branchOwnership: nextOwnership };
      });
    },
    [branchOwnershipRef, setMode],
  );

  const onUpdateBranchLabel = useCallback(
    (conditionStepId: string, branchIndex: number, label: string) => {
      setMode((prev) => {
        if (prev.kind !== "recording") return prev;
        const condStep = prev.steps.find((flowStep) => flowStep.id === conditionStepId);
        if (!condStep?.branches) return prev;
        return {
          ...prev,
          steps: prev.steps.map((flowStep) => {
            if (flowStep.id !== condStep.id) return flowStep;
            return {
              ...flowStep,
              branches: flowStep.branches!.map((branch, bi) =>
                bi === branchIndex ? { ...branch, label } : branch,
              ),
            };
          }),
        };
      });
    },
    [setMode],
  );

  const onAddConditionStep = useCallback(
    (conditionLabel: string, branchLabels: string[]) => {
      const id = generateId("step");
      const branches = branchLabels.map((label) => ({
        label,
        nextId: generateId("step"),
      }));
      const newStep: FlowStep = { id, type: "condition", conditionLabel, branches };

      setMode((prev) => {
        if (prev.kind !== "recording") return prev;
        let nextSteps: FlowStep[];
        let nextOwnership = prev.branchOwnership;
        if (prev.context.mode !== "branch-record") {
          nextSteps = [...prev.steps, newStep];
        } else {
          const { conditionStepId, branchIndex } = prev.context;
          const insertAfterIdx = findLastBranchStepIndex(
            prev.steps,
            conditionStepId,
            branchIndex,
            prev.branchOwnership,
          );
          const newArr = [...prev.steps];
          newArr.splice(insertAfterIdx + 1, 0, newStep);
          nextSteps = newArr;
          nextOwnership = new Map(prev.branchOwnership);
          nextOwnership.set(id, { conditionStepId, branchIndex });
        }
        branchOwnershipRef.current = nextOwnership;
        return {
          ...prev,
          steps: nextSteps,
          branchOwnership: nextOwnership,
          context: { mode: "branch-select", conditionStepId: id },
        };
      });
    },
    [branchOwnershipRef, setMode],
  );

  const onEnterBranchRecording = useCallback(
    (conditionStepId: string, branchIndex: number) => {
      setMode((prev) => {
        if (prev.kind !== "recording") return prev;
        const condStep = prev.steps.find((flowStep) => flowStep.id === conditionStepId);
        if (!condStep || condStep.type !== "condition" || !condStep.branches?.[branchIndex]) return prev;
        return {
          ...prev,
          context: {
            mode: "branch-record",
            conditionStepId,
            branchIndex,
            branchLabel: condStep.branches[branchIndex].label,
          },
        };
      });
    },
    [setMode],
  );

  const onOpenBranchSelect = useCallback(
    (conditionStepId: string) => {
      setMode((prev) => {
        if (prev.kind !== "recording") return prev;
        return { ...prev, context: { mode: "branch-select", conditionStepId } };
      });
    },
    [setMode],
  );

  return useMemo(
    () => ({
      startRecording,
      cancelRecording,
      finalizeRecording,
      editFlow,
      setRecordingName,
      setRecordingDescription,
      onAddTag,
      onRemoveTag,
      setRecordingContext,
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
      onConvertStepToCondition,
      onUpdateConditionLabel,
      onAddBranchLabel,
      onRemoveBranchLabel,
      onUpdateBranchLabel,
      onAddConditionStep,
      onEnterBranchRecording,
      onOpenBranchSelect,
    }),
    [
      startRecording,
      cancelRecording,
      finalizeRecording,
      editFlow,
      setRecordingName,
      setRecordingDescription,
      onAddTag,
      onRemoveTag,
      setRecordingContext,
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
      onConvertStepToCondition,
      onUpdateConditionLabel,
      onAddBranchLabel,
      onRemoveBranchLabel,
      onUpdateBranchLabel,
      onAddConditionStep,
      onEnterBranchRecording,
      onOpenBranchSelect,
    ],
  );
}
