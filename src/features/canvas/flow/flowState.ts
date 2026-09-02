import type { Flow, FlowOutlineRow, FlowStep } from "@/features/diagram";
import {
  getStepById,
  getFlowParticipants,
  getStepCount,
  isConditionStep,
} from "@/features/diagram";

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

export interface FlowProgress {
  /** Steps walked so far, counting the one on screen. */
  position: number;
  /** How long this reading will be if it runs on from here. */
  pathTotal: number;
  /** A choice still lies ahead, so `pathTotal` is a floor rather than the answer. */
  openEnded: boolean;
  /** Every step the script holds, whichever way a reading goes. */
  flowTotal: number;
}

/**
 * The shortest number of steps still ahead, and whether a choice is among them.
 *
 * Shortest, because at a branch nobody knows yet which way the reader will go:
 * a floor is honest where a guess is not, and `openEnded` says a floor is what
 * it is. Successors are followed breadth-first through the graph with the path
 * so far guarding against a cycle.
 */
function stepsAhead(flow: Flow, fromId: string): { count: number; hasChoice: boolean } {
  const memo = new Map<string, number>();
  let hasChoice = false;

  const walk = (id: string, onPath: Set<string>): number => {
    if (onPath.has(id)) return Number.POSITIVE_INFINITY;
    const cached = memo.get(id);
    if (cached !== undefined) return cached;

    const step = flow.steps[id];
    if (!step) return 0;
    if (isConditionStep(step)) hasChoice = true;

    const successors = step.branches?.length
      ? step.branches.map((branch) => branch.nextId)
      : step.next
        ? [step.next]
        : [];

    let best = 0;
    if (successors.length > 0) {
      onPath.add(id);
      best = Number.POSITIVE_INFINITY;
      for (const nextId of successors) {
        const ahead = walk(nextId, onPath);
        if (ahead + 1 < best) best = ahead + 1;
      }
      onPath.delete(id);
      if (!Number.isFinite(best)) best = 0;
    }

    memo.set(id, best);
    return best;
  };

  return { count: walk(fromId, new Set<string>()), hasChoice };
}

/**
 * Where the reader is, counted along the path they actually walked.
 *
 * The denominator used to be every step the script holds, so a reading that
 * took a branch ended short of it — "4 / 5", as if a step had been skipped —
 * and could even overshoot on the way, because the numerator was the step's
 * position in a depth-first listing rather than in the reading. Both numbers
 * now describe the path; the script's own total goes alongside, and in a flow
 * with no branches the two are the same number and nothing looks different.
 */
export function describeFlowProgress(
  flow: Flow,
  currentStepId: string | null,
  history: readonly string[],
): FlowProgress {
  const flowTotal = getStepCount(flow);
  if (!currentStepId || !flow.steps[currentStepId]) {
    return { position: 0, pathTotal: flowTotal, openEnded: false, flowTotal };
  }
  const position = history.length + 1;
  const { count, hasChoice } = stepsAhead(flow, currentStepId);
  return { position, pathTotal: position + count, openEnded: hasChoice, flowTotal };
}
