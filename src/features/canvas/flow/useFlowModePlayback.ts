import { useCallback, useMemo } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { Flow, FlowStep } from "@/features/diagram";
import { getEntryStep, getStepById, isConditionStep, isFlowLinkStep } from "@/features/diagram";
import type { FlowMode, FlowModeState } from "./flowMode.types";

function isBranchAncestor(flow: Flow, fromId: string | undefined, targetId: string, visited: Set<string>): boolean {
  if (!fromId) return false;
  if (fromId === targetId) return true;
  if (visited.has(fromId)) return false;
  visited.add(fromId);
  const step = flow.steps[fromId];
  if (!step) return false;
  if (isConditionStep(step) || isFlowLinkStep(step)) return false;
  const nextId = "next" in step ? step.next : undefined;
  if (!nextId) return false;
  return isBranchAncestor(flow, nextId, targetId, visited);
}

function findMergeStepId(flow: Flow, stepId: string): string | null {
  for (const cond of Object.values(flow.steps)) {
    if (!isConditionStep(cond) || !cond.next || !cond.branches) continue;
    for (const branch of cond.branches) {
      if (isBranchAncestor(flow, branch.nextId, stepId, new Set())) {
        return cond.next;
      }
    }
  }
  return null;
}

export type FlowModePlaybackSlice = Pick<
  FlowModeState,
  | "play"
  | "exitPlay"
  | "goNext"
  | "goBack"
  | "chooseBranch"
  | "followFlowLink"
  | "dismissPendingFlowLink"
  | "clearPendingFlowLink"
  | "currentStep"
  | "isCondition"
  | "canGoBack"
  | "canGoForward"
  | "pendingFlowLink"
>;

export function useFlowModePlayback(
  mode: FlowMode,
  setMode: Dispatch<SetStateAction<FlowMode>>,
): FlowModePlaybackSlice {
  const play = useCallback((flow: Flow) => {
    setMode((prevMode) => {
      if (prevMode.kind !== "idle") return prevMode;
      const entry = getEntryStep(flow);
      return {
        kind: "playing",
        flow,
        currentStepId: entry?.id ?? null,
        history: [],
        pendingFlowLink: null,
      };
    });
  }, [setMode]);

  const exitPlay = useCallback(() => {
    setMode((prevMode) => (prevMode.kind === "playing" ? { kind: "idle" } : prevMode));
  }, [setMode]);

  const followFlowLink = useCallback(
    (targetFlow: Flow) => {
      setMode((prev) => {
        if (prev.kind !== "playing") return prev;
        const entry = getEntryStep(targetFlow);
        return {
          kind: "playing",
          flow: targetFlow,
          currentStepId: entry?.id ?? null,
          history: [],
          pendingFlowLink: null,
        };
      });
    },
    [setMode],
  );

  const dismissPendingFlowLink = useCallback(() => {
    setMode((prev) => {
      if (prev.kind !== "playing") return prev;
      return { ...prev, pendingFlowLink: null };
    });
  }, [setMode]);

  const clearPendingFlowLink = dismissPendingFlowLink;

  const goNext = useCallback(() => {
    setMode((prevMode) => {
      if (prevMode.kind !== "playing") return prevMode;
      if (prevMode.pendingFlowLink) return prevMode;
      const { flow, currentStepId, history } = prevMode;
      if (!currentStepId) return prevMode;
      const step: FlowStep | undefined = getStepById(flow, currentStepId);
      if (!step) return prevMode;
      if (isFlowLinkStep(step)) {
        return {
          ...prevMode,
          pendingFlowLink: {
            targetFlowId: step.targetFlowId,
            targetFlowName: step.targetFlowName,
            targetDiagramId: step.targetDiagramId,
            targetDiagramName: step.targetDiagramName,
          },
        };
      }
      if (!isConditionStep(step) && !isFlowLinkStep(step) && !step.next) {
        const mergeId = findMergeStepId(flow, currentStepId);
        if (mergeId) {
          return { ...prevMode, history: [...history, currentStepId], currentStepId: mergeId };
        }
      }
      if (!step.next || isConditionStep(step)) return prevMode;
      return { ...prevMode, history: [...history, currentStepId], currentStepId: step.next };
    });
  }, [setMode]);

  const chooseBranch = useCallback(
    (branchIndex: number) => {
      setMode((prevMode) => {
        if (prevMode.kind !== "playing") return prevMode;
        const { flow, currentStepId, history } = prevMode;
        if (!currentStepId) return prevMode;
        const step = getStepById(flow, currentStepId);
        if (!step || !isConditionStep(step) || !step.branches[branchIndex]) return prevMode;
        return {
          ...prevMode,
          pendingFlowLink: null,
          history: [...history, currentStepId],
          currentStepId: step.branches[branchIndex].nextId,
        };
      });
    },
    [setMode],
  );

  const goBack = useCallback(() => {
    setMode((prevMode) => {
      if (prevMode.kind !== "playing" || prevMode.history.length === 0) return prevMode;
      const previousStepId = prevMode.history[prevMode.history.length - 1];
      return {
        ...prevMode,
        pendingFlowLink: null,
        currentStepId: previousStepId,
        history: prevMode.history.slice(0, -1),
      };
    });
  }, [setMode]);

  const currentStep = useMemo((): FlowStep | null => {
    if (mode.kind !== "playing") return null;
    const { flow, currentStepId } = mode;
    return currentStepId ? (getStepById(flow, currentStepId) ?? null) : null;
  }, [mode]);

  const isCondition = currentStep ? isConditionStep(currentStep) : false;
  const canGoBack = mode.kind === "playing" && mode.history.length > 0;
  const mergeTargetStepId = useMemo(() => {
    if (mode.kind !== "playing" || !mode.currentStepId) return null;
    return findMergeStepId(mode.flow, mode.currentStepId);
  }, [mode]);
  const canGoForward =
    mode.kind === "playing" &&
    !!currentStep &&
    !isCondition &&
    (isFlowLinkStep(currentStep) || !!currentStep.next || !!mergeTargetStepId);

  const pendingFlowLink = mode.kind === "playing" ? mode.pendingFlowLink : null;

  return useMemo(
    () => ({
      play,
      exitPlay,
      goNext,
      goBack,
      chooseBranch,
      followFlowLink,
      dismissPendingFlowLink,
      clearPendingFlowLink,
      currentStep,
      isCondition,
      canGoBack,
      canGoForward,
      pendingFlowLink,
    }),
    [
      play,
      exitPlay,
      goNext,
      goBack,
      chooseBranch,
      followFlowLink,
      dismissPendingFlowLink,
      clearPendingFlowLink,
      currentStep,
      isCondition,
      canGoBack,
      canGoForward,
      mergeTargetStepId,
      pendingFlowLink,
    ],
  );
}
