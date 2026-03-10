import type {
  Component,
  Connection,
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
