import type { Dispatch, ReactNode, SetStateAction } from "react";
import type { Flow, FlowCallStack, FlowCursor, FlowStep, FrameExit } from "@/features/diagram";

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
      /**
       * Every step this reading has ever stood on, in the order it first did.
       *
       * `history` is the path *to* the step in hand, so going back un-walks it —
       * which is what makes the running object time-travel. This never
       * shortens, and is the only thing that can answer "have I been down there
       * already", which a reader at a `par` needs: all of its ways out happen,
       * so the question is which ones are still owed a visit.
       */
      seen: string[];
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
  /** Reads a call's result without reading its interior. */
  stepOver: () => void;
  /** Leaves the call the reader is inside, landing where it returns. */
  stepOut: () => void;

  currentStep: FlowStep | null;
  isCondition: boolean;
  canGoBack: boolean;
  canGoForward: boolean;

  /** The calls the script has in the air, or null outside a reading. */
  callStack: FlowCallStack | null;
  /** Where stepping over would land, or null when there is nothing to skip. */
  stepOverTarget: FrameExit | null;
  /** The call the reader is inside, or null at the outermost level. */
  stepOutFrameId: string | null;

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
