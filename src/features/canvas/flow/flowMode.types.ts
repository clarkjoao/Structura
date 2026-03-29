import type { Dispatch, ReactNode, SetStateAction } from "react";
import type { Flow, FlowStep } from "@/features/diagram";

export interface PendingFlowLink {
  targetFlowId: string;
  targetFlowName: string;
  targetDiagramId: string;
  targetDiagramName: string;
}

export interface BranchOwnerInfo {
  conditionStepId: string;
  branchIndex: number;
}

export type RecordingContext =
  | { mode: "trunk" }
  | { mode: "branch-select"; conditionStepId: string }
  | { mode: "branch-record"; conditionStepId: string; branchIndex: number; branchLabel: string };

export interface RecordingFinalizeData {
  name: string;
  description: string;
  tags: string[];
  steps: FlowStep[];
  entryStepId?: string;
  editingFlowId: string | null;
  branchOwnership: Map<string, BranchOwnerInfo>;
}

export type FlowMode =
  | { kind: "idle" }
  | {
      kind: "playing";
      flow: Flow;
      currentStepId: string | null;
      history: string[];
      pendingFlowLink: PendingFlowLink | null;
    }
  | {
      kind: "recording";
      steps: FlowStep[];
      context: RecordingContext;
      name: string;
      description: string;
      tags: string[];
      editingFlowId: string | null;
      branchOwnership: Map<string, BranchOwnerInfo>;
    };

export interface FlowModeState {
  mode: FlowMode;

  isIdle: boolean;
  isPlaying: boolean;
  isRecording: boolean;

  play: (flow: Flow) => void;
  exitPlay: () => void;
  goNext: () => void;
  goBack: () => void;
  chooseBranch: (branchIndex: number) => void;
  followFlowLink: (flow: Flow) => void;
  dismissPendingFlowLink: () => void;
  clearPendingFlowLink: () => void;

  currentStep: FlowStep | null;
  isCondition: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  pendingFlowLink: PendingFlowLink | null;

  startRecording: () => void;
  cancelRecording: () => void;
  finalizeRecording: () => void;
  editFlow: (flow: Flow, jumpToCondition?: string) => void;
  setRecordingName: (name: string) => void;
  setRecordingDescription: (desc: string) => void;
  onAddTag: (tag: string) => void;
  onRemoveTag: (index: number) => void;
  setRecordingContext: Dispatch<SetStateAction<RecordingContext>>;
  onRecordNodeClick: (nodeId: string) => void;
  onRecordEdgeClick: (edgeId: string, handleId?: string) => void;
  onRecordHandleClick: (nodeId: string, handleId: string) => void;
  onRecordUndo: () => void;
  onDeleteStep: (index: number) => void;
  onReorderSteps: (from: number, to: number) => void;
  onUpdateStepDescription: (index: number, value: string) => void;
  onUpdateStepDuration: (index: number, value: string) => void;
  onUpdateStepPayload: (index: number, value: string) => void;
  onUpdateStepPayloadDirection: (index: number, direction: "request" | "response") => void;
  onUpdateStepIsAsync: (index: number, value: boolean) => void;
  onConvertStepToCondition: (index: number, conditionLabel: string, branchLabels: string[]) => void;
  onUpdateConditionLabel: (index: number, label: string) => void;
  onAddBranchLabel: (conditionStepId: string, label: string) => void;
  onRemoveBranchLabel: (conditionStepId: string, branchIndex: number) => void;
  onUpdateBranchLabel: (conditionStepId: string, branchIndex: number, label: string) => void;
  onAddConditionStep: (conditionLabel: string, branchLabels: string[]) => void;
  onEnterBranchRecording: (conditionStepId: string, branchIndex: number) => void;
  onOpenBranchSelect: (conditionStepId: string) => void;
  onSetFlowLink: (
    stepId: string,
    target: {
      targetFlowId: string;
      targetFlowName: string;
      targetDiagramId: string;
      targetDiagramName: string;
    },
  ) => void;
  onRemoveFlowLink: (stepId: string) => void;
  onSetConditionMerge: (conditionStepId: string, mergeStepId: string | null) => void;

  recordingStepsForPanel: FlowStep[];

  /** Step ids already visited during playback (derived from history stack). */
  visitedStepIds: Set<string>;

  onFinalize: (data: RecordingFinalizeData) => void;
}

export interface FlowModeProviderProps {
  children: ReactNode;
  onFinalize: (data: RecordingFinalizeData) => void;
  onStartRecording?: () => void;
}
