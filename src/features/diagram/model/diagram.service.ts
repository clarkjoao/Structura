import type {
  Component,
  Connection,
  FlowStep,
} from "./diagram.types";

export interface ServiceImpact {
  components: Component[];
  connections: Connection[];
  systems: Component[];
}

/**
 * Análise de impacto: componentes, conexões e sistemas afetados por um serviço.
 * Lógica de negócio pura, extraída da UI (ex.: ServiceRegistry).
 */
export function computeServiceImpact(
  serviceId: string,
  components: Component[],
  connections: Connection[],
): ServiceImpact {
  const linkedComps = components.filter((c) => c.serviceId === serviceId);
  const linkedIds = new Set(linkedComps.map((c) => c.id));

  const affectedConns = connections.filter(
    (conn) => linkedIds.has(conn.sourceId) || linkedIds.has(conn.targetId),
  );

  const systemIds = new Set<string>();
  for (const c of linkedComps) {
    if (c.parentId) {
      const parent = components.find((p) => p.id === c.parentId);
      if (parent?.type === "system") systemIds.add(parent.id);
    }
  }
  const systems = components.filter((c) => systemIds.has(c.id));

  return { components: linkedComps, connections: affectedConns, systems };
}

/**
 * Parseia texto Mermaid (fluxo) em steps para Flow.
 * Lógica de negócio pura, usada pela store ao criar/atualizar flows.
 */
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
