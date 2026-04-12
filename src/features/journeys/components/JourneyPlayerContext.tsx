import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type ReactNode,
  type SetStateAction,
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
} from "../types";
import { JourneyPlayerReactContext } from "./journey-player-context.shared";
import { useJourneyRecordingFinalize } from "../hooks/useJourneyRecordingFinalize";

interface JourneyPlayerFlowBridgeProps {
  children: ReactNode;
  mode: JourneyPlayerMode;
  setMode: Dispatch<SetStateAction<JourneyPlayerMode>>;
  recordingTargetRef: MutableRefObject<{
    journeyId: string;
    targetStepId: string;
    diagramId: string;
  } | null>;
  playbackContextRef: MutableRefObject<JourneyPlaybackContext | null>;
  pendingFlowPlaybackRef: MutableRefObject<{
    flowId: string;
    diagramId: string;
  } | null>;
  pendingJourneyRecordingRef: MutableRefObject<boolean>;
  justStartedPlaybackRef: MutableRefObject<boolean>;
  onExitCanvas?: () => void;
}

function JourneyPlayerFlowBridge({
  children,
  mode,
  setMode,
  recordingTargetRef,
  playbackContextRef,
  pendingFlowPlaybackRef,
  pendingJourneyRecordingRef,
  justStartedPlaybackRef,
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
    if (mode.kind !== "playing") {
      return;
    }
    const pending = pendingFlowPlaybackRef.current;
    if (!pending) return;
    if (activeDiagramId !== pending.diagramId) {
      openDiagram(pending.diagramId);
      return;
    }
    const diagram = diagrams[pending.diagramId];
    const flow = diagram?.snapshot.flows[pending.flowId];
    if (!flow) return;
    pendingFlowPlaybackRef.current = null;
    justStartedPlaybackRef.current = true;
    play(flow);
  }, [
    activeDiagramId,
    diagrams,
    justStartedPlaybackRef,
    mode.kind,
    openDiagram,
    play,
    pendingFlowPlaybackRef,
  ]);

  const prevSelectedStepIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (mode.kind !== "playing") {
      prevSelectedStepIdRef.current = null;
      return;
    }
    const previousSelectedStepId = prevSelectedStepIdRef.current;
    const currentSelectedStepId = mode.selectedStepId;
    prevSelectedStepIdRef.current = currentSelectedStepId;
    if (
      previousSelectedStepId !== null &&
      previousSelectedStepId !== currentSelectedStepId
    ) {
      if (justStartedPlaybackRef.current) {
        justStartedPlaybackRef.current = false;
        return;
      }
      if (pendingFlowPlaybackRef.current === null) {
        exitPlay();
      }
    }
  }, [exitPlay, justStartedPlaybackRef, mode, pendingFlowPlaybackRef]);

  useEffect(() => {
    if (!pendingJourneyRecordingRef.current) return;
    if (mode.kind !== "recording") return;
    const target = recordingTargetRef.current;
    if (!target) return;
    if (activeDiagramId !== target.diagramId) return;
    if (!flowIsIdle) return;
    pendingJourneyRecordingRef.current = false;
    flowStartRecording();
  }, [
    activeDiagramId,
    flowIsIdle,
    flowStartRecording,
    mode.kind,
    pendingJourneyRecordingRef,
    recordingTargetRef,
  ]);

  const setPlaybackContext = useCallback(
    (journeyId: string, selectedStepId: string | null) => {
      playbackContextRef.current = { journeyId, selectedStepId };
    },
    [playbackContextRef],
  );

  const selectStep = useCallback(
    (stepId: string) => {
      setMode((previous) => {
        if (previous.kind !== "playing") return previous;
        return { ...previous, selectedStepId: stepId };
      });
    },
    [setMode],
  );

  const startFlowPlayback = useCallback(
    (flowId: string, diagramId: string) => {
      const context = playbackContextRef.current;
      if (!context?.journeyId || !context.selectedStepId) return;
      pendingFlowPlaybackRef.current = { flowId, diagramId };
      setMode({
        kind: "playing",
        journeyId: context.journeyId,
        selectedStepId: context.selectedStepId,
      });
      openDiagram(diagramId);
    },
    [openDiagram, pendingFlowPlaybackRef, playbackContextRef, setMode],
  );

  const startRecording = useCallback(
    (journeyId: string, stepId: string) => {
      const journey = useJourneyStore.getState().journeys[journeyId];
      const step = journey?.steps[stepId];
      if (!step || step.diagramId.length === 0) return;
      recordingTargetRef.current = {
        journeyId,
        targetStepId: stepId,
        diagramId: step.diagramId,
      };
      setMode({ kind: "recording", journeyId, targetStepId: stepId });
      openDiagram(step.diagramId);
      pendingJourneyRecordingRef.current = true;
    },
    [openDiagram, pendingJourneyRecordingRef, recordingTargetRef, setMode],
  );

  const exit = useCallback(() => {
    exitPlay();
    cancelRecording();
    pendingFlowPlaybackRef.current = null;
    justStartedPlaybackRef.current = false;
    pendingJourneyRecordingRef.current = false;
    recordingTargetRef.current = null;
    setMode({ kind: "idle" });
    onExitCanvas?.();
  }, [
    cancelRecording,
    exitPlay,
    onExitCanvas,
    pendingFlowPlaybackRef,
    justStartedPlaybackRef,
    pendingJourneyRecordingRef,
    recordingTargetRef,
    setMode,
  ]);

  const finalizeJourneyRecording = useCallback(() => {
    finalizeRecording();
  }, [finalizeRecording]);

  const cancelJourneyRecording = useCallback(() => {
    cancelRecording();
    pendingJourneyRecordingRef.current = false;
    recordingTargetRef.current = null;
    setMode({ kind: "idle" });
  }, [
    cancelRecording,
    pendingJourneyRecordingRef,
    recordingTargetRef,
    setMode,
  ]);

  const value = useMemo<JourneyPlayerState>(
    () => ({
      mode,
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
      mode,
      selectStep,
      setPlaybackContext,
      startFlowPlayback,
      startRecording,
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
  const [mode, setMode] = useState<JourneyPlayerMode>({ kind: "idle" });
  const recordingTargetRef = useRef<{
    journeyId: string;
    targetStepId: string;
    diagramId: string;
  } | null>(null);
  const playbackContextRef = useRef<JourneyPlaybackContext | null>(null);
  const pendingFlowPlaybackRef = useRef<{
    flowId: string;
    diagramId: string;
  } | null>(null);
  const pendingJourneyRecordingRef = useRef(false);
  const justStartedPlaybackRef = useRef(false);

  const onFinalize = useJourneyRecordingFinalize(recordingTargetRef, setMode);

  return (
    <FlowModeProvider onFinalize={onFinalize} onStartRecording={() => {}}>
      <JourneyPlayerFlowBridge
        mode={mode}
        setMode={setMode}
        recordingTargetRef={recordingTargetRef}
        playbackContextRef={playbackContextRef}
        pendingFlowPlaybackRef={pendingFlowPlaybackRef}
        pendingJourneyRecordingRef={pendingJourneyRecordingRef}
        justStartedPlaybackRef={justStartedPlaybackRef}
        onExitCanvas={onExitCanvas}
      >
        {children}
      </JourneyPlayerFlowBridge>
    </FlowModeProvider>
  );
}
