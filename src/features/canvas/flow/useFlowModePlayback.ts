import { useCallback, useMemo } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { Flow, FlowCallStack, FlowStep } from "@/features/diagram";
import {
  buildCallStack,
  buildFlowOutline,
  findFrameExit,
  getEntryStep,
  getStepById,
  isConditionStep,
} from "@/features/diagram";
import type { FlowMode, FlowModeState } from "./flowMode.types";

export type FlowModePlaybackSlice = Pick<
  FlowModeState,
  | "play"
  | "switchFlow"
  | "exitPlay"
  | "goNext"
  | "goBack"
  | "chooseBranch"
  | "stepOver"
  | "stepOut"
  | "currentStep"
  | "isCondition"
  | "canGoBack"
  | "canGoForward"
  | "callStack"
  | "stepOverTarget"
  | "stepOutFrameId"
  | "togglePinnedKey"
  | "pinnedKeys"
>;

/**
 * The call this step would skip, and the one it would leave.
 *
 * Skipping is about the call the step *makes*; leaving is about the call it is
 * *inside*. On a step that opens a call those are two different frames, which
 * is what keeps the two controls from doing the same thing.
 */
function frameToSkip(callStack: FlowCallStack, stepId: string | null): string | null {
  if (!stepId) return null;
  return callStack.byStep.get(stepId)?.opensFrameId ?? null;
}

/**
 * Adds steps to the set of places this reading has stood, keeping first-visit
 * order and never adding one twice. Nothing is ever taken out: `goBack` un-walks
 * the path, it does not un-see where the reader has been.
 */
function withSeen(seen: readonly string[], ...stepIds: string[]): string[] {
  const next = [...seen];
  for (const stepId of stepIds) if (!next.includes(stepId)) next.push(stepId);
  return next;
}

function frameToLeave(callStack: FlowCallStack, stepId: string | null): string | null {
  if (!stepId) return null;
  const info = callStack.byStep.get(stepId);
  if (!info || info.callDepth === 0) return null;
  return info.openFrameIds[info.callDepth - 1] ?? null;
}

/** Stable, so a reading that pins nothing does not re-render on every mode read. */
const EMPTY_PINS: readonly string[] = [];

export function useFlowModePlayback(
  mode: FlowMode,
  setMode: Dispatch<SetStateAction<FlowMode>>,
): FlowModePlaybackSlice {
  const play = useCallback(
    (flow: Flow) => {
      setMode((prevMode) => {
        if (prevMode.kind !== "idle") return prevMode;
        const entry = getEntryStep(flow);
        return {
          kind: "playing",
          flow,
          currentStepId: entry?.id ?? null,
          history: [],
          seen: entry ? [entry.id] : [],
          pinnedKeys: [],
        };
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
        return {
          kind: "playing",
          flow,
          currentStepId: entry?.id ?? null,
          history: [],
          seen: entry ? [entry.id] : [],
          // Another script's values are not these values; the pins go with them.
          pinnedKeys: [],
        };
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
      return {
        ...prevMode,
        history: [...history, currentStepId],
        currentStepId: step.next,
        seen: withSeen(prevMode.seen, step.next),
      };
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
          seen: withSeen(prevMode.seen, step.branches[branchIndex].nextId),
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

  /**
   * The calls in the air, for the script being read.
   *
   * Keyed on the flow alone: the pairing is a property of the script, not of
   * where the reader has got to, so stepping does not rebuild it.
   */
  const callStack = useMemo((): FlowCallStack | null => {
    if (mode.kind !== "playing") return null;
    return buildCallStack(mode.flow, buildFlowOutline(mode.flow));
  }, [mode]);

  const currentStepId = mode.kind === "playing" ? mode.currentStepId : null;

  const stepOverTarget = useMemo(() => {
    if (mode.kind !== "playing" || !callStack || !currentStepId) return null;
    const frameId = frameToSkip(callStack, currentStepId);
    if (!frameId) return null;
    return findFrameExit(mode.flow, callStack, currentStepId, frameId);
  }, [mode, callStack, currentStepId]);

  const stepOutFrameId = useMemo(
    () => (callStack ? frameToLeave(callStack, currentStepId) : null),
    [callStack, currentStepId],
  );

  /**
   * Skipping still walks. The steps passed over happened — the reader simply
   * did not stop on them — so they enter the history in order, which is what
   * keeps the walked spine honest and lets `goBack` retrace the interior one
   * step at a time instead of jumping back over the whole call.
   */
  const walkTo = useCallback(
    (exit: { targetStepId: string; throughStepIds: string[] } | null) => {
      if (!exit) return;
      setMode((prevMode) => {
        if (prevMode.kind !== "playing" || !prevMode.currentStepId) return prevMode;
        return {
          ...prevMode,
          history: [...prevMode.history, prevMode.currentStepId, ...exit.throughStepIds],
          currentStepId: exit.targetStepId,
          seen: withSeen(prevMode.seen, ...exit.throughStepIds, exit.targetStepId),
        };
      });
    },
    [setMode],
  );

  const togglePinnedKey = useCallback(
    (key: string) => {
      setMode((prevMode) => {
        if (prevMode.kind !== "playing") return prevMode;
        const pinned = prevMode.pinnedKeys.includes(key)
          ? prevMode.pinnedKeys.filter((pin) => pin !== key)
          : [...prevMode.pinnedKeys, key];
        return { ...prevMode, pinnedKeys: pinned };
      });
    },
    [setMode],
  );

  const stepOver = useCallback(() => walkTo(stepOverTarget), [walkTo, stepOverTarget]);

  const stepOut = useCallback(() => {
    if (mode.kind !== "playing" || !callStack || !currentStepId || !stepOutFrameId) return;
    walkTo(findFrameExit(mode.flow, callStack, currentStepId, stepOutFrameId));
  }, [mode, callStack, currentStepId, stepOutFrameId, walkTo]);

  const currentStep = useMemo((): FlowStep | null => {
    if (mode.kind !== "playing") return null;
    const { flow, currentStepId: id } = mode;
    return id ? (getStepById(flow, id) ?? null) : null;
  }, [mode]);

  const isCondition = currentStep ? isConditionStep(currentStep) : false;
  const canGoBack = mode.kind === "playing" && mode.history.length > 0;
  const canGoForward = mode.kind === "playing" && !!currentStep?.next && !isCondition;
  const pinnedKeys = mode.kind === "playing" ? mode.pinnedKeys : EMPTY_PINS;

  return useMemo(
    () => ({
      play,
      switchFlow,
      exitPlay,
      goNext,
      goBack,
      chooseBranch,
      stepOver,
      stepOut,
      currentStep,
      isCondition,
      canGoBack,
      canGoForward,
      callStack,
      stepOverTarget,
      stepOutFrameId,
      togglePinnedKey,
      pinnedKeys,
    }),
    [
      play,
      switchFlow,
      exitPlay,
      goNext,
      goBack,
      chooseBranch,
      stepOver,
      stepOut,
      currentStep,
      isCondition,
      canGoBack,
      canGoForward,
      callStack,
      stepOverTarget,
      stepOutFrameId,
      togglePinnedKey,
      pinnedKeys,
    ],
  );
}
