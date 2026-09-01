import type { Flow, FlowOutlineRow, FlowStep } from "@/features/diagram";
import { getStepById, getFlowParticipants, getOrderedStepIds } from "@/features/diagram";

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

/**
 * The step numbers the canvas shows, and which elements a flow touches.
 *
 * The numbers are the derived labels — `1`, `3a`, `3a.2` — so a node the flow
 * visits inside a branch says so. They are not stored anywhere: this is built
 * from the graph on each render, during a recording and outside one alike.
 */
export interface FlowBadges {
  nodeLabels: Map<string, string[]>;
  edgeLabels: Map<string, string[]>;
  badgedNodeIds: Set<string>;
  badgedEdgeIds: Set<string>;
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

export function safeFlowSteps(flow: Flow): FlowStep[] {
  const s = flow.steps;
  if (Array.isArray(s)) return s;
  if (!s || typeof s !== "object") return [];
  const ordered = getOrderedStepIds(flow);
  if (ordered.length > 0)
    return ordered.map((id) => flow.steps[id]).filter((x): x is FlowStep => !!x);
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
    if (vs?.componentId) visitedNodeIds.add(vs.componentId);
  }

  return {
    activeNodeId: step?.componentId ?? null,
    activeConnId: step?.connectionId ?? null,
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

/**
 * Badges for a run of rows, in reading order. `rows` is what the script panel
 * shows — the whole flow, or just the branch being recorded — so the canvas and
 * the panel always agree on which steps are on screen.
 */
export function buildFlowBadges(flow: Flow, rows: readonly FlowOutlineRow[]): FlowBadges {
  const nodeLabels = new Map<string, string[]>();
  const edgeLabels = new Map<string, string[]>();
  const badgedNodeIds = new Set<string>();
  const badgedEdgeIds = new Set<string>();

  const push = (map: Map<string, string[]>, key: string, label: string) => {
    const labels = map.get(key);
    if (labels) labels.push(label);
    else map.set(key, [label]);
  };

  let lastStep: FlowStep | undefined;
  for (const row of rows) {
    const step = flow.steps[row.stepId];
    if (!step) continue;
    lastStep = step;
    if (step.componentId) {
      badgedNodeIds.add(step.componentId);
      push(nodeLabels, step.componentId, row.label);
    }
    if (step.connectionId) {
      badgedEdgeIds.add(step.connectionId);
      push(edgeLabels, step.connectionId, row.label);
    }
  }

  return {
    nodeLabels,
    edgeLabels,
    badgedNodeIds,
    badgedEdgeIds,
    lastNodeId: lastStep?.componentId ?? null,
    lastEdgeId: lastStep?.connectionId ?? null,
    lastHandleId: lastStep?.handleId ?? null,
  };
}
