import type { Component } from "../model/component.types";
import type { Connection, ConnectionIntent } from "../model/connection.types";
import type { Flow, FlowStep } from "../model/flow.types";
import { isFlowLinkStep } from "../model/flow.types";
import { isConditionStep } from "./flow-traversal";

const INTENT_ARROW: Record<ConnectionIntent, string> = {
  dependency: "-->",
  call: "->>",
  event: "-->>",
  "data-flow": "=>>",
  "async-message": "-->>",
};

function toAlias(name: string): string {
  return (
    name
      .replace(/[^a-zA-Z0-9\s]/g, "")
      .split(/\s+/)
      .map((word) => word[0]?.toUpperCase() ?? "")
      .join("")
      .slice(0, 6) || "P"
  );
}

function buildParticipantAliasMap(
  steps: FlowStep[],
  components: Record<string, Component>,
  connections: Record<string, Connection>,
): Map<string, string> {
  const namesOrdered: string[] = [];
  const seen = new Set<string>();

  const addName = (name: string) => {
    if (!seen.has(name)) {
      seen.add(name);
      namesOrdered.push(name);
    }
  };

  for (const step of steps) {
    if (isFlowLinkStep(step)) {
      addName(step.targetFlowName);
      continue;
    }
    if (step.componentId) {
      const name = components[step.componentId]?.name;
      if (name) addName(name);
    }
    if (step.connectionId) {
      const conn = connections[step.connectionId];
      if (conn) {
        const srcName = components[conn.sourceId]?.name;
        const tgtName = components[conn.targetId]?.name;
        if (srcName) addName(srcName);
        if (tgtName) addName(tgtName);
      }
    }
  }

  const aliasMap = new Map<string, string>();
  const usedAliases = new Set<string>();

  for (const name of namesOrdered) {
    let alias = toAlias(name);
    let counter = 2;
    while (usedAliases.has(alias)) {
      alias = `${toAlias(name)}${counter}`;
      counter += 1;
    }
    usedAliases.add(alias);
    aliasMap.set(name, alias);
  }

  return aliasMap;
}

/**
 * Walk the flow graph starting from entryStepId and produce Mermaid sequence diagram text.
 */
export function stepsToMermaid(
  flow: Flow,
  components: Record<string, Component>,
  connections: Record<string, Connection>,
): string {
  const lines = ["sequenceDiagram"];
  const visited = new Set<string>();

  const orderedSteps: FlowStep[] = [];
  const collectVisited = new Set<string>();

  function collectSteps(stepId: string) {
    if (!stepId || collectVisited.has(stepId)) return;
    collectVisited.add(stepId);
    const step = flow.steps[stepId];
    if (!step) return;
    orderedSteps.push(step);
    if (isFlowLinkStep(step)) return;
    if (isConditionStep(step)) {
      step.branches.forEach((branch) => collectSteps(branch.nextId));
      return;
    }
    if (step.next) collectSteps(step.next);
  }

  if (flow.entryStepId) collectSteps(flow.entryStepId);

  const aliasMap = buildParticipantAliasMap(orderedSteps, components, connections);

  aliasMap.forEach((participantAlias, name) => {
    lines.push(`  participant ${participantAlias} as ${name}`);
  });

  const alias = (name: string) => aliasMap.get(name) ?? name;

  function emitStep(step: FlowStep, indent = "  ") {
    if (isFlowLinkStep(step)) {
      // Terminal leaf that points to another flow (possibly cross-diagram).
      // Mermaid sequence diagrams don't have native "link nodes", so we render a labeled terminal node.
      lines.push(`${indent}${step.id}[\"→ ${step.targetFlowName}\"]`);
      return;
    }
    if (step.connectionId) {
      const connection = connections[step.connectionId];
      if (connection) {
        const sourceName = components[connection.sourceId]?.name ?? "?";
        const targetName = components[connection.targetId]?.name ?? "?";
        const arrow = step.isAsync ? "-)" : INTENT_ARROW[connection.intent ?? "call"];
        lines.push(`${indent}${alias(sourceName)}${arrow}${alias(targetName)}: ${connection.label}`);
        if (step.description) {
          lines.push(`${indent}Note over ${alias(sourceName)}: ${step.description}`);
        }
        if (step.payload) {
          const payloadNote =
            step.payloadDirection === "response"
              ? `${indent}Note over ${alias(targetName)},${alias(sourceName)}: ← ${step.payload}`
              : `${indent}Note over ${alias(sourceName)},${alias(targetName)}: → ${step.payload}`;
          lines.push(payloadNote);
        }
        if (step.duration) {
          lines.push(`${indent}Note right of ${alias(targetName)}: ${step.duration}`);
        }
      }
    } else if (step.componentId) {
      const componentName = components[step.componentId]?.name ?? "?";
      const content = step.note ?? step.description;
      if (content) {
        lines.push(`${indent}Note over ${alias(componentName)}: ${content}`);
      }
      if (step.payload) {
        const payloadNote =
          step.payloadDirection === "response"
            ? `${indent}Note over ${alias(componentName)}: ← ${step.payload}`
            : `${indent}Note over ${alias(componentName)}: → ${step.payload}`;
        lines.push(payloadNote);
      }
      if (step.duration) {
        lines.push(`${indent}Note right of ${alias(componentName)}: ${step.duration}`);
      }
    }
  }

  function walk(stepId: string, indent = "  ") {
    if (visited.has(stepId)) return;
    visited.add(stepId);

    const step = flow.steps[stepId];
    if (!step) return;

    if (isConditionStep(step)) {
      lines.push(`${indent}alt ${step.conditionLabel ?? "condition"}`);
      step.branches.forEach((branch, branchIndex) => {
        if (branchIndex > 0) lines.push(`${indent}else ${branch.label}`);
        walk(branch.nextId, `${indent}  `);
      });
      lines.push(`${indent}end`);
    } else {
      emitStep(step, indent);
      if (!isFlowLinkStep(step) && step.next) walk(step.next, indent);
    }
  }

  if (flow.entryStepId) walk(flow.entryStepId);

  return lines.join("\n");
}

/**
 * @deprecated Use the graph-based flow model. This is kept for backward compatibility
 * during migration but should not be used for new code.
 */
export function parseMermaidToSteps(
  mermaid: string,
  components: Record<string, Component>,
  connections: Record<string, Connection>,
): Record<string, FlowStep> {
  const steps: Record<string, FlowStep> = {};
  const compByName = new Map<string, string>();
  for (const c of Object.values(components)) {
    compByName.set(c.name.toLowerCase(), c.id);
  }

  const mermaidLines = mermaid
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  let order = 0;
  const stepIds: string[] = [];

  for (const line of mermaidLines) {
    const noteMatch = line.match(/^Note\s+over\s+([^:]+):\s*(.+)$/i);
    if (noteMatch) {
      const name = noteMatch[1].trim().toLowerCase();
      const note = noteMatch[2].trim();
      const compId = compByName.get(name);
      const id = `parsed-${order}`;
      stepIds.push(id);
      steps[id] = { id, type: "action", componentId: compId, note };
      order++;
      continue;
    }

    const arrowMatch = line.match(/^(.+?)\s*->>?\s*(.+?):\s*(.+)$/);
    if (arrowMatch) {
      const srcName = arrowMatch[1].trim().toLowerCase();
      const tgtName = arrowMatch[2].trim().toLowerCase();
      const label = arrowMatch[3].trim();
      const srcId = compByName.get(srcName);
      const tgtId = compByName.get(tgtName);

      let connId: string | undefined;
      if (srcId && tgtId) {
        const conn = Object.values(connections).find(
          (c) => c.sourceId === srcId && c.targetId === tgtId,
        );
        connId = conn?.id;
      }

      const id = `parsed-${order}`;
      stepIds.push(id);
      steps[id] = {
        id,
        type: "action",
        componentId: srcId,
        connectionId: connId,
        note: label,
      };
      order++;
      continue;
    }
  }

  // Link sequentially
  for (let i = 0; i < stepIds.length - 1; i++) {
    const step = steps[stepIds[i]];
    if (!step || isFlowLinkStep(step) || isConditionStep(step)) continue;
    step.next = stepIds[i + 1];
  }

  return steps;
}
