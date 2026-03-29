import type { Flow, FlowStep } from "@/features/diagram";
import { getStepById, getFlowParticipants, getOrderedStepIds, isFlowLinkStep } from "@/features/diagram";

export interface FlowHighlight {
  activeNodeId: string | null;
  activeConnId: string | null;
  visitedNodeIds: Set<string>;
  participantNodeIds: Set<string>;
  participantConnIds: Set<string>;
}

export interface CoverageInfo {
  nodeFlows: Map<string, string[]>;
  edgeFlows: Map<string, string[]>;
}

export interface RecordingInfo {
  nodeSteps: Map<string, number[]>;
  edgeSteps: Map<string, number[]>;
  recordedNodeIds: Set<string>;
  recordedEdgeIds: Set<string>;
  lastNodeId: string | null;
  lastEdgeId: string | null;
  lastHandleId: string | null;
}

export const EMPTY_FLOW_HIGHLIGHT: FlowHighlight = {
  activeNodeId: null,
  activeConnId: null,
  visitedNodeIds: new Set(),
  participantNodeIds: new Set(),
  participantConnIds: new Set(),
};

/** Legacy / partial persisted data may omit `steps` or store an array instead of a graph record. */
export function safeFlowSteps(flow: Flow): FlowStep[] {
  const s = flow.steps;
  if (Array.isArray(s)) return s;
  if (!s || typeof s !== "object") return [];
  const ordered = getOrderedStepIds(flow);
  if (ordered.length > 0) return ordered.map((id) => flow.steps[id]).filter((x): x is FlowStep => !!x);
  return Object.values(s);
}

function addFlowToMap(map: Map<string, string[]>, key: string, flowName: string): void {
  const arr = map.get(key) ?? [];
  if (!arr.includes(flowName)) arr.push(flowName);
  map.set(key, arr);
}

export function buildFlowHighlight(
  activeFlow: Flow,
  currentStepId: string,
  visitedStepIds: string[],
): FlowHighlight {
  const step = getStepById(activeFlow, currentStepId);
  const { componentIds: participantNodeIds, connectionIds: participantConnIds } =
    getFlowParticipants(activeFlow);

  const visitedNodeIds = new Set<string>();
  for (const vid of visitedStepIds) {
    const vs = activeFlow.steps[vid];
    if (vs && !isFlowLinkStep(vs) && vs.componentId) visitedNodeIds.add(vs.componentId);
  }

  const activeNodeId = step && !isFlowLinkStep(step) ? step.componentId ?? null : null;
  const activeConnId = step && !isFlowLinkStep(step) ? step.connectionId ?? null : null;

  return {
    activeNodeId,
    activeConnId,
    visitedNodeIds,
    participantNodeIds,
    participantConnIds,
  };
}

export function buildCoverage(flows: Flow[]): CoverageInfo {
  const nodeFlows = new Map<string, string[]>();
  const edgeFlows = new Map<string, string[]>();

  for (const flow of flows) {
    const { componentIds, connectionIds } = getFlowParticipants(flow);
    for (const cid of componentIds) addFlowToMap(nodeFlows, cid, flow.name);
    for (const eid of connectionIds) addFlowToMap(edgeFlows, eid, flow.name);
  }

  return { nodeFlows, edgeFlows };
}

export function buildRecordingInfo(steps: FlowStep[]): RecordingInfo {
  const nodeSteps = new Map<string, number[]>();
  const edgeSteps = new Map<string, number[]>();
  const recordedNodeIds = new Set<string>();
  const recordedEdgeIds = new Set<string>();

  let lastNonFlowLinkStep: Exclude<FlowStep, { type: "flow-link" }> | null = null;
  steps.forEach((step, i) => {
    if (isFlowLinkStep(step)) return;
    lastNonFlowLinkStep = step;
    if (step.componentId) {
      recordedNodeIds.add(step.componentId);
      const arr = nodeSteps.get(step.componentId) ?? [];
      arr.push(i + 1);
      nodeSteps.set(step.componentId, arr);
    }
    if (step.connectionId) {
      recordedEdgeIds.add(step.connectionId);
      const arr = edgeSteps.get(step.connectionId) ?? [];
      arr.push(i + 1);
      edgeSteps.set(step.connectionId, arr);
    }
  });

  const lastStep = lastNonFlowLinkStep;
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
