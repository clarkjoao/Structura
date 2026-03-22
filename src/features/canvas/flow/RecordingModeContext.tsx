import { createContext, useContext, useState, useCallback } from "react";
import type { FlowStep, Flow } from "@/features/diagram";
import { generateId } from "@/features/diagram";

export interface BranchOwnerInfo {
  conditionStepId: string;
  branchIndex: number;
}

export interface RecordingFinalizeData {
  name: string;
  description: string;
  tags: string[];
  steps: FlowStep[];
  entryStepId?: string;
  editingFlowId: string | null;
  branchOwnership: Map<string, BranchOwnerInfo>;
}

export interface ActiveBranch {
  conditionIndex: number;   // index of condition step in the flat array
  conditionStepId: string;  // id of the condition step
  branchIndex: number;       // which branch (0, 1, 2…)
  branchLabel: string;       // label for display
}

export interface RecordingModeState {
  isRecording: boolean;
  recordingSteps: FlowStep[];
  recordingName: string;
  recordingDescription: string;
  recordingTags: string[];
  editingFlowId: string | null;
  activeBranch: ActiveBranch | null;
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
  // Branch recording
  onConvertStepToCondition: (index: number, conditionLabel: string, branchLabels: string[]) => void;
  onUpdateConditionLabel: (index: number, label: string) => void;
  onAddBranchLabel: (conditionIndex: number, label: string) => void;
  onRemoveBranchLabel: (conditionIndex: number, branchIndex: number) => void;
  onUpdateBranchLabel: (conditionIndex: number, branchIndex: number, label: string) => void;
  onAddConditionStep: (conditionLabel: string, branchLabels: string[]) => void;
  onEnterBranch: (conditionIndex: number, branchIndex: number) => void;
  onExitBranch: () => void;
}

const noop = () => {};
const defaultState: RecordingModeState = {
  isRecording: false,
  recordingSteps: [],
  recordingName: "",
  recordingDescription: "",
  recordingTags: [],
  editingFlowId: null,
  activeBranch: null,
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
  onEnterBranch: noop,
  onExitBranch: noop,
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
  const [activeBranch, setActiveBranch] = useState<ActiveBranch | null>(null);
  const [branchOwnership, setBranchOwnership] = useState<Map<string, BranchOwnerInfo>>(new Map());

  const resetRecordingState = useCallback(() => {
    setIsRecording(false);
    setRecordingSteps([]);
    setRecordingNameState("");
    setRecordingDescriptionState("");
    setRecordingTags([]);
    setEditingFlowId(null);
    setActiveBranch(null);
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

  const editFlow = useCallback((flow: Flow) => {
    const stepValues = Object.values(flow.steps);
    // Walk from entry to build ordered list, tracking branch ownership
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
    // Add any orphaned steps
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
    setActiveBranch(null);
    onStartRecording?.();
  }, [onStartRecording]);

  // Helper to add a step, respecting active branch
  const addRecordingStep = useCallback((step: FlowStep) => {
    setRecordingSteps((prev) => {
      if (!activeBranch) {
        // Trunk: append at end
        return [...prev, step];
      }
      // Branch: insert after the last step of this branch (or after the condition step)
      const insertAfterIdx = findLastBranchStepIndex(prev, activeBranch.conditionStepId, activeBranch.branchIndex, branchOwnership);
      const newArr = [...prev];
      newArr.splice(insertAfterIdx + 1, 0, step);
      return newArr;
    });
    if (activeBranch) {
      setBranchOwnership((prev) => {
        const next = new Map(prev);
        next.set(step.id, { conditionStepId: activeBranch.conditionStepId, branchIndex: activeBranch.branchIndex });
        return next;
      });
    }
  }, [activeBranch, branchOwnership]);

  const onRecordNodeClick = useCallback((nodeId: string) => {
    addRecordingStep({ id: generateId("step"), type: 'action', componentId: nodeId });
  }, [addRecordingStep]);

  const onRecordEdgeClick = useCallback((edgeId: string, handleId?: string) => {
    addRecordingStep({ id: generateId("step"), type: 'action', connectionId: edgeId, handleId });
  }, [addRecordingStep]);

  const onRecordHandleClick = useCallback((nodeId: string, handleId: string) => {
    addRecordingStep({ id: generateId("step"), type: 'action', componentId: nodeId, handleId });
  }, [addRecordingStep]);

  const onRecordUndo = useCallback(() => {
    setRecordingSteps((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      // Remove from ownership if it was a branch step
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

  const onUpdateStepDescription = useCallback((index: number, description: string) => {
    setRecordingSteps((prev) => prev.map((s, i) => (i === index ? { ...s, description } : s)));
  }, []);
  const onUpdateStepDuration = useCallback((index: number, duration: string) => {
    setRecordingSteps((prev) => prev.map((s, i) => (i === index ? { ...s, duration: duration || undefined } : s)));
  }, []);
  const onUpdateStepPayload = useCallback((index: number, payload: string) => {
    setRecordingSteps((prev) => prev.map((s, i) => (i === index ? { ...s, payload: payload || undefined } : s)));
  }, []);
  const onUpdateStepPayloadDirection = useCallback((index: number, direction: "request" | "response") => {
    setRecordingSteps((prev) => prev.map((s, i) => (i === index ? { ...s, payloadDirection: direction } : s)));
  }, []);
  const onUpdateStepIsAsync = useCallback((index: number, isAsync: boolean) => {
    setRecordingSteps((prev) => prev.map((s, i) => (i === index ? { ...s, isAsync } : s)));
  }, []);
  const onDeleteStep = useCallback((index: number) => {
    setRecordingSteps((prev) => {
      const step = prev[index];
      if (step) {
        setBranchOwnership((om) => {
          if (om.has(step.id)) {
            const next = new Map(om);
            next.delete(step.id);
            return next;
          }
          return om;
        });
      }
      return prev.filter((_, i) => i !== index);
    });
  }, []);
  const onReorderSteps = useCallback((from: number, to: number) => {
    setRecordingSteps((prev) => {
      const n = [...prev];
      const [m] = n.splice(from, 1);
      n.splice(to, 0, m);
      return n;
    });
  }, []);

  const onConvertStepToCondition = useCallback((index: number, conditionLabel: string, branchLabels: string[]) => {
    setRecordingSteps((prev) => prev.map((s, i) => {
      if (i !== index) return s;
      const branches = branchLabels.map((label) => ({
        label,
        nextId: generateId("step"),
      }));
      return { ...s, type: 'condition' as const, conditionLabel, branches, next: undefined };
    }));
  }, []);

  const onUpdateConditionLabel = useCallback((index: number, label: string) => {
    setRecordingSteps((prev) => prev.map((s, i) => (i === index ? { ...s, conditionLabel: label } : s)));
  }, []);

  const onAddBranchLabel = useCallback((conditionIndex: number, label: string) => {
    setRecordingSteps((prev) => prev.map((s, i) => {
      if (i !== conditionIndex || !s.branches) return s;
      return { ...s, branches: [...s.branches, { label, nextId: generateId("step") }] };
    }));
  }, []);

  const onRemoveBranchLabel = useCallback((conditionIndex: number, branchIndex: number) => {
    setRecordingSteps((prev) => {
      const condStep = prev[conditionIndex];
      if (!condStep?.branches || condStep.branches.length <= 2) return prev;

      // Remove steps owned by this branch
      const removedBranchStepIds = new Set<string>();
      // We'll clean ownership in a follow-up setState
      return prev.map((s, i) => {
        if (i !== conditionIndex) return s;
        return { ...s, branches: s.branches!.filter((_, bi) => bi !== branchIndex) };
      }).filter((s) => {
        // Remove steps owned by the deleted branch
        const info = branchOwnership.get(s.id);
        if (info && info.conditionStepId === condStep.id && info.branchIndex === branchIndex) {
          removedBranchStepIds.add(s.id);
          return false;
        }
        return true;
      });
    });
    // Clean ownership for removed steps + re-index branches above the removed one
    setBranchOwnership((prev) => {
      const condStep = recordingSteps[conditionIndex];
      if (!condStep) return prev;
      const next = new Map<string, BranchOwnerInfo>();
      for (const [sid, info] of prev) {
        if (info.conditionStepId !== condStep.id) {
          next.set(sid, info);
        } else if (info.branchIndex < branchIndex) {
          next.set(sid, info);
        } else if (info.branchIndex > branchIndex) {
          next.set(sid, { ...info, branchIndex: info.branchIndex - 1 });
        }
        // branchIndex === the removed one → skip (delete)
      }
      return next;
    });
  }, [branchOwnership, recordingSteps]);

  const onUpdateBranchLabel = useCallback((conditionIndex: number, branchIndex: number, label: string) => {
    setRecordingSteps((prev) => prev.map((s, i) => {
      if (i !== conditionIndex || !s.branches) return s;
      return {
        ...s,
        branches: s.branches.map((b, bi) => (bi === branchIndex ? { ...b, label } : b)),
      };
    }));
  }, []);

  const onAddConditionStep = useCallback((conditionLabel: string, branchLabels: string[]) => {
    const id = generateId("step");
    const branches = branchLabels.map((label) => ({
      label,
      nextId: generateId("step"),
    }));
    const newStep: FlowStep = { id, type: 'condition', conditionLabel, branches };
    setRecordingSteps((prev) => [...prev, newStep]);
  }, []);

  const onEnterBranch = useCallback((conditionIndex: number, branchIndex: number) => {
    const condStep = recordingSteps[conditionIndex];
    if (!condStep || condStep.type !== 'condition' || !condStep.branches?.[branchIndex]) return;
    setActiveBranch({
      conditionIndex,
      conditionStepId: condStep.id,
      branchIndex,
      branchLabel: condStep.branches[branchIndex].label,
    });
  }, [recordingSteps]);

  const onExitBranch = useCallback(() => {
    setActiveBranch(null);
  }, []);

  const value: RecordingModeState = {
    isRecording,
    recordingSteps,
    recordingName,
    recordingDescription,
    recordingTags,
    editingFlowId,
    activeBranch,
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
    onEnterBranch,
    onExitBranch,
  };

  return <RecordingModeProvider value={value}>{children}</RecordingModeProvider>;
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
