import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { FlowMode, FlowModeProviderProps, FlowModeState } from "./flowMode.types";
import { useFlowRecording } from "./useFlowRecording";
import { useFlowModePlayback } from "./useFlowModePlayback";

const noop = () => {};

function createDefaultFlowModeState(): FlowModeState {
  return {
    mode: { kind: "idle" },
    isIdle: true,
    isPlaying: false,
    isRecording: false,
    play: noop,
    switchFlow: noop,
    togglePinnedKey: noop,
    pinnedKeys: [],
    exitPlay: noop,
    goNext: noop,
    goBack: noop,
    chooseBranch: noop,
    stepOver: noop,
    stepOut: noop,
    currentStep: null,
    isCondition: false,
    canGoBack: false,
    canGoForward: false,
    callStack: null,
    stepOverTarget: null,
    stepOutFrameId: null,
    recordingFlowId: null,
    recordingContext: { mode: "trunk" },
    setRecordingContext: noop,
    startRecording: noop,
    editFlow: noop,
    cancelRecording: noop,
    finalizeRecording: noop,
    onRecordNodeClick: noop,
    onRecordEdgeClick: noop,
    onRecordHandleClick: noop,
    onRecordUndo: noop,
  };
}

const FlowModeReactContext = createContext<FlowModeState>(createDefaultFlowModeState());

export function useFlowMode(): FlowModeState {
  return useContext(FlowModeReactContext);
}

/**
 * Flow mode: playing a flow, or recording one.
 *
 * It holds interaction state only — which flow is open, where the next
 * recorded step goes. The steps themselves live in the diagram store from the
 * first click, so nothing here has to be materialised at the end.
 */
export function FlowModeProvider({ children, onStartRecording }: FlowModeProviderProps) {
  const [mode, setMode] = useState<FlowMode>({ kind: "idle" });
  const onStartRecordingRef = useRef(onStartRecording);
  useEffect(() => {
    onStartRecordingRef.current = onStartRecording;
  }, [onStartRecording]);

  const playback = useFlowModePlayback(mode, setMode);
  const recording = useFlowRecording(mode, setMode, onStartRecordingRef);

  const isIdle = mode.kind === "idle";
  const isPlaying = mode.kind === "playing" && mode.currentStepId !== null;
  const isRecording = mode.kind === "recording";

  const value: FlowModeState = useMemo(
    () => ({
      mode,
      isIdle,
      isPlaying,
      isRecording,
      ...playback,
      ...recording,
    }),
    [mode, isIdle, isPlaying, isRecording, playback, recording],
  );

  return <FlowModeReactContext.Provider value={value}>{children}</FlowModeReactContext.Provider>;
}
