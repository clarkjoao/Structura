import type { Connection, Diagram } from "@/features/diagram";

function sortConnections(connectionA: Connection, connectionB: Connection): number {
  return connectionA.id.localeCompare(connectionB.id);
}

export interface DiagramSerializerOptions {
  includeMetadata?: boolean;
  includeLinks?: boolean;
}

export function serializeDiagramContext(
  diagram: Diagram,
  options: DiagramSerializerOptions = {},
): string {
  const { includeMetadata = true, includeLinks = true } = options;
  const components = Object.values(diagram.snapshot.components).sort((componentA, componentB) =>
    componentA.id.localeCompare(componentB.id),
  );
  const connections = Object.values(diagram.snapshot.connections).sort(sortConnections);

  const lines: string[] = [];
  lines.push(`Diagram: ${diagram.name}`);
  lines.push(`Nodes (${components.length})`);
  for (const component of components) {
    lines.push(
      `- id=${component.id}; type=${component.type}; label=${component.name}; parent=${component.parentId ?? "none"}`,
    );
  }

  lines.push(`Edges (${connections.length})`);
  for (const connection of connections) {
    lines.push(
      `- id=${connection.id}; source=${connection.sourceId}; target=${connection.targetId}; label=${connection.label || "none"}`,
    );
  }

  if (includeMetadata) {
    lines.push(`Project: ${diagram.name}`);
    lines.push(`Description: ${diagram.description?.trim() ? diagram.description : "none"}`);
  }

  if (includeLinks) {
    const externalLinks = components.flatMap((component) => component.externalLinks ?? []);
    lines.push(`External Links (${externalLinks.length})`);
    for (const link of externalLinks) {
      lines.push(`- label=${link.label} url=${link.url}`);
    }
  }

  return lines.join("\n");
}

