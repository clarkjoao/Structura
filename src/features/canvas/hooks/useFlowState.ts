import { useMemo } from "react";
import type { Flow, FlowStep } from "@/features/diagram";

interface UseFlowStateParams {
  activeFlow?: Flow | null;
  currentStep?: number;
  flows: Flow[];
  isRecording: boolean | undefined;
  recordingSteps?: FlowStep[];
}

interface FlowHighlight {
  activeNodeId: string | null;
  activeConnId: string | null;
  visitedNodeIds: Set<string>;
  participantNodeIds: Set<string>;
  participantConnIds: Set<string>;
}

interface Coverage {
  nodeFlows: Map<string, string[]>;
  edgeFlows: Map<string, string[]>;
}

interface RecordingInfo {
  nodeSteps: Map<string, number[]>;
  edgeSteps: Map<string, number[]>;
  recordedNodeIds: Set<string>;
  recordedEdgeIds: Set<string>;
  lastNodeId: string | null;
  lastEdgeId: string | null;
  lastHandleId: string | null;
}

const EMPTY_FLOW_HIGHLIGHT: FlowHighlight = {
  activeNodeId: null,
  activeConnId: null,
  visitedNodeIds: new Set(),
  participantNodeIds: new Set(),
  participantConnIds: new Set(),
};

function addFlowToMap(map: Map<string, string[]>, key: string, flowName: string): void {
  const arr = map.get(key) ?? [];
  if (!arr.includes(flowName)) arr.push(flowName);
  map.set(key, arr);
}

function buildFlowHighlight(
  activeFlow: Flow,
  currentStep: number,
): FlowHighlight {
  const step = activeFlow.steps[currentStep];
  const visitedNodeIds = new Set<string>();
  const participantNodeIds = new Set<string>();
  const participantConnIds = new Set<string>();

  for (const s of activeFlow.steps) {
    if (s.componentId) participantNodeIds.add(s.componentId);
    if (s.connectionId) participantConnIds.add(s.connectionId);
    if (s.order < currentStep && s.componentId) visitedNodeIds.add(s.componentId);
  }

  return {
    activeNodeId: step?.componentId ?? null,
    activeConnId: step?.connectionId ?? null,
    visitedNodeIds,
    participantNodeIds,
    participantConnIds,
  };
}

function buildCoverage(flows: Flow[]): Coverage {
  const nodeFlows = new Map<string, string[]>();
  const edgeFlows = new Map<string, string[]>();

  for (const flow of flows) {
    for (const step of flow.steps) {
      if (step.componentId) addFlowToMap(nodeFlows, step.componentId, flow.name);
      if (step.connectionId) addFlowToMap(edgeFlows, step.connectionId, flow.name);
    }
  }

  return { nodeFlows, edgeFlows };
}

function buildRecordingInfo(steps: FlowStep[]): RecordingInfo {
  const nodeSteps = new Map<string, number[]>();
  const edgeSteps = new Map<string, number[]>();
  const recordedNodeIds = new Set<string>();
  const recordedEdgeIds = new Set<string>();

  for (const step of steps) {
    if (step.componentId) {
      recordedNodeIds.add(step.componentId);
      const arr = nodeSteps.get(step.componentId) ?? [];
      arr.push(step.order + 1);
      nodeSteps.set(step.componentId, arr);
    }
    if (step.connectionId) {
      recordedEdgeIds.add(step.connectionId);
      const arr = edgeSteps.get(step.connectionId) ?? [];
      arr.push(step.order + 1);
      edgeSteps.set(step.connectionId, arr);
    }
  }

  const lastStep = steps[steps.length - 1];
  return {
    nodeSteps,
    edgeSteps,
    recordedNodeIds,
    recordedEdgeIds,
    lastNodeId: lastStep?.componentId ?? null,
    lastEdgeId: lastStep?.connectionId ?? null,
    lastHandleId: lastStep?.handleId ?? null,
  };
}

// ── Hook ──────────────────────────────────────────────────────────────────

export function useFlowState({
  activeFlow,
  currentStep,
  flows,
  isRecording,
  recordingSteps,
}: UseFlowStateParams) {
  const isPlaying = !!activeFlow && currentStep !== undefined && currentStep >= 0;
  const stepIndex = currentStep ?? 0;

  const activeStep = isPlaying && activeFlow
    ? activeFlow.steps[stepIndex] ?? null
    : null;

  const flowHighlight = useMemo(() => {
    if (!isPlaying || !activeFlow) return EMPTY_FLOW_HIGHLIGHT;
    return buildFlowHighlight(activeFlow, stepIndex);
  }, [isPlaying, activeFlow, stepIndex]);

  const coverage = useMemo(() => {
    if (isPlaying || isRecording) return null;
    return buildCoverage(flows);
  }, [flows, isPlaying, isRecording]);

  const recordingInfo = useMemo(() => {
    if (!isRecording || !recordingSteps?.length) return null;
    return buildRecordingInfo(recordingSteps);
  }, [isRecording, recordingSteps]);

  return { isPlaying, activeStep, flowHighlight, coverage, recordingInfo };
}
