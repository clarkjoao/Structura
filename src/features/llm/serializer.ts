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
  const components = Object.values(diagram.snapshot.components).sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  const connections = Object.values(diagram.snapshot.connections).sort(sortConnections);

  const lines: string[] = [];
  lines.push(`Diagram: ${diagram.name}`);
  if (includeMetadata && diagram.description?.trim()) {
    lines.push(`Description: ${diagram.description.trim()}`);
  }
  lines.push(`Level: ${diagram.level ?? "unknown"}`);
  if (includeMetadata && diagram.domain?.trim()) {
    lines.push(`Domain: ${diagram.domain.trim()}`);
  }

  lines.push(`\nNodes (${components.length}):`);
  for (const component of components) {
    const label =
      typeof component.name === "string" && component.name.trim().length > 0
        ? component.name
        : component.id;

    const parts: string[] = [
      `id=${component.id}`,
      `type=${component.type}`,
      `name="${label}"`,
    ];

    if (component.parentId) parts.push(`parent=${component.parentId}`);

    const comp = component as unknown as Record<string, unknown>;
    if (typeof comp.technology === "string" && comp.technology.trim()) {
      parts.push(`technology="${comp.technology.trim()}"`);
    }
    if (typeof comp.description === "string" && comp.description.trim()) {
      parts.push(`description="${comp.description.trim().slice(0, 120)}"`);
    }
    if (Array.isArray(comp.tags) && comp.tags.length > 0) {
      parts.push(`tags=[${(comp.tags as string[]).join(", ")}]`);
    }
    if (typeof comp.awsService === "string" && comp.awsService) {
      parts.push(`awsService="${comp.awsService}"`);
    }
    if (component.type === "api-group") {
      const ag = comp as { basePath?: string; protocol?: string; sla?: string };
      if (ag.basePath) parts.push(`basePath="${ag.basePath}"`);
      if (ag.protocol) parts.push(`protocol=${ag.protocol}`);
      if (ag.sla) parts.push(`sla="${ag.sla}"`);
    }
    if (component.type === "db-table") {
      const dt = comp as {
        tableName?: string;
        columns?: Array<{ name: string; dataType: string; isPrimaryKey?: boolean }>;
      };
      if (dt.tableName) parts.push(`table="${dt.tableName}"`);
      if (dt.columns && dt.columns.length > 0) {
        const pkCols = dt.columns.filter((c) => c.isPrimaryKey).map((c) => c.name);
        parts.push(
          `columns=${dt.columns.length}${pkCols.length ? ` (pk: ${pkCols.join(",")})` : ""}`,
        );
      }
    }

    lines.push(`  - ${parts.join("; ")}`);
  }

  lines.push(`\nConnections (${connections.length}):`);
  for (const connection of connections) {
    const parts: string[] = [
      `id=${connection.id}`,
      `from=${connection.sourceId}`,
      `to=${connection.targetId}`,
    ];
    if (connection.label) parts.push(`label="${connection.label}"`);
    if (connection.technology) parts.push(`technology="${connection.technology}"`);
    if (connection.description?.trim()) {
      parts.push(`description="${connection.description.trim().slice(0, 80)}"`);
    }
    if (connection.intent) parts.push(`intent=${connection.intent}`);
    if (connection.transportPreset) parts.push(`transport=${connection.transportPreset}`);

    lines.push(`  - ${parts.join("; ")}`);
  }

  if (includeLinks && components.length > 0) {
    const externalLinks = components.flatMap(
      (c) =>
        (c as { externalLinks?: Array<{ label: string; url: string }> }).externalLinks ?? [],
    );
    if (externalLinks.length > 0) {
      lines.push(`\nExternal Links:`);
      for (const link of externalLinks) {
        lines.push(`  - ${link.label}: ${link.url}`);
      }
    }
  }

  if (activeScene) {
    lines.push(`\nActive Scene: "${activeScene.name}"`);
    const addedComponents = Object.values(activeScene.addedComponents);
    if (addedComponents.length > 0) {
      lines.push(`  Added in scene: ${addedComponents.map((c) => c.name || c.id).join(", ")}`);
    }
    if (activeScene.removedComponentIds.length > 0) {
      lines.push(`  Removed in scene: ${activeScene.removedComponentIds.join(", ")}`);
    }

    const addedConnections = Object.values(activeScene.addedConnections).sort((a, b) =>
      a.id.localeCompare(b.id),
    );
    if (addedConnections.length > 0) {
      lines.push(`  Edges added in this scene (${addedConnections.length}):`);
      for (const conn of addedConnections) {
        lines.push(
          `  - id=${conn.id}; source=${conn.sourceId}; target=${conn.targetId}; label=${conn.label || "none"}`,
        );
      }
    }
  }

  return lines.join("\n");
}
