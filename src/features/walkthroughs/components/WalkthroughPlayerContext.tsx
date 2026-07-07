/* eslint-disable react-refresh/only-export-components */
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type Dispatch,
  type ReactNode,
} from "react";
import { FlowModeProvider, useFlowMode } from "@/features/canvas/flow/FlowModeContext";
import { useActiveDiagramId, useDiagramActions, useDiagrams } from "@/features/diagram";
import { useWalkthroughsStore } from "../store/walkthroughs.store";
import type {
  WalkthroughPlaybackContext,
  WalkthroughPlayerMode,
  WalkthroughPlayerProviderProps,
  WalkthroughPlayerState,
  WalkthroughRecordingTarget,
} from "../types";
import { WalkthroughPlayerReactContext } from "./walkthrough-player-context.shared";
import { useWalkthroughRecordingFinalize } from "../hooks/useWalkthroughRecordingFinalize";

export interface WalkthroughBridgeState {
  mode: WalkthroughPlayerMode;
  playbackContext: WalkthroughPlaybackContext | null;
  pendingFlow: { flowId: string; diagramId: string } | null;
  recordingTarget: WalkthroughRecordingTarget | null;
  pendingRecording: boolean;
  justStartedPlayback: boolean;
}

export type WalkthroughBridgeAction =
  | {
      type: "SET_PLAYBACK_CONTEXT";
      walkthroughId: string;
      selectedStepId: string | null;
    }
  | { type: "SELECT_STEP"; stepId: string }
  | { type: "START_FLOW_PLAYBACK"; flowId: string; diagramId: string }
  | { type: "FLOW_PLAY_COMMITTED" }
  | { type: "CONSUME_JUST_STARTED" }
  | {
      type: "START_RECORDING";
      walkthroughId: string;
      stepId: string;
      diagramId: string;
    }
  | { type: "RECORDING_COMMITTED" }
  | { type: "EXIT" }
  | { type: "CANCEL_RECORDING" };

export const INITIAL_STATE: WalkthroughBridgeState = {
  mode: { kind: "idle" },
  playbackContext: null,
  pendingFlow: null,
  recordingTarget: null,
  pendingRecording: false,
  justStartedPlayback: false,
};

export function walkthroughBridgeReducer(
  state: WalkthroughBridgeState,
  action: WalkthroughBridgeAction,
): WalkthroughBridgeState {
  switch (action.type) {
    case "SET_PLAYBACK_CONTEXT":
      return {
        ...state,
        playbackContext: {
          walkthroughId: action.walkthroughId,
          selectedStepId: action.selectedStepId,
        },
      };

    case "SELECT_STEP":
      if (state.mode.kind !== "playing") return state;
      return {
        ...state,
        mode: { ...state.mode, selectedStepId: action.stepId },
      };

    case "START_FLOW_PLAYBACK": {
      const ctx = state.playbackContext;
      if (!ctx?.walkthroughId || !ctx.selectedStepId) return state;
      return {
        ...state,
        pendingFlow: { flowId: action.flowId, diagramId: action.diagramId },
        justStartedPlayback: false,
        mode: {
          kind: "playing",
          walkthroughId: ctx.walkthroughId,
          selectedStepId: ctx.selectedStepId,
        },
      };
    }

    case "FLOW_PLAY_COMMITTED":
      return {
        ...state,
        pendingFlow: null,
        justStartedPlayback: true,
      };

    case "CONSUME_JUST_STARTED":
      return { ...state, justStartedPlayback: false };

    case "START_RECORDING":
      return {
        ...state,
        recordingTarget: {
          walkthroughId: action.walkthroughId,
          targetStepId: action.stepId,
          diagramId: action.diagramId,
        },
        pendingRecording: true,
        mode: {
          kind: "recording",
          walkthroughId: action.walkthroughId,
          targetStepId: action.stepId,
        },
      };

    case "RECORDING_COMMITTED":
      return { ...state, pendingRecording: false };

    case "CANCEL_RECORDING":
      return {
        ...state,
        recordingTarget: null,
        pendingRecording: false,
        mode: { kind: "idle" },
      };

    case "EXIT":
      return { ...INITIAL_STATE };

    default:
      return state;
  }
}

interface WalkthroughPlayerFlowBridgeProps {
  children: ReactNode;
  state: WalkthroughBridgeState;
  dispatch: Dispatch<WalkthroughBridgeAction>;
  onExitCanvas?: () => void;
}

function WalkthroughPlayerFlowBridge({
  children,
  state,
  dispatch,
  onExitCanvas,
}: WalkthroughPlayerFlowBridgeProps) {
  const flowMode = useFlowMode();
  const {
    play,
    startRecording: flowStartRecording,
    exitPlay,
    cancelRecording,
    finalizeRecording,
    isIdle: flowIsIdle,
  } = flowMode;
  const { openDiagram } = useDiagramActions();
  const activeDiagramId = useActiveDiagramId();
  const diagrams = useDiagrams();

  useEffect(() => {
    if (state.mode.kind !== "playing") return;
    const pending = state.pendingFlow;
    if (!pending) return;
    if (activeDiagramId !== pending.diagramId) {
      openDiagram(pending.diagramId);
      return;
    }
    const diagram = diagrams[pending.diagramId];
    const flow = diagram?.snapshot.flows[pending.flowId];
    if (!flow) return;
    dispatch({ type: "FLOW_PLAY_COMMITTED" });
    play(flow);
  }, [activeDiagramId, diagrams, dispatch, openDiagram, play, state.mode.kind, state.pendingFlow]);

  const prevSelectedStepIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (state.mode.kind !== "playing") {
      prevSelectedStepIdRef.current = null;
      return;
    }
    const previous = prevSelectedStepIdRef.current;
    const current = state.mode.selectedStepId;
    prevSelectedStepIdRef.current = current;

    if (previous !== null && previous !== current) {
      if (state.justStartedPlayback) {
        dispatch({ type: "CONSUME_JUST_STARTED" });
        return;
      }
      if (state.pendingFlow === null) {
        exitPlay();
      }
    }
  }, [dispatch, exitPlay, state.justStartedPlayback, state.mode, state.pendingFlow]);

  useEffect(() => {
    if (!state.pendingRecording) return;
    if (state.mode.kind !== "recording") return;
    const target = state.recordingTarget;
    if (!target) return;
    if (activeDiagramId !== target.diagramId) return;
    if (!flowIsIdle) return;
    dispatch({ type: "RECORDING_COMMITTED" });
    flowStartRecording();
  }, [
    activeDiagramId,
    dispatch,
    flowIsIdle,
    flowStartRecording,
    state.mode.kind,
    state.pendingRecording,
    state.recordingTarget,
  ]);

  const setPlaybackContext = useCallback(
    (walkthroughId: string, selectedStepId: string | null) => {
      dispatch({
        type: "SET_PLAYBACK_CONTEXT",
        walkthroughId,
        selectedStepId,
      });
    },
    [dispatch],
  );

  const selectStep = useCallback(
    (stepId: string) => {
      dispatch({ type: "SELECT_STEP", stepId });
    },
    [dispatch],
  );

  const startFlowPlayback = useCallback(
    (flowId: string, diagramId: string) => {
      dispatch({ type: "START_FLOW_PLAYBACK", flowId, diagramId });
      openDiagram(diagramId);
    },
    [dispatch, openDiagram],
  );

  const startRecording = useCallback(
    (walkthroughId: string, stepId: string) => {
      const walkthrough = useWalkthroughsStore.getState().walkthroughs[walkthroughId];
      const step = walkthrough?.steps[stepId];
      if (!step || step.diagramId.length === 0) return;
      dispatch({
        type: "START_RECORDING",
        walkthroughId,
        stepId,
        diagramId: step.diagramId,
      });
      openDiagram(step.diagramId);
    },
    [dispatch, openDiagram],
  );

  const exit = useCallback(() => {
    exitPlay();
    cancelRecording();
    dispatch({ type: "EXIT" });
    onExitCanvas?.();
  }, [cancelRecording, dispatch, exitPlay, onExitCanvas]);

  const finalizeWalkthroughRecording = useCallback(() => {
    finalizeRecording();
  }, [finalizeRecording]);

  const cancelWalkthroughRecording = useCallback(() => {
    cancelRecording();
    dispatch({ type: "CANCEL_RECORDING" });
  }, [cancelRecording, dispatch]);

  const value = useMemo<WalkthroughPlayerState>(
    () => ({
      mode: state.mode,
      setPlaybackContext,
      selectStep,
      startFlowPlayback,
      startRecording,
      exit,
      finalizeWalkthroughRecording,
      cancelWalkthroughRecording,
    }),
    [
      cancelWalkthroughRecording,
      exit,
      finalizeWalkthroughRecording,
      selectStep,
      setPlaybackContext,
      startFlowPlayback,
      startRecording,
      state.mode,
    ],
  );

  return (
    <WalkthroughPlayerReactContext.Provider value={value}>
      {children}
    </WalkthroughPlayerReactContext.Provider>
  );
}

export function WalkthroughPlayerProvider({
  children,
  onExitCanvas,
}: WalkthroughPlayerProviderProps) {
  const [state, dispatch] = useReducer(walkthroughBridgeReducer, INITIAL_STATE);
  const onFinalize = useWalkthroughRecordingFinalize(state.recordingTarget, dispatch);

  return (
    <FlowModeProvider onFinalize={onFinalize} onStartRecording={() => {}}>
      <WalkthroughPlayerFlowBridge state={state} dispatch={dispatch} onExitCanvas={onExitCanvas}>
        {children}
      </WalkthroughPlayerFlowBridge>
    </FlowModeProvider>
  );
}
