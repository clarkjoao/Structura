import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Dispatch, SetStateAction } from "react";
import type { FlowStep, Flow } from "@/features/diagram";
import { generateId, getStepById, getEntryStep, isConditionStep } from "@/features/diagram";

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

export type FlowMode =
  | { kind: "idle" }
  | {
      kind: "playing";
      flow: Flow;
      currentStepId: string | null;
      history: string[];
    }
  | {
      kind: "recording";
      steps: FlowStep[];
      context: RecordingContext;
      name: string;
      description: string;
      tags: string[];
      editingFlowId: string | null;
      branchOwnership: Map<string, BranchOwnerInfo>;
    };

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

export interface FlowModeState {
  mode: FlowMode;

  isIdle: boolean;
  isPlaying: boolean;
  isRecording: boolean;

  play: (flow: Flow) => void;
  exitPlay: () => void;
  goNext: () => void;
  goBack: () => void;
  chooseBranch: (branchIndex: number) => void;

  currentStep: FlowStep | null;
  isCondition: boolean;
  canGoBack: boolean;
  canGoForward: boolean;

  startRecording: () => void;
  cancelRecording: () => void;
  finalizeRecording: () => void;
  editFlow: (flow: Flow) => void;
  setRecordingName: (name: string) => void;
  setRecordingDescription: (desc: string) => void;
  onAddTag: (tag: string) => void;
  onRemoveTag: (index: number) => void;
  setRecordingContext: Dispatch<SetStateAction<RecordingContext>>;
  onRecordNodeClick: (nodeId: string) => void;
  onRecordEdgeClick: (edgeId: string, handleId?: string) => void;
  onRecordHandleClick: (nodeId: string, handleId: string) => void;
  onRecordUndo: () => void;
  onDeleteStep: (index: number) => void;
  onReorderSteps: (from: number, to: number) => void;
  onUpdateStepDescription: (index: number, value: string) => void;
  onUpdateStepDuration: (index: number, value: string) => void;
  onUpdateStepPayload: (index: number, value: string) => void;
  onUpdateStepPayloadDirection: (index: number, direction: "request" | "response") => void;
  onUpdateStepIsAsync: (index: number, value: boolean) => void;
  onConvertStepToCondition: (index: number, conditionLabel: string, branchLabels: string[]) => void;
  onUpdateConditionLabel: (index: number, label: string) => void;
  onAddBranchLabel: (conditionStepId: string, label: string) => void;
  onRemoveBranchLabel: (conditionStepId: string, branchIndex: number) => void;
  onUpdateBranchLabel: (conditionStepId: string, branchIndex: number, label: string) => void;
  onAddConditionStep: (conditionLabel: string, branchLabels: string[]) => void;
  onEnterBranchRecording: (conditionStepId: string, branchIndex: number) => void;
  onOpenBranchSelect: (conditionStepId: string) => void;

  recordingStepsForPanel: FlowStep[];

  onFinalize: (data: RecordingFinalizeData) => void;
}

const noop = () => {};

function createDefaultFlowModeState(): FlowModeState {
  return {
    mode: { kind: "idle" },
    isIdle: true,
    isPlaying: false,
    isRecording: false,
    play: noop,
    exitPlay: noop,
    goNext: noop,
    goBack: noop,
    chooseBranch: noop,
    currentStep: null,
    isCondition: false,
    canGoBack: false,
    canGoForward: false,
    startRecording: noop,
    cancelRecording: noop,
    finalizeRecording: noop,
    editFlow: noop,
    setRecordingName: noop,
    setRecordingDescription: noop,
    onAddTag: noop,
    onRemoveTag: noop,
    setRecordingContext: noop,
    onRecordNodeClick: noop,
    onRecordEdgeClick: noop,
    onRecordHandleClick: noop,
    onRecordUndo: noop,
    onDeleteStep: noop,
    onReorderSteps: noop,
    onUpdateStepDescription: noop,
    onUpdateStepDuration: noop,
    onUpdateStepPayload: noop,
    onUpdateStepPayloadDirection: noop,
    onUpdateStepIsAsync: noop,
    onConvertStepToCondition: noop,
    onUpdateConditionLabel: noop,
    onAddBranchLabel: noop,
    onRemoveBranchLabel: noop,
    onUpdateBranchLabel: noop,
    onAddConditionStep: noop,
    onEnterBranchRecording: noop,
    onOpenBranchSelect: noop,
    recordingStepsForPanel: [],
    onFinalize: noop,
  };
}

const FlowModeReactContext = createContext<FlowModeState>(createDefaultFlowModeState());

export function useFlowMode(): FlowModeState {
  return useContext(FlowModeReactContext);
}

export interface FlowModeProviderProps {
  children: React.ReactNode;
  onFinalize: (data: RecordingFinalizeData) => void;
  onStartRecording?: () => void;
}

export function FlowModeProvider({ children, onFinalize: onFinalizeProp, onStartRecording }: FlowModeProviderProps) {
  const [mode, setMode] = useState<FlowMode>({ kind: "idle" });
  const branchOwnershipRef = useRef<Map<string, BranchOwnerInfo>>(new Map());
  const onFinalizeRef = useRef(onFinalizeProp);
  const onStartRecordingRef = useRef(onStartRecording);
  onFinalizeRef.current = onFinalizeProp;
  onStartRecordingRef.current = onStartRecording;

  useLayoutEffect(() => {
    if (mode.kind === "recording") {
      branchOwnershipRef.current = mode.branchOwnership;
    }
  }, [mode]);

  const play = useCallback((flow: Flow) => {
    setMode((prevMode) => {
      if (prevMode.kind !== "idle") return prevMode;
      const entry = getEntryStep(flow);
      return { kind: "playing", flow, currentStepId: entry?.id ?? null, history: [] };
    });
  }, []);

  const exitPlay = useCallback(() => {
    setMode((prevMode) => (prevMode.kind === "playing" ? { kind: "idle" } : prevMode));
  }, []);

  const goNext = useCallback(() => {
    setMode((prevMode) => {
      if (prevMode.kind !== "playing") return prevMode;
      const { flow, currentStepId, history } = prevMode;
      if (!currentStepId) return prevMode;
      const step = getStepById(flow, currentStepId);
      if (!step?.next || isConditionStep(step)) return prevMode;
      return { ...prevMode, history: [...history, currentStepId], currentStepId: step.next };
    });
  }, []);

  const chooseBranch = useCallback((branchIndex: number) => {
    setMode((prevMode) => {
      if (prevMode.kind !== "playing") return prevMode;
      const { flow, currentStepId, history } = prevMode;
      if (!currentStepId) return prevMode;
      const step = getStepById(flow, currentStepId);
      if (!step?.branches?.[branchIndex]) return prevMode;
      return {
        ...prevMode,
        history: [...history, currentStepId],
        currentStepId: step.branches[branchIndex].nextId,
      };
    });
  }, []);

  const goBack = useCallback(() => {
    setMode((prevMode) => {
      if (prevMode.kind !== "playing" || prevMode.history.length === 0) return prevMode;
      const prevId = prevMode.history[prevMode.history.length - 1];
      return {
        ...prevMode,
        currentStepId: prevId,
        history: prevMode.history.slice(0, -1),
      };
    });
  }, []);

  const currentStep = useMemo((): FlowStep | null => {
    if (mode.kind !== "playing") return null;
    const { flow, currentStepId } = mode;
    return currentStepId ? (getStepById(flow, currentStepId) ?? null) : null;
  }, [mode]);

  const isCondition = currentStep ? isConditionStep(currentStep) : false;
  const canGoBack = mode.kind === "playing" && mode.history.length > 0;
  const canGoForward = mode.kind === "playing" && !!currentStep?.next && !isCondition;

  const isIdle = mode.kind === "idle";
  const isPlaying = mode.kind === "playing" && mode.currentStepId !== null;
  const isRecording = mode.kind === "recording";

  const recordingStepsForPanel = useMemo(() => {
    if (mode.kind !== "recording") return [];
    return getDisplayStepsFromRecording(mode.steps, mode.context, mode.branchOwnership);
  }, [mode]);

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
  }, []);

  const cancelRecording = useCallback(() => {
    setMode((prevMode) => {
      if (prevMode.kind !== "recording") return prevMode;
      branchOwnershipRef.current = new Map();
      return { kind: "idle" };
    });
  }, []);

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
  }, []);

  const editFlow = useCallback((flow: Flow) => {
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
  }, []);

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
    [],
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
    [],
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
    [],
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
  }, []);

  const setRecordingName = useCallback((name: string) => {
    setMode((prev) => (prev.kind !== "recording" ? prev : { ...prev, name }));
  }, []);

  const setRecordingDescription = useCallback((desc: string) => {
    setMode((prev) => (prev.kind !== "recording" ? prev : { ...prev, description: desc }));
  }, []);

  const setRecordingContext = useCallback((action: SetStateAction<RecordingContext>) => {
    setMode((prev) => {
      if (prev.kind !== "recording") return prev;
      const next = typeof action === "function" ? action(prev.context) : action;
      return { ...prev, context: next };
    });
  }, []);

  const onAddTag = useCallback((tag: string) => {
    setMode((prev) => {
      if (prev.kind !== "recording") return prev;
      if (prev.tags.includes(tag)) return prev;
      return { ...prev, tags: [...prev.tags, tag] };
    });
  }, []);

  const onRemoveTag = useCallback((index: number) => {
    setMode((prev) => {
      if (prev.kind !== "recording") return prev;
      return { ...prev, tags: prev.tags.filter((_, i) => i !== index) };
    });
  }, []);

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
    [],
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
    [],
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
    [],
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
    [],
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
    [],
  );

  const onDeleteStep = useCallback((index: number) => {
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
  }, []);

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
    [],
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
    [],
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
    [],
  );

  const onAddBranchLabel = useCallback((conditionStepId: string, label: string) => {
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
  }, []);

  const onRemoveBranchLabel = useCallback((conditionStepId: string, branchIndex: number) => {
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
  }, []);

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
    [],
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
    [],
  );

  const onOpenBranchSelect = useCallback((conditionStepId: string) => {
    setMode((prev) => {
      if (prev.kind !== "recording") return prev;
      return { ...prev, context: { mode: "branch-select", conditionStepId } };
    });
  }, []);

  const value: FlowModeState = useMemo(
    () => ({
      mode,
      isIdle,
      isPlaying,
      isRecording,
      play,
      exitPlay,
      goNext,
      goBack,
      chooseBranch,
      currentStep,
      isCondition,
      canGoBack,
      canGoForward,
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
      recordingStepsForPanel,
      onFinalize: onFinalizeProp,
    }),
    [
      mode,
      isIdle,
      isPlaying,
      isRecording,
      play,
      exitPlay,
      goNext,
      goBack,
      chooseBranch,
      currentStep,
      isCondition,
      canGoBack,
      canGoForward,
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
      recordingStepsForPanel,
      onFinalizeProp,
    ],
  );

  return <FlowModeReactContext.Provider value={value}>{children}</FlowModeReactContext.Provider>;
}
