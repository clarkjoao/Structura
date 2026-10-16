import type { Connection, Diagram, VersionDiff } from "@/features/diagram";
import { resolveCloudServiceId } from "@/features/diagram/model/cloud-service-id";
import { isSharedRefComponent } from "@/features/diagram/model/component.guards";
import { resolveShared } from "@/features/diagram/utils/shared";

function sortConnections(connectionA: Connection, connectionB: Connection): number {
  return connectionA.id.localeCompare(connectionB.id);
}

export interface DiagramSerializerOptions {
  includeMetadata?: boolean;
  includeLinks?: boolean;
  activeVersion?: VersionDiff;
}

type Components = Diagram["snapshot"]["components"];
type SerializedComponent = Components[string];

function headerLines(diagram: Diagram, includeMetadata: boolean): string[] {
  const lines = [`Diagram: ${diagram.name}`];
  if (includeMetadata && diagram.description?.trim()) {
    lines.push(`Description: ${diagram.description.trim()}`);
  }
  lines.push(`Level: ${diagram.level ?? "unknown"}`);
  if (includeMetadata && diagram.domain?.trim()) {
    lines.push(`Domain: ${diagram.domain.trim()}`);
  }
  return lines;
}

function apiGroupParts(comp: Record<string, unknown>): string[] {
  const ag = comp as { basePath?: string; protocol?: string; sla?: string };
  const parts: string[] = [];
  if (ag.basePath) parts.push(`basePath="${ag.basePath}"`);
  if (ag.protocol) parts.push(`protocol=${ag.protocol}`);
  if (ag.sla) parts.push(`sla="${ag.sla}"`);
  return parts;
}

function dbTableParts(comp: Record<string, unknown>): string[] {
  const dt = comp as {
    tableName?: string;
    columns?: Array<{ name: string; dataType: string; isPrimaryKey?: boolean }>;
  };
  const parts: string[] = [];
  if (dt.tableName) parts.push(`table="${dt.tableName}"`);
  if (dt.columns && dt.columns.length > 0) {
    const pkCols = dt.columns.filter((c) => c.isPrimaryKey).map((c) => c.name);
    parts.push(`columns=${dt.columns.length}${pkCols.length ? ` (pk: ${pkCols.join(",")})` : ""}`);
  }
  return parts;
}

function descriptiveParts(comp: Record<string, unknown>): string[] {
  const parts: string[] = [];
  if (typeof comp.technology === "string" && comp.technology.trim()) {
    parts.push(`technology="${comp.technology.trim()}"`);
  }
  if (typeof comp.description === "string" && comp.description.trim()) {
    parts.push(`description="${comp.description.trim().slice(0, 120)}"`);
  }
  if (Array.isArray(comp.tags) && comp.tags.length > 0) {
    parts.push(`tags=[${(comp.tags as string[]).join(", ")}]`);
  }
  return parts;
}

function nodeLine(component: SerializedComponent): string {
  const label =
    typeof component.name === "string" && component.name.trim().length > 0
      ? component.name
      : component.id;

  const parts: string[] = [`id=${component.id}`, `type=${component.type}`, `name="${label}"`];

  if (component.parentId) parts.push(`parent=${component.parentId}`);
  if (component.shared && component.shared.mode !== "edges") {
    parts.push(`shared=${component.shared.mode}`);
  }

  const comp = component as unknown as Record<string, unknown>;
  parts.push(...descriptiveParts(comp));
  const cloudService = resolveCloudServiceId(component);
  if (cloudService) {
    // Keep the LLM-facing key name stable; the value may come from any field.
    parts.push(`awsService="${cloudService}"`);
  }
  if (component.type === "api-group") parts.push(...apiGroupParts(comp));
  if (component.type === "db-table") parts.push(...dbTableParts(comp));

  return `  - ${parts.join("; ")}`;
}

function connectionLine(connection: Connection, byId: Components): string {
  const parts: string[] = [
    `id=${connection.id}`,
    `from=${resolveShared(connection.sourceId, byId)}`,
    `to=${resolveShared(connection.targetId, byId)}`,
  ];
  if (connection.label) parts.push(`label="${connection.label}"`);
  if (connection.technology) parts.push(`technology="${connection.technology}"`);
  if (connection.description?.trim()) {
    parts.push(`description="${connection.description.trim().slice(0, 80)}"`);
  }
  if (connection.intent) parts.push(`intent=${connection.intent}`);
  if (connection.transportPreset) parts.push(`transport=${connection.transportPreset}`);

  return `  - ${parts.join("; ")}`;
}

function externalLinkLines(components: SerializedComponent[]): string[] {
  const externalLinks = components.flatMap(
    (c) => (c as { externalLinks?: Array<{ label: string; url: string }> }).externalLinks ?? [],
  );
  if (externalLinks.length === 0) return [];
  return [`\nExternal Links:`, ...externalLinks.map((link) => `  - ${link.label}: ${link.url}`)];
}

function versionLines(activeVersion: VersionDiff): string[] {
  const lines = [`\nActive Version: "${activeVersion.name}"`];
  const addedComponents = Object.values(activeVersion.addedComponents);
  if (addedComponents.length > 0) {
    lines.push(`  Added in version: ${addedComponents.map((c) => c.name || c.id).join(", ")}`);
  }
  if (activeVersion.removedComponentIds.length > 0) {
    lines.push(`  Removed in version: ${activeVersion.removedComponentIds.join(", ")}`);
  }

  const addedConnections = Object.values(activeVersion.addedConnections).sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  if (addedConnections.length > 0) {
    lines.push(`  Edges added in this version (${addedConnections.length}):`);
    for (const conn of addedConnections) {
      lines.push(
        `  - id=${conn.id}; source=${conn.sourceId}; target=${conn.targetId}; label=${conn.label || "none"}`,
      );
    }
  }
  return lines;
}

export function serializeDiagramContext(
  diagram: Diagram,
  options: DiagramSerializerOptions = {},
): string {
  const { includeMetadata = true, includeLinks = true, activeVersion } = options;
  // A reference is a drawing of a shared element, not an element: the model
  // reads the element, and edges to a reference as edges to it.
  const byId = diagram.snapshot.components;
  const components = Object.values(byId)
    .filter((component) => !isSharedRefComponent(component))
    .sort((a, b) => a.id.localeCompare(b.id));
  const connections = Object.values(diagram.snapshot.connections).sort(sortConnections);

  const lines: string[] = headerLines(diagram, includeMetadata);
  lines.push(`\nNodes (${components.length}):`, ...components.map(nodeLine));
  lines.push(
    `\nConnections (${connections.length}):`,
    ...connections.map((connection) => connectionLine(connection, byId)),
  );
  if (includeLinks) lines.push(...externalLinkLines(components));
  if (activeVersion) lines.push(...versionLines(activeVersion));

  return lines.join("\n");
}
