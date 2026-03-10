import { useMemo } from "react";
import type { Flow, FlowStep } from "@/features/diagram";

interface UseFlowStateParams {
  activeFlow?: Flow | null;
  currentStep?: number;
  flows: Flow[];
  isRecording: boolean | undefined;
  recordingSteps?: FlowStep[];
}

export function useFlowState({
  activeFlow,
  currentStep,
  flows,
  isRecording,
  recordingSteps,
}: UseFlowStateParams) {
  const isPlaying = !!activeFlow && currentStep !== undefined && currentStep >= 0;
  const activeStep = isPlaying && activeFlow ? activeFlow.steps[currentStep!] : null;

  const flowHighlight = useMemo(() => {
    if (!isPlaying || !activeFlow)
      return {
        activeNodeId: null as string | null,
        activeConnId: null as string | null,
        visitedNodeIds: new Set<string>(),
        participantNodeIds: new Set<string>(),
        participantConnIds: new Set<string>(),
      };
    const step = activeFlow.steps[currentStep!];
    const visitedNodeIds = new Set<string>();
    const participantNodeIds = new Set<string>();
    const participantConnIds = new Set<string>();
    for (const s of activeFlow.steps) {
      if (s.componentId) participantNodeIds.add(s.componentId);
      if (s.connectionId) participantConnIds.add(s.connectionId);
      if (s.order < (currentStep ?? 0) && s.componentId) visitedNodeIds.add(s.componentId);
    }
    return {
      activeNodeId: step?.componentId ?? null,
      activeConnId: step?.connectionId ?? null,
      visitedNodeIds,
      participantNodeIds,
      participantConnIds,
    };
  }, [isPlaying, activeFlow, currentStep]);

  const coverage = useMemo(() => {
    if (isPlaying || isRecording) return null;
    const nodeFlows = new Map<string, string[]>();
    const edgeFlows = new Map<string, string[]>();
    for (const flow of flows) {
      for (const step of flow.steps) {
        if (step.componentId) {
          const arr = nodeFlows.get(step.componentId) ?? [];
          if (!arr.includes(flow.name)) arr.push(flow.name);
          nodeFlows.set(step.componentId, arr);
        }
        if (step.connectionId) {
          const arr = edgeFlows.get(step.connectionId) ?? [];
          if (!arr.includes(flow.name)) arr.push(flow.name);
          edgeFlows.set(step.connectionId, arr);
        }
      }
    }
    return { nodeFlows, edgeFlows };
  }, [flows, isPlaying, isRecording]);

  const recordingInfo = useMemo(() => {
    if (!isRecording || !recordingSteps?.length) return null;
    const nodeSteps = new Map<string, number[]>();
    const edgeSteps = new Map<string, number[]>();
    const recordedNodeIds = new Set<string>();
    const recordedEdgeIds = new Set<string>();
    for (const step of recordingSteps) {
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
    const lastStep = recordingSteps[recordingSteps.length - 1];
    return {
      nodeSteps,
      edgeSteps,
      recordedNodeIds,
      recordedEdgeIds,
      lastNodeId: lastStep?.componentId ?? null,
      lastEdgeId: lastStep?.connectionId ?? null,
      lastHandleId: lastStep?.handleId ?? null,
    };
  }, [isRecording, recordingSteps]);

  return { isPlaying, activeStep, flowHighlight, coverage, recordingInfo };
}
