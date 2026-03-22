import type { Component } from "../model/component.types";
import type { Connection, ConnectionIntent } from "../model/connection.types";
import type { Flow, FlowStep } from "../model/flow.types";

const INTENT_ARROW: Record<ConnectionIntent, string> = {
  dependency: "-->",
  call: "->>",
  event: "-->>",
  "data-flow": "=>>",
  "async-message": "-->>",
};

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

  function emitStep(step: FlowStep) {
    if (step.connectionId) {
      const conn = connections[step.connectionId];
      if (conn) {
        const src = components[conn.sourceId]?.name ?? "?";
        const tgt = components[conn.targetId]?.name ?? "?";
        const arrow = step.isAsync ? "-)" : INTENT_ARROW[conn.intent ?? "call"];
        lines.push(`  ${src}${arrow}${tgt}: ${conn.label}`);
        if (step.description) {
          lines.push(`  Note over ${src}: ${step.description}`);
        }
        if (step.payload) {
          if (step.payloadDirection === 'response') {
            lines.push(`  Note over ${tgt},${src}: ← ${step.payload}`);
          } else {
            lines.push(`  Note over ${src},${tgt}: → ${step.payload}`);
          }
        }
        if (step.duration) {
          lines.push(`  Note right of ${tgt}: ${step.duration}`);
        }
      }
    } else if (step.componentId) {
      const name = components[step.componentId]?.name ?? "?";
      lines.push(`  Note over ${name}: ${step.description || step.id}`);
      if (step.duration) {
        lines.push(`  Note right of ${name}: ${step.duration}`);
      }
    }
  }

  function walk(stepId: string) {
    if (visited.has(stepId)) return;
    visited.add(stepId);

    const step = flow.steps[stepId];
    if (!step) return;

    if (step.type === 'condition' && step.branches && step.branches.length > 0) {
      lines.push(`  alt ${step.conditionLabel ?? "condition"}`);
      step.branches.forEach((branch, i) => {
        if (i > 0) lines.push(`  else ${branch.label}`);
        else lines.push(`  Note over ${step.conditionLabel ?? "condition"}: ${branch.label}`);
        walk(branch.nextId);
      });
      lines.push("  end");
    } else {
      emitStep(step);
      if (step.next) walk(step.next);
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
      steps[id] = { id, type: 'action', componentId: compId, note };
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
        type: 'action',
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
    steps[stepIds[i]].next = stepIds[i + 1];
  }

  return steps;
}
