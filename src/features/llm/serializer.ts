import type { Connection, Diagram, SceneDiff } from "@/features/diagram";

function sortConnections(connectionA: Connection, connectionB: Connection): number {
  return connectionA.id.localeCompare(connectionB.id);
}

export interface DiagramSerializerOptions {
  includeMetadata?: boolean;
  includeLinks?: boolean;
  activeScene?: SceneDiff;
}

export function serializeDiagramContext(
  diagram: Diagram,
  options: DiagramSerializerOptions = {},
): string {
  const { includeMetadata = true, includeLinks = true, activeScene } = options;
  const components = Object.values(diagram.snapshot.components).sort((componentA, componentB) =>
    componentA.id.localeCompare(componentB.id),
  );
  const connections = Object.values(diagram.snapshot.connections).sort(sortConnections);

  const lines: string[] = [];
  lines.push(`Diagram: ${diagram.name}`);
  lines.push(`Nodes (${components.length})`);
  for (const component of components) {
    const label =
      typeof component.name === "string" && component.name.trim().length > 0
        ? component.name
        : component.id;
    lines.push(
      `- id=${component.id}; type=${component.type}; label=${label}; parent=${component.parentId ?? "none"}`,
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

  if (activeScene) {
    const scene = activeScene;
    lines.push("");
    lines.push(`Active Scene: "${scene.name}"`);

    const addedComponents = Object.values(scene.addedComponents).sort((componentA, componentB) =>
      componentA.id.localeCompare(componentB.id),
    );
    if (addedComponents.length > 0) {
      lines.push(`Nodes added in this scene (${addedComponents.length}):`);
      for (const component of addedComponents) {
        const label =
          typeof component.name === "string" && component.name.trim().length > 0
            ? component.name
            : component.id;
        lines.push(`- id=${component.id}; type=${component.type}; label=${label}`);
      }
    }

    const removedSorted = [...scene.removedComponentIds].sort((idA, idB) => idA.localeCompare(idB));
    if (removedSorted.length > 0) {
      lines.push(`Nodes removed in this scene (${removedSorted.length}):`);
      for (const id of removedSorted) {
        lines.push(`- id=${id}`);
      }
    }

    const addedConnections = Object.values(scene.addedConnections).sort((connectionA, connectionB) =>
      connectionA.id.localeCompare(connectionB.id),
    );
    if (addedConnections.length > 0) {
      lines.push(`Edges added in this scene (${addedConnections.length}):`);
      for (const conn of addedConnections) {
        lines.push(
          `- id=${conn.id}; source=${conn.sourceId}; target=${conn.targetId}; label=${conn.label || "none"}`,
        );
      }
    }
  }

  return lines.join("\n");
}
