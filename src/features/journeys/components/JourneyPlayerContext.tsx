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
import { FlowModeProvider, useFlowMode } from "@/features/canvas";
import {
  useActiveDiagramId,
  useDiagramActions,
  useDiagrams,
} from "@/features/diagram";
import { useJourneyStore } from "../store/journeys.store";
import type {
  JourneyPlaybackContext,
  JourneyPlayerMode,
  JourneyPlayerProviderProps,
  JourneyPlayerState,
  JourneyRecordingTarget,
} from "../types";
import { JourneyPlayerReactContext } from "./journey-player-context.shared";
import { useJourneyRecordingFinalize } from "../hooks/useJourneyRecordingFinalize";

export interface JourneyBridgeState {
  mode: JourneyPlayerMode;
  playbackContext: JourneyPlaybackContext | null;
  pendingFlow: { flowId: string; diagramId: string } | null;
  recordingTarget: JourneyRecordingTarget | null;
  pendingRecording: boolean;
  justStartedPlayback: boolean;
}

export type JourneyBridgeAction =
  | {
      type: "SET_PLAYBACK_CONTEXT";
      journeyId: string;
      selectedStepId: string | null;
    }
  | { type: "SELECT_STEP"; stepId: string }
  | { type: "START_FLOW_PLAYBACK"; flowId: string; diagramId: string }
  | { type: "FLOW_PLAY_COMMITTED" }
  | { type: "CONSUME_JUST_STARTED" }
  | {
      type: "START_RECORDING";
      journeyId: string;
      stepId: string;
      diagramId: string;
    }
  | { type: "RECORDING_COMMITTED" }
  | { type: "EXIT" }
  | { type: "CANCEL_RECORDING" };

export const INITIAL_STATE: JourneyBridgeState = {
  mode: { kind: "idle" },
  playbackContext: null,
  pendingFlow: null,
  recordingTarget: null,
  pendingRecording: false,
  justStartedPlayback: false,
};

export function journeyBridgeReducer(
  state: JourneyBridgeState,
  action: JourneyBridgeAction,
): JourneyBridgeState {
  switch (action.type) {
    case "SET_PLAYBACK_CONTEXT":
      return {
        ...state,
        playbackContext: {
          journeyId: action.journeyId,
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
      if (!ctx?.journeyId || !ctx.selectedStepId) return state;
      return {
        ...state,
        pendingFlow: { flowId: action.flowId, diagramId: action.diagramId },
        justStartedPlayback: false,
        mode: {
          kind: "playing",
          journeyId: ctx.journeyId,
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
          journeyId: action.journeyId,
          targetStepId: action.stepId,
          diagramId: action.diagramId,
        },
        pendingRecording: true,
        mode: {
          kind: "recording",
          journeyId: action.journeyId,
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

interface JourneyPlayerFlowBridgeProps {
  children: ReactNode;
  state: JourneyBridgeState;
  dispatch: Dispatch<JourneyBridgeAction>;
  onExitCanvas?: () => void;
}

function JourneyPlayerFlowBridge({
  children,
  state,
  dispatch,
  onExitCanvas,
}: JourneyPlayerFlowBridgeProps) {
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
  }, [
    activeDiagramId,
    diagrams,
    dispatch,
    openDiagram,
    play,
    state.mode.kind,
    state.pendingFlow,
  ]);

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
  }, [
    dispatch,
    exitPlay,
    state.justStartedPlayback,
    state.mode,
    state.pendingFlow,
  ]);

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
    (journeyId: string, selectedStepId: string | null) => {
      dispatch({
        type: "SET_PLAYBACK_CONTEXT",
        journeyId,
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
    (journeyId: string, stepId: string) => {
      const journey = useJourneyStore.getState().journeys[journeyId];
      const step = journey?.steps[stepId];
      if (!step || step.diagramId.length === 0) return;
      dispatch({
        type: "START_RECORDING",
        journeyId,
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

  const finalizeJourneyRecording = useCallback(() => {
    finalizeRecording();
  }, [finalizeRecording]);

  const cancelJourneyRecording = useCallback(() => {
    cancelRecording();
    dispatch({ type: "CANCEL_RECORDING" });
  }, [cancelRecording, dispatch]);

  const value = useMemo<JourneyPlayerState>(
    () => ({
      mode: state.mode,
      setPlaybackContext,
      selectStep,
      startFlowPlayback,
      startRecording,
      exit,
      finalizeJourneyRecording,
      cancelJourneyRecording,
    }),
    [
      cancelJourneyRecording,
      exit,
      finalizeJourneyRecording,
      selectStep,
      setPlaybackContext,
      startFlowPlayback,
      startRecording,
      state.mode,
    ],
  );

  return (
    <JourneyPlayerReactContext.Provider value={value}>
      {children}
    </JourneyPlayerReactContext.Provider>
  );
}

export function JourneyPlayerProvider({
  children,
  onExitCanvas,
}: JourneyPlayerProviderProps) {
  const [state, dispatch] = useReducer(journeyBridgeReducer, INITIAL_STATE);
  const onFinalize = useJourneyRecordingFinalize(state.recordingTarget, dispatch);

  return (
    <FlowModeProvider onFinalize={onFinalize} onStartRecording={() => {}}>
      <JourneyPlayerFlowBridge
        state={state}
        dispatch={dispatch}
        onExitCanvas={onExitCanvas}
      >
        {children}
      </JourneyPlayerFlowBridge>
    </FlowModeProvider>
  );
}
