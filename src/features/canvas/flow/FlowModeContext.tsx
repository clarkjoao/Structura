import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  BranchOwnerInfo,
  FlowMode,
  FlowModeProviderProps,
  FlowModeState,
} from "./flowMode.types";
import { getDisplayStepsFromRecording, useFlowModeRecording } from "./useFlowModeRecording";
import { useFlowModePlayback } from "./useFlowModePlayback";

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

export function FlowModeProvider({
  children,
  onFinalize: onFinalizeProp,
  onStartRecording,
}: FlowModeProviderProps) {
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

  const playback = useFlowModePlayback(mode, setMode);
  const recording = useFlowModeRecording(
    mode,
    setMode,
    branchOwnershipRef,
    onFinalizeRef,
    onStartRecordingRef,
  );

  const isIdle = mode.kind === "idle";
  const isPlaying = mode.kind === "playing" && mode.currentStepId !== null;
  const isRecording = mode.kind === "recording";

  const recordingStepsForPanel = useMemo(() => {
    if (mode.kind !== "recording") return [];
    return getDisplayStepsFromRecording(mode.steps, mode.context, mode.branchOwnership);
  }, [mode]);

  const value: FlowModeState = useMemo(
    () => ({
      mode,
      isIdle,
      isPlaying,
      isRecording,
      ...playback,
      ...recording,
      recordingStepsForPanel,
      onFinalize: onFinalizeProp,
    }),
    [
      mode,
      isIdle,
      isPlaying,
      isRecording,
      playback,
      recording,
      recordingStepsForPanel,
      onFinalizeProp,
    ],
  );

  return <FlowModeReactContext.Provider value={value}>{children}</FlowModeReactContext.Provider>;
}
