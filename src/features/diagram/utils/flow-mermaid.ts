import type { Component, Connection, ConnectionIntent, FlowStep } from "../model/diagram.types";

const INTENT_ARROW: Record<ConnectionIntent, string> = {
  dependency: "-->",
  call: "->>",
  event: "-->>",
  "data-flow": "=>>",
  "async-message": "-->>",
};

export function stepsToMermaid(
  steps: FlowStep[],
  components: Record<string, Component>,
  connections: Record<string, Connection>,
): string {
  const lines = ["sequenceDiagram"];
  steps.forEach((step) => {
    if (step.connectionId) {
      const conn = connections[step.connectionId];
      if (conn) {
        const src = components[conn.sourceId]?.name ?? "?";
        const tgt = components[conn.targetId]?.name ?? "?";
        const arrow = INTENT_ARROW[conn.intent ?? "call"];
        lines.push(`  ${src}${arrow}${tgt}: ${conn.label}`);
        if (step.description) {
          lines.push(`  Note over ${src}: ${step.description}`);
        }
        if (step.duration) {
          lines.push(`  Note right of ${tgt}: ${step.duration}`);
        }
      }
    } else if (step.componentId) {
      const name = components[step.componentId]?.name ?? "?";
      lines.push(`  Note over ${name}: ${step.description || `step ${step.order + 1}`}`);
      if (step.duration) {
        lines.push(`  Note right of ${name}: ${step.duration}`);
      }
    }
  });
  return lines.join("\n");
}

export function parseMermaidToSteps(
  mermaid: string,
  components: Record<string, Component>,
  connections: Record<string, Connection>,
): FlowStep[] {
  const steps: FlowStep[] = [];
  const compByName = new Map<string, string>();
  for (const c of Object.values(components)) {
    compByName.set(c.name.toLowerCase(), c.id);
  }

  const lines = mermaid
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  let order = 0;

  for (const line of lines) {
    const noteMatch = line.match(/^Note\s+over\s+([^:]+):\s*(.+)$/i);
    if (noteMatch) {
      const name = noteMatch[1].trim().toLowerCase();
      const note = noteMatch[2].trim();
      const compId = compByName.get(name);
      steps.push({ order: order++, componentId: compId, note });
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

      steps.push({
        order: order++,
        componentId: srcId,
        connectionId: connId,
        note: label,
      });
      continue;
    }
  }

  return steps;
}
