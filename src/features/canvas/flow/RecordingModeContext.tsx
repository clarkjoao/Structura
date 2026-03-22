import { createContext, useContext, useState, useCallback, useMemo } from "react";
import type { FlowStep, Flow } from "@/features/diagram";
import { generateId } from "@/features/diagram";

export interface BranchOwnerInfo {
  conditionStepId: string;
  branchIndex: number;
}

export type RecordingContext =
  | { mode: "trunk" }
  | { mode: "branch-select"; conditionStepId: string }
  | { mode: "branch-record"; conditionStepId: string; branchIndex: number; branchLabel: string };

export interface RecordingFinalizeData {
  name: string;
  description: string;
  tags: string[];
  steps: FlowStep[];
  entryStepId?: string;
  editingFlowId: string | null;
  branchOwnership: Map<string, BranchOwnerInfo>;
}

export interface RecordingModeState {
  isRecording: boolean;
  recordingSteps: FlowStep[];
  /** Steps shown in the recorder panel (full trunk list, or one branch path when recording a branch). */
  recordingStepsForPanel: FlowStep[];
  recordingContext: RecordingContext;
  setRecordingContext: React.Dispatch<React.SetStateAction<RecordingContext>>;
  recordingName: string;
  recordingDescription: string;
  recordingTags: string[];
  editingFlowId: string | null;
  branchOwnership: Map<string, BranchOwnerInfo>;
  setRecordingName: (name: string) => void;
  setRecordingDescription: (desc: string) => void;
  onAddTag: (tag: string) => void;
  onRemoveTag: (index: number) => void;
  onUpdateStepDescription: (index: number, description: string) => void;
  onUpdateStepDuration: (index: number, duration: string) => void;
  onUpdateStepPayload: (index: number, payload: string) => void;
  onUpdateStepPayloadDirection: (index: number, direction: "request" | "response") => void;
  onUpdateStepIsAsync: (index: number, isAsync: boolean) => void;
  onDeleteStep: (index: number) => void;
  onReorderSteps: (fromIndex: number, toIndex: number) => void;
  onRecordNodeClick?: (nodeId: string) => void;
  onRecordEdgeClick?: (edgeId: string, handleId?: string) => void;
  onRecordHandleClick?: (nodeId: string, handleId: string) => void;
  onRecordUndo?: () => void;
  startRecording: () => void;
  cancelRecording: () => void;
  finalizeRecording: () => void;
  editFlow: (flow: Flow) => void;
  onConvertStepToCondition: (index: number, conditionLabel: string, branchLabels: string[]) => void;
  onUpdateConditionLabel: (index: number, label: string) => void;
  onAddBranchLabel: (conditionStepId: string, label: string) => void;
  onRemoveBranchLabel: (conditionStepId: string, branchIndex: number) => void;
  onUpdateBranchLabel: (conditionStepId: string, branchIndex: number, label: string) => void;
  onAddConditionStep: (conditionLabel: string, branchLabels: string[]) => void;
  onEnterBranchRecording: (conditionStepId: string, branchIndex: number) => void;
  onOpenBranchSelect: (conditionStepId: string) => void;
}

const noop = () => {};
const defaultState: RecordingModeState = {
  isRecording: false,
  recordingSteps: [],
  recordingStepsForPanel: [],
  recordingContext: { mode: "trunk" },
  setRecordingContext: noop,
  recordingName: "",
  recordingDescription: "",
  recordingTags: [],
  editingFlowId: null,
  branchOwnership: new Map(),
  setRecordingName: noop,
  setRecordingDescription: noop,
  onAddTag: noop,
  onRemoveTag: noop,
  onUpdateStepDescription: noop,
  onUpdateStepDuration: noop,
  onUpdateStepPayload: noop,
  onUpdateStepPayloadDirection: noop,
  onUpdateStepIsAsync: noop,
  onDeleteStep: noop,
  onReorderSteps: noop,
  startRecording: noop,
  cancelRecording: noop,
  finalizeRecording: noop,
  editFlow: noop,
  onConvertStepToCondition: noop,
  onUpdateConditionLabel: noop,
  onAddBranchLabel: noop,
  onRemoveBranchLabel: noop,
  onUpdateBranchLabel: noop,
  onAddConditionStep: noop,
  onEnterBranchRecording: noop,
  onOpenBranchSelect: noop,
};

const RecordingModeContext = createContext<RecordingModeState>(defaultState);

export const RecordingModeProvider = RecordingModeContext.Provider;

export function useRecordingMode(): RecordingModeState {
  return useContext(RecordingModeContext);
}

interface RecordingModeStateProviderProps {
  children: React.ReactNode;
  onFinalize: (data: RecordingFinalizeData) => void;
  onStartRecording?: () => void;
}

export function getDisplayStepsFromRecording(
  steps: FlowStep[],
  recordingContext: RecordingContext,
  ownership: Map<string, BranchOwnerInfo>,
): FlowStep[] {
  if (recordingContext.mode !== "branch-record") return steps;
  const { conditionStepId, branchIndex } = recordingContext;
  return steps.filter((s) => {
    const o = ownership.get(s.id);
    return o && o.conditionStepId === conditionStepId && o.branchIndex === branchIndex;
  });
}

/** Find the index of the last step belonging to a given branch, or the condition step itself. */
function findLastBranchStepIndex(
  steps: FlowStep[],
  conditionStepId: string,
  branchIndex: number,
  ownership: Map<string, BranchOwnerInfo>,
): number {
  let lastIdx = steps.findIndex((s) => s.id === conditionStepId);
  for (let i = lastIdx + 1; i < steps.length; i++) {
    const info = ownership.get(steps[i].id);
    if (info && info.conditionStepId === conditionStepId && info.branchIndex === branchIndex) {
      lastIdx = i;
    }
  }
  return lastIdx;
}

export function RecordingModeStateProvider({
  children,
  onFinalize,
  onStartRecording,
}: RecordingModeStateProviderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSteps, setRecordingSteps] = useState<FlowStep[]>([]);
  const [recordingName, setRecordingNameState] = useState("");
  const [recordingDescription, setRecordingDescriptionState] = useState("");
  const [recordingTags, setRecordingTags] = useState<string[]>([]);
  const [editingFlowId, setEditingFlowId] = useState<string | null>(null);
  const [recordingContext, setRecordingContext] = useState<RecordingContext>({ mode: "trunk" });
  const [branchOwnership, setBranchOwnership] = useState<Map<string, BranchOwnerInfo>>(new Map());

  const recordingStepsForPanel = useMemo(
    () => getDisplayStepsFromRecording(recordingSteps, recordingContext, branchOwnership),
    [recordingSteps, recordingContext, branchOwnership],
  );

  const resetRecordingState = useCallback(() => {
    setIsRecording(false);
    setRecordingSteps([]);
    setRecordingNameState("");
    setRecordingDescriptionState("");
    setRecordingTags([]);
    setEditingFlowId(null);
    setRecordingContext({ mode: "trunk" });
    setBranchOwnership(new Map());
  }, []);

  const startRecording = useCallback(() => {
    onStartRecording?.();
    resetRecordingState();
    setIsRecording(true);
  }, [onStartRecording, resetRecordingState]);

  const cancelRecording = useCallback(() => {
    resetRecordingState();
  }, [resetRecordingState]);

  const finalizeRecording = useCallback(() => {
    onFinalize({
      name: recordingName,
      description: recordingDescription,
      tags: recordingTags,
      steps: recordingSteps,
      entryStepId: recordingSteps[0]?.id,
      editingFlowId,
      branchOwnership,
    });
    resetRecordingState();
  }, [
    recordingName,
    recordingDescription,
    recordingTags,
    recordingSteps,
    editingFlowId,
    branchOwnership,
    onFinalize,
    resetRecordingState,
  ]);

  const editFlow = useCallback(
    (flow: Flow) => {
      const stepValues = Object.values(flow.steps);
      const ordered: FlowStep[] = [];
      const visited = new Set<string>();
      const ownership = new Map<string, BranchOwnerInfo>();

      function visit(stepId: string | undefined, branchInfo?: BranchOwnerInfo) {
        if (!stepId || visited.has(stepId)) return;
        visited.add(stepId);
        const s = flow.steps[stepId];
        if (!s) return;
        ordered.push({ ...s });
        if (branchInfo) {
          ownership.set(s.id, branchInfo);
        }
        if (s.branches) {
          for (let bi = 0; bi < s.branches.length; bi++) {
            visit(s.branches[bi].nextId, { conditionStepId: s.id, branchIndex: bi });
          }
        }
        if (s.next) visit(s.next, branchInfo);
      }
      visit(flow.entryStepId);
      for (const s of stepValues) {
        if (!visited.has(s.id)) ordered.push({ ...s });
      }

      setRecordingNameState(flow.name);
      setRecordingDescriptionState(flow.description ?? "");
      setRecordingTags([...(flow.tags ?? [])]);
      setRecordingSteps(ordered);
      setBranchOwnership(ownership);
      setEditingFlowId(flow.id);
      setIsRecording(true);
      setRecordingContext({ mode: "trunk" });
      onStartRecording?.();
    },
    [onStartRecording],
  );

  const addRecordingStep = useCallback(
    (step: FlowStep) => {
      setRecordingSteps((prev) => {
        if (recordingContext.mode !== "branch-record") {
          return [...prev, step];
        }
        const { conditionStepId, branchIndex } = recordingContext;
        const insertAfterIdx = findLastBranchStepIndex(prev, conditionStepId, branchIndex, branchOwnership);
        const newArr = [...prev];
        newArr.splice(insertAfterIdx + 1, 0, step);
        return newArr;
      });
      if (recordingContext.mode === "branch-record") {
        const { conditionStepId, branchIndex } = recordingContext;
        setBranchOwnership((prev) => {
          const next = new Map(prev);
          next.set(step.id, { conditionStepId, branchIndex });
          return next;
        });
      }
    },
    [recordingContext, branchOwnership],
  );

  const onRecordNodeClick = useCallback(
    (nodeId: string) => {
      if (recordingContext.mode === "branch-select") return;
      addRecordingStep({ id: generateId("step"), type: "action", componentId: nodeId });
    },
    [addRecordingStep, recordingContext.mode],
  );

  const onRecordEdgeClick = useCallback(
    (edgeId: string, handleId?: string) => {
      if (recordingContext.mode === "branch-select") return;
      addRecordingStep({ id: generateId("step"), type: "action", connectionId: edgeId, handleId });
    },
    [addRecordingStep, recordingContext.mode],
  );

  const onRecordHandleClick = useCallback(
    (nodeId: string, handleId: string) => {
      if (recordingContext.mode === "branch-select") return;
      addRecordingStep({ id: generateId("step"), type: "action", componentId: nodeId, handleId });
    },
    [addRecordingStep, recordingContext.mode],
  );

  const onRecordUndo = useCallback(() => {
    setRecordingSteps((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setBranchOwnership((om) => {
        if (om.has(last.id)) {
          const next = new Map(om);
          next.delete(last.id);
          return next;
        }
        return om;
      });
      return prev.slice(0, -1);
    });
  }, []);

  const setRecordingName = useCallback((name: string) => setRecordingNameState(name), []);
  const setRecordingDescription = useCallback((desc: string) => setRecordingDescriptionState(desc), []);

  const onAddTag = useCallback((tag: string) => {
    setRecordingTags((prev) => (prev.includes(tag) ? prev : [...prev, tag]));
  }, []);
  const onRemoveTag = useCallback((index: number) => {
    setRecordingTags((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const onUpdateStepDescription = useCallback(
    (index: number, description: string) => {
      setRecordingSteps((prev) => {
        const panel = getDisplayStepsFromRecording(prev, recordingContext, branchOwnership);
        const step = panel[index];
        if (!step) return prev;
        return prev.map((s) => (s.id === step.id ? { ...s, description } : s));
      });
    },
    [recordingContext, branchOwnership],
  );
  const onUpdateStepDuration = useCallback(
    (index: number, duration: string) => {
      setRecordingSteps((prev) => {
        const panel = getDisplayStepsFromRecording(prev, recordingContext, branchOwnership);
        const step = panel[index];
        if (!step) return prev;
        return prev.map((s) => (s.id === step.id ? { ...s, duration: duration || undefined } : s));
      });
    },
    [recordingContext, branchOwnership],
  );
  const onUpdateStepPayload = useCallback(
    (index: number, payload: string) => {
      setRecordingSteps((prev) => {
        const panel = getDisplayStepsFromRecording(prev, recordingContext, branchOwnership);
        const step = panel[index];
        if (!step) return prev;
        return prev.map((s) => (s.id === step.id ? { ...s, payload: payload || undefined } : s));
      });
    },
    [recordingContext, branchOwnership],
  );
  const onUpdateStepPayloadDirection = useCallback(
    (index: number, direction: "request" | "response") => {
      setRecordingSteps((prev) => {
        const panel = getDisplayStepsFromRecording(prev, recordingContext, branchOwnership);
        const step = panel[index];
        if (!step) return prev;
        return prev.map((s) => (s.id === step.id ? { ...s, payloadDirection: direction } : s));
      });
    },
    [recordingContext, branchOwnership],
  );
  const onUpdateStepIsAsync = useCallback(
    (index: number, isAsync: boolean) => {
      setRecordingSteps((prev) => {
        const panel = getDisplayStepsFromRecording(prev, recordingContext, branchOwnership);
        const step = panel[index];
        if (!step) return prev;
        return prev.map((s) => (s.id === step.id ? { ...s, isAsync } : s));
      });
    },
    [recordingContext, branchOwnership],
  );

  const onDeleteStep = useCallback(
    (index: number) => {
      let removedId: string | null = null;
      setRecordingSteps((prev) => {
        const panel = getDisplayStepsFromRecording(prev, recordingContext, branchOwnership);
        const step = panel[index];
        if (!step) return prev;
        removedId = step.id;
        return prev.filter((s) => s.id !== step.id);
      });
      setBranchOwnership((om) => {
        if (!removedId || !om.has(removedId)) return om;
        const next = new Map(om);
        next.delete(removedId);
        return next;
      });
    },
    [recordingContext, branchOwnership],
  );

  const onReorderSteps = useCallback(
    (from: number, to: number) => {
      setRecordingSteps((prev) => {
        const panel = getDisplayStepsFromRecording(prev, recordingContext, branchOwnership);
        const idFrom = panel[from]?.id;
        const idTo = panel[to]?.id;
        if (!idFrom || !idTo || idFrom === idTo) return prev;
        const fullFrom = prev.findIndex((s) => s.id === idFrom);
        const fullTo = prev.findIndex((s) => s.id === idTo);
        if (fullFrom < 0 || fullTo < 0) return prev;
        const n = [...prev];
        const [m] = n.splice(fullFrom, 1);
        const insertAt = n.findIndex((s) => s.id === idTo);
        if (insertAt < 0) return prev;
        n.splice(insertAt, 0, m);
        return n;
      });
    },
    [recordingContext, branchOwnership],
  );

  const onConvertStepToCondition = useCallback(
    (index: number, conditionLabel: string, branchLabels: string[]) => {
      let convertedId: string | null = null;
      setRecordingSteps((prev) => {
        const panel = getDisplayStepsFromRecording(prev, recordingContext, branchOwnership);
        const target = panel[index];
        if (!target) return prev;
        convertedId = target.id;
        return prev.map((s) => {
          if (s.id !== target.id) return s;
          const branches = branchLabels.map((label) => ({
            label,
            nextId: generateId("step"),
          }));
          return { ...s, type: "condition" as const, conditionLabel, branches, next: undefined };
        });
      });
      if (convertedId) {
        setRecordingContext({ mode: "branch-select", conditionStepId: convertedId });
      }
    },
    [recordingContext, branchOwnership],
  );

  const onUpdateConditionLabel = useCallback(
    (index: number, label: string) => {
      setRecordingSteps((prev) => {
        const panel = getDisplayStepsFromRecording(prev, recordingContext, branchOwnership);
        const target = panel[index];
        if (!target) return prev;
        return prev.map((s) => (s.id === target.id ? { ...s, conditionLabel: label } : s));
      });
    },
    [recordingContext, branchOwnership],
  );

  const onAddBranchLabel = useCallback(
    (conditionStepId: string, label: string) => {
      setRecordingSteps((prev) => {
        const condStep = prev.find((s) => s.id === conditionStepId);
        if (!condStep || condStep.type !== "condition") return prev;
        return prev.map((s) => {
          if (s.id !== condStep.id) return s;
          return { ...s, branches: [...(s.branches ?? []), { label, nextId: generateId("step") }] };
        });
      });
    },
    [],
  );

  const onRemoveBranchLabel = useCallback(
    (conditionStepId: string, branchIndex: number) => {
      setRecordingSteps((prev) => {
        const condStep = prev.find((s) => s.id === conditionStepId);
        if (!condStep?.branches || condStep.branches.length <= 2) return prev;

        return prev
          .filter((s) => {
            const info = branchOwnership.get(s.id);
            if (info && info.conditionStepId === condStep.id && info.branchIndex === branchIndex) {
              return false;
            }
            return true;
          })
          .map((s) => {
            if (s.id !== condStep.id) return s;
            return { ...s, branches: s.branches!.filter((_, bi) => bi !== branchIndex) };
          });
      });
      setBranchOwnership((prev) => {
        const next = new Map<string, BranchOwnerInfo>();
        for (const [sid, info] of prev) {
          if (info.conditionStepId !== conditionStepId) {
            next.set(sid, info);
          } else if (info.branchIndex < branchIndex) {
            next.set(sid, info);
          } else if (info.branchIndex > branchIndex) {
            next.set(sid, { ...info, branchIndex: info.branchIndex - 1 });
          }
        }
        return next;
      });
    },
    [branchOwnership],
  );

  const onUpdateBranchLabel = useCallback(
    (conditionStepId: string, branchIndex: number, label: string) => {
      setRecordingSteps((prev) => {
        const condStep = prev.find((s) => s.id === conditionStepId);
        if (!condStep?.branches) return prev;
        return prev.map((s) => {
          if (s.id !== condStep.id) return s;
          return {
            ...s,
            branches: s.branches!.map((b, bi) => (bi === branchIndex ? { ...b, label } : b)),
          };
        });
      });
    },
    [],
  );

  const onAddConditionStep = useCallback(
    (conditionLabel: string, branchLabels: string[]) => {
      const id = generateId("step");
      const branches = branchLabels.map((label) => ({
        label,
        nextId: generateId("step"),
      }));
      const newStep: FlowStep = { id, type: "condition", conditionLabel, branches };

      setRecordingSteps((prev) => {
        if (recordingContext.mode !== "branch-record") {
          return [...prev, newStep];
        }
        const { conditionStepId, branchIndex } = recordingContext;
        const insertAfterIdx = findLastBranchStepIndex(prev, conditionStepId, branchIndex, branchOwnership);
        const newArr = [...prev];
        newArr.splice(insertAfterIdx + 1, 0, newStep);
        return newArr;
      });

      if (recordingContext.mode === "branch-record") {
        const { conditionStepId, branchIndex } = recordingContext;
        setBranchOwnership((prev) => {
          const next = new Map(prev);
          next.set(id, { conditionStepId, branchIndex });
          return next;
        });
      }

      setRecordingContext({ mode: "branch-select", conditionStepId: id });
    },
    [recordingContext, branchOwnership],
  );

  const onEnterBranchRecording = useCallback(
    (conditionStepId: string, branchIndex: number) => {
      const condStep = recordingSteps.find((s) => s.id === conditionStepId);
      if (!condStep || condStep.type !== "condition" || !condStep.branches?.[branchIndex]) return;
      setRecordingContext({
        mode: "branch-record",
        conditionStepId,
        branchIndex,
        branchLabel: condStep.branches[branchIndex].label,
      });
    },
    [recordingSteps],
  );

  const onOpenBranchSelect = useCallback((conditionStepId: string) => {
    setRecordingContext({ mode: "branch-select", conditionStepId });
  }, []);

  const value: RecordingModeState = {
    isRecording,
    recordingSteps,
    recordingStepsForPanel,
    recordingContext,
    setRecordingContext,
    recordingName,
    recordingDescription,
    recordingTags,
    editingFlowId,
    branchOwnership,
    setRecordingName,
    setRecordingDescription,
    onAddTag,
    onRemoveTag,
    onUpdateStepDescription,
    onUpdateStepDuration,
    onUpdateStepPayload,
    onUpdateStepPayloadDirection,
    onUpdateStepIsAsync,
    onDeleteStep,
    onReorderSteps,
    onRecordNodeClick,
    onRecordEdgeClick,
    onRecordHandleClick,
    onRecordUndo,
    startRecording,
    cancelRecording,
    finalizeRecording,
    editFlow,
    onConvertStepToCondition,
    onUpdateConditionLabel,
    onAddBranchLabel,
    onRemoveBranchLabel,
    onUpdateBranchLabel,
    onAddConditionStep,
    onEnterBranchRecording,
    onOpenBranchSelect,
  };

  return <RecordingModeProvider value={value}>{children}</RecordingModeProvider>;
}
