import { useCallback, useMemo } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { Flow, FlowStep } from "@/features/diagram";
import { getEntryStep, getStepById, isConditionStep } from "@/features/diagram";
import type { FlowMode, FlowModeState } from "./flowMode.types";

export type FlowModePlaybackSlice = Pick<
  FlowModeState,
  | "play"
  | "switchFlow"
  | "exitPlay"
  | "goNext"
  | "goBack"
  | "chooseBranch"
  | "currentStep"
  | "isCondition"
  | "canGoBack"
  | "canGoForward"
>;

export function useFlowModePlayback(
  mode: FlowMode,
  setMode: Dispatch<SetStateAction<FlowMode>>,
): FlowModePlaybackSlice {
  const play = useCallback(
    (flow: Flow) => {
      setMode((prevMode) => {
        if (prevMode.kind !== "idle") return prevMode;
        const entry = getEntryStep(flow);
        return { kind: "playing", flow, currentStepId: entry?.id ?? null, history: [] };
      });
    },
    [setMode],
  );

  /**
   * Reads another script from its first step.
   *
   * One transition rather than an exit and a fresh play, so the reading never
   * passes through idle: the canvas would drop its highlight and the panels
   * would flicker back for a frame in between.
   */
  const switchFlow = useCallback(
    (flow: Flow) => {
      setMode((prevMode) => {
        if (prevMode.kind !== "playing") return prevMode;
        if (prevMode.flow.id === flow.id) return prevMode;
        const entry = getEntryStep(flow);
        return { kind: "playing", flow, currentStepId: entry?.id ?? null, history: [] };
      });
    },
    [setMode],
  );

  const exitPlay = useCallback(() => {
    setMode((prevMode) => (prevMode.kind === "playing" ? { kind: "idle" } : prevMode));
  }, [setMode]);

  const goNext = useCallback(() => {
    setMode((prevMode) => {
      if (prevMode.kind !== "playing") return prevMode;
      const { flow, currentStepId, history } = prevMode;
      if (!currentStepId) return prevMode;
      const step = getStepById(flow, currentStepId);
      if (!step?.next || isConditionStep(step)) return prevMode;
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
        if (!step?.branches?.[branchIndex]) return prevMode;
        return {
          ...prevMode,
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
      const prevId = prevMode.history[prevMode.history.length - 1];
      return {
        ...prevMode,
        currentStepId: prevId,
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
  const canGoForward = mode.kind === "playing" && !!currentStep?.next && !isCondition;

  return useMemo(
    () => ({
      play,
      switchFlow,
      exitPlay,
      goNext,
      goBack,
      chooseBranch,
      currentStep,
      isCondition,
      canGoBack,
      canGoForward,
    }),
    [
      play,
      switchFlow,
      exitPlay,
      goNext,
      goBack,
      chooseBranch,
      currentStep,
      isCondition,
      canGoBack,
      canGoForward,
    ],
  );
}
