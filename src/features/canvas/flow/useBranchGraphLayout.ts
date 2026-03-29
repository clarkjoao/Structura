import { useMemo } from "react";
import type { Flow, FlowStep, Component, Connection } from "@/features/diagram";
import { isConditionStep, isFlowLinkStep } from "@/features/diagram";

export interface GraphNode {
  id: string;
  step: FlowStep;
  lane: number;
  seq: number;
  label: string;
}

export interface GraphEdge {
  fromId: string;
  toId: string;
  fromLane: number;
  toLane: number;
  fromSeq: number;
  toSeq: number;
  branchLabel?: string;
}

export interface GraphLayout {
  nodes: GraphNode[];
  edges: GraphEdge[];
  totalLanes: number;
  totalSeq: number;
}

function makeStepLabel(
  step: FlowStep,
  components: Record<string, Component>,
  connections: Record<string, Connection>,
): string {
  if (isFlowLinkStep(step)) {
    return `→ ${step.targetFlowName}`;
  }
  if (isConditionStep(step)) {
    return step.conditionLabel ?? "Condition";
  }
  if (step.connectionId) {
    const conn = connections[step.connectionId];
    if (conn?.label) return conn.label;
  }
  if (step.componentId) {
    return components[step.componentId]?.name ?? "Step";
  }
  return "Step";
}

export function computeBranchGraphLayout(
  flow: Flow | null,
  components: Record<string, Component>,
  connections: Record<string, Connection>,
): GraphLayout {
  const empty: GraphLayout = { nodes: [], edges: [], totalLanes: 1, totalSeq: 0 };
  if (!flow || !flow.entryStepId) return empty;

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  let maxLane = 0;
  const visited = new Set<string>();

  function walk(stepId: string, lane: number, seq: number): void {
    if (!stepId || visited.has(stepId)) return;
    const step = flow.steps[stepId];
    if (!step) return;

    visited.add(stepId);
    nodes.push({
      id: stepId,
      step,
      lane,
      seq,
      label: makeStepLabel(step, components, connections),
    });

    if (isConditionStep(step)) {
      for (let i = 0; i < step.branches.length; i++) {
        const branch = step.branches[i];
        if (!branch.nextId) continue;
        const childLane = i === 0 ? lane : ++maxLane;
        edges.push({
          fromId: stepId,
          toId: branch.nextId,
          fromLane: lane,
          toLane: childLane,
          fromSeq: seq,
          toSeq: seq + 1,
          branchLabel: branch.label,
        });
        walk(branch.nextId, childLane, seq + 1);
      }
    } else if (!isFlowLinkStep(step) && step.next) {
      edges.push({
        fromId: stepId,
        toId: step.next,
        fromLane: lane,
        toLane: lane,
        fromSeq: seq,
        toSeq: seq + 1,
      });
      walk(step.next, lane, seq + 1);
    }
  }

  walk(flow.entryStepId, 0, 0);

  const maxSeq = nodes.length > 0 ? Math.max(...nodes.map((n) => n.seq)) : 0;

  return {
    nodes,
    edges,
    totalLanes: maxLane + 1,
    totalSeq: maxSeq + 1,
  };
}

export function useBranchGraphLayout(
  flow: Flow | null,
  components: Record<string, Component>,
  connections: Record<string, Connection>,
): GraphLayout {
  return useMemo(
    () => computeBranchGraphLayout(flow, components, connections),
    [flow, components, connections],
  );
}
