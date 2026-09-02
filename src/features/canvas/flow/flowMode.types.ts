import type { Dispatch, ReactNode, SetStateAction } from "react";
import type { Flow, FlowCursor, FlowStep } from "@/features/diagram";

/**
 * Where the recorder is pointing. `branch-select` writes nothing: it is the
 * moment between finishing one branch and choosing the next.
 */
export type RecordingContext =
  | { mode: "trunk" }
  | { mode: "branch-select"; conditionStepId: string }
  | { mode: "branch-record"; conditionStepId: string; branchIndex: number; branchLabel: string };

/** The write position a recording context points at, or null when it points at none. */
export function recordingCursor(context: RecordingContext): FlowCursor | null {
  if (context.mode === "trunk") return { kind: "trunk" };
  if (context.mode === "branch-record") {
    return {
      kind: "branch",
      conditionStepId: context.conditionStepId,
      branchIndex: context.branchIndex,
    };
  }
  return null;
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
      /**
       * The flow being written. The steps live in the store from the first
       * click; this context owns only where the next one goes.
       */
      flowId: string;
      context: RecordingContext;
      /** True when this session created the flow, so the header can say "REC" not "EDIT". */
      isNewFlow: boolean;
    };

export interface FlowModeState {
  mode: FlowMode;

  isIdle: boolean;
  isPlaying: boolean;
  isRecording: boolean;

  play: (flow: Flow) => void;
  /** Reads a different script without leaving the reading. */
  switchFlow: (flow: Flow) => void;
  exitPlay: () => void;
  goNext: () => void;
  goBack: () => void;
  chooseBranch: (branchIndex: number) => void;

  currentStep: FlowStep | null;
  isCondition: boolean;
  canGoBack: boolean;
  canGoForward: boolean;

  /** Id of the flow being recorded, or null outside a recording. */
  recordingFlowId: string | null;
  recordingContext: RecordingContext;
  setRecordingContext: Dispatch<SetStateAction<RecordingContext>>;

  startRecording: () => void;
  editFlow: (flow: Flow) => void;
  cancelRecording: () => void;
  finalizeRecording: () => void;

  onRecordNodeClick: (nodeId: string) => void;
  onRecordEdgeClick: (edgeId: string, handleId?: string) => void;
  onRecordHandleClick: (nodeId: string, handleId: string) => void;
  onRecordUndo: () => void;
}

export interface FlowModeProviderProps {
  children: ReactNode;
  onStartRecording?: () => void;
}
