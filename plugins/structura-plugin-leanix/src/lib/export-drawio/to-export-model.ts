import type {
  DiagramSnapshot,
  PluginComponentSnapshot,
  PluginConnectionSnapshot,
} from "../../types/plugin.types";
import type { ExportEdge, ExportModel, ExportNode } from "../../generated/export-core";
import { awsServiceCache } from "./aws-cache";

// The plugin snapshot is flat and lossy (no domain types, no edge styling), so
// kind detection uses the same string heuristics the vendored copy used, and the
// mapper fills the fields the core needs — defaulting what the snapshot lacks.

function isContainerType(type: string): boolean {
  return (
    type === "panel" ||
    type === "group" ||
    type.includes("panel") ||
    type === "apiGroup" ||
    type === "api-group" ||
    type.includes("api")
  );
}

function extractProtocol(c: PluginComponentSnapshot): string {
  for (const tag of c.tags) {
    const lower = tag.toLowerCase();
    if (["http", "https", "rest", "graphql", "websocket", "grpc"].includes(lower)) {
      return lower;
    }
  }
  return "https";
}

function extractMethod(c: PluginComponentSnapshot): string {
  for (const tag of c.tags) {
    const upper = tag.toUpperCase();
    if (["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].includes(upper)) {
      return upper;
    }
  }
  const labelUpper = c.label.toUpperCase();
  for (const method of ["GET", "POST", "PUT", "PATCH", "DELETE"]) {
    if (labelUpper.startsWith(method)) return method;
  }
  return "GET";
}

function awsIconFor(c: PluginComponentSnapshot): string {
  const serviceId = c.serviceId?.replace("aws-", "") ?? c.type.replace("aws-", "");
  return awsServiceCache.getInfo(serviceId).icon;
}

function mapNode(c: PluginComponentSnapshot): ExportNode {
  const base = {
    id: c.id,
    parentId: c.parentId,
    x: c.position?.x ?? 0,
    y: c.position?.y ?? 0,
    width: c.size?.width ?? 0,
    height: c.size?.height ?? 0,
  };
  const type = c.type;
  const lower = type.toLowerCase();

  // Order mirrors the original vendored dispatch (aws before c4, api before endpoint).
  if (type === "panel" || type === "group" || type.includes("panel")) {
    return { ...base, kind: "panel", name: c.label };
  }
  if (type === "apiGroup" || type === "api-group" || type.includes("api")) {
    return {
      ...base,
      kind: "apiGroup",
      serviceName: c.label,
      basePath: "",
      protocol: extractProtocol(c),
    };
  }
  if (type.startsWith("aws-") || (c.serviceId?.startsWith("aws-") ?? false)) {
    return { ...base, kind: "aws", name: c.label, awsIcon: awsIconFor(c) };
  }
  if (lower === "person" || lower === "system" || lower === "container" || lower === "component") {
    return {
      ...base,
      kind: "c4",
      subtype: type,
      name: c.label,
      description: c.description,
      serviceId: c.serviceId ?? undefined,
    };
  }
  if (type === "endpoint" || type === "api-endpoint" || type.includes("endpoint")) {
    return { ...base, kind: "endpoint", method: extractMethod(c), path: c.label };
  }
  if (type === "dbTable" || type === "database" || type.includes("table")) {
    return { ...base, kind: "dbTable", tableName: c.label, columns: [] };
  }
  if (type === "jsonViewer" || type === "json" || type.includes("json")) {
    return { ...base, kind: "jsonViewer", name: c.label, jsonContent: c.description };
  }
  // note + lenient fallback (unknown types render as a note, as the plugin did before)
  return { ...base, kind: "note", name: c.label, description: c.description };
}

/** Infer edge intent from label/description/technology (the snapshot has no intent). */
function inferIntent(conn: PluginConnectionSnapshot): string | undefined {
  const desc = (conn.description ?? "").toLowerCase();
  const tech = (conn.technology ?? "").toLowerCase();
  const label = conn.label.toLowerCase();
  if (desc.includes("sync") || tech.includes("sync") || label.includes("call")) return "call";
  if (desc.includes("event") || tech.includes("event") || label.includes("event")) return "event";
  if (desc.includes("data") || tech.includes("data") || label.includes("data")) return "data-flow";
  if (desc.includes("async") || tech.includes("async") || label.includes("async"))
    return "async-message";
  if (desc.includes("depend") || tech.includes("depend")) return "dependency";
  return undefined;
}

function mapEdge(conn: PluginConnectionSnapshot): ExportEdge {
  return {
    id: conn.id,
    sourceId: conn.sourceId,
    targetId: conn.targetId,
    label: conn.label,
    technology: conn.technology ?? undefined,
    intent: inferIntent(conn),
    edgeStyle: "smoothstep",
    strokeStyle: "solid",
    strokeWidth: 1,
    markerStart: "none",
    markerEnd: "arrow-closed",
  };
}

function expandWithContainerAncestors(
  ids: string[],
  byId: Map<string, PluginComponentSnapshot>,
): Set<string> {
  const out = new Set(ids);
  for (const id of ids) {
    let p = byId.get(id)?.parentId ?? null;
    while (p) {
      const parent = byId.get(p);
      if (!parent) break;
      if (isContainerType(parent.type)) out.add(p);
      p = parent.parentId;
    }
  }
  return out;
}

/**
 * Build the neutral `ExportModel` from a plugin diagram snapshot: applies the
 * optional `componentIds` filter (keeping container ancestors), maps positioned
 * components to nodes, and maps connections whose endpoints both survive.
 */
export function snapshotToExportModel(
  diagram: DiagramSnapshot,
  options?: { componentIds?: string[] },
): ExportModel {
  const shouldFilter = options?.componentIds !== undefined && options.componentIds.length > 0;

  let components: readonly PluginComponentSnapshot[] = diagram.components;
  if (shouldFilter) {
    const byId = new Map(diagram.components.map((c) => [c.id, c]));
    const idSet = expandWithContainerAncestors(options!.componentIds!, byId);
    components = diagram.components.filter((c) => idSet.has(c.id));
  }

  const nodes: ExportNode[] = components.filter((c) => c.position !== null).map(mapNode);
  const nodeIds = new Set(nodes.map((n) => n.id));
  const edges: ExportEdge[] = diagram.connections
    .filter((cn) => nodeIds.has(cn.sourceId) && nodeIds.has(cn.targetId))
    .map(mapEdge);

  return { name: diagram.name, nodes, edges };
}
