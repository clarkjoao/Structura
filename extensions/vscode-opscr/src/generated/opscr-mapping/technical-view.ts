/**
 * AUTO-GENERATED — DO NOT EDIT BY HAND.
 * Verbatim copy of the host's src/lib/opscr-mapping, synced via `npm run sync-shared`.
 * Edit the host files and re-sync instead of changing this file.
 */

import { BOUNDARY_KINDS, GRAPH_KINDS, elementFor, isDrawnKind } from "./elements";
import type {
  DroppedEdge,
  OpscrManifestInput,
  OpscrWorkspaceInput,
  TechnicalView,
  ViewEdge,
  ViewNode,
} from "./types";

export const nodeId = (kind: string, name: string): string => `${kind}/${name}`;

interface RawEdge {
  relationship: string;
  index: number;
  from: string;
  to: string;
  type: string;
  description: string;
}

function endId(value: unknown): string | null {
  if (typeof value !== "object" || value === null) return null;
  const end = value as Record<string, unknown>;
  return typeof end["kind"] === "string" && typeof end["id"] === "string"
    ? nodeId(end["kind"], end["id"])
    : null;
}

/** Every well-formed edge of every Relationship, in file order. */
function collectEdges(manifests: readonly OpscrManifestInput[]): RawEdge[] {
  return manifests
    .filter((m) => m.kind === "Relationship")
    .flatMap((relationship) => {
      const edges = relationship.spec["edges"];
      if (!Array.isArray(edges)) return [];
      return edges.flatMap((edge: unknown, index): RawEdge[] => {
        if (typeof edge !== "object" || edge === null) return [];
        const e = edge as Record<string, unknown>;
        const from = endId(e["from"]);
        const to = endId(e["to"]);
        if (!from || !to || typeof e["type"] !== "string") return [];
        const description = typeof e["description"] === "string" ? e["description"] : "";
        return [
          {
            relationship: relationship.metadata.name,
            index,
            from,
            to,
            type: e["type"],
            description,
          },
        ];
      });
    });
}

/** Dropped edges, at most once each, in the order they were dropped. */
class DroppedEdges {
  private readonly byId = new Map<string, DroppedEdge>();

  add(edge: RawEdge, reason: DroppedEdge["reason"]): void {
    const id = `${edge.relationship}#${edge.index}`;
    if (this.byId.has(id)) return;
    this.byId.set(id, {
      relationship: edge.relationship,
      index: edge.index,
      from: edge.from,
      to: edge.to,
      type: edge.type,
      reason,
    });
  }

  list(): DroppedEdge[] {
    return [...this.byId.values()];
  }
}

/**
 * Projects an opscr workspace into the technical view: Domains and bounded contexts
 * (ApplicationService) as panels, technical Kinds as elements nested by `belongsTo`,
 * flow edges between them. Subdomain, business and organization Kinds are listed in
 * `omitted`; edges that cannot be drawn are listed in `dropped`. Never throws.
 */
export function buildTechnicalView(workspace: OpscrWorkspaceInput): TechnicalView {
  const kindOf = new Map<string, string>();
  const nodes = new Map<string, ViewNode>();
  const omitted: TechnicalView["omitted"] = [];

  for (const manifest of workspace.manifests) {
    const id = nodeId(manifest.kind, manifest.metadata.name);
    if (kindOf.has(id)) continue; // duplicate names are a compile error; first wins here
    kindOf.set(id, manifest.kind);
    if (GRAPH_KINDS.has(manifest.kind)) continue;
    if (!isDrawnKind(manifest.kind)) {
      omitted.push({ kind: manifest.kind, name: manifest.metadata.name });
      continue;
    }
    const description = manifest.spec["description"];
    nodes.set(id, {
      id,
      kind: manifest.kind,
      name: manifest.metadata.name,
      description: typeof description === "string" ? description : "",
      parentId: null,
      isBoundary: BOUNDARY_KINDS.has(manifest.kind),
      element: elementFor(manifest),
    });
  }

  const edges = collectEdges(workspace.manifests);
  const dropped = new DroppedEdges();

  // Containment: the first belongsTo of each element wins.
  const parentOf = new Map<string, { edge: RawEdge }>();
  for (const edge of edges) {
    if (edge.type !== "belongsTo") continue;
    if (!kindOf.has(edge.from) || !kindOf.has(edge.to)) {
      dropped.add(edge, "missing");
      continue;
    }
    if (parentOf.has(edge.from)) {
      dropped.add(edge, "second-parent");
      continue;
    }
    parentOf.set(edge.from, { edge });
  }

  // A drawn element's parent is its nearest drawn ancestor: an ApplicationService that
  // belongs to a Subdomain lands in that Subdomain's Domain.
  for (const node of nodes.values()) {
    const seen = new Set([node.id]);
    let current = parentOf.get(node.id);
    while (current) {
      const candidate = current.edge.to;
      if (seen.has(candidate)) {
        dropped.add(current.edge, "cycle");
        break;
      }
      seen.add(candidate);
      const parent = nodes.get(candidate);
      if (parent?.isBoundary) {
        node.parentId = candidate;
        break;
      }
      current = parentOf.get(candidate);
    }
  }
  breakCycles(nodes, dropped, parentOf);

  const viewEdges: ViewEdge[] = [];
  for (const edge of edges) {
    if (edge.type === "belongsTo") continue;
    if (!kindOf.has(edge.from) || !kindOf.has(edge.to)) {
      dropped.add(edge, "missing");
      continue;
    }
    if (!nodes.has(edge.from) || !nodes.has(edge.to)) {
      dropped.add(edge, "not-drawn");
      continue;
    }
    viewEdges.push({
      id: `${edge.relationship}#${edge.index}`,
      sourceId: edge.from,
      targetId: edge.to,
      type: edge.type,
      description: edge.description,
    });
  }

  return { nodes: [...nodes.values()], edges: viewEdges, omitted, dropped: dropped.list() };
}

/**
 * Parent links are resolved per node, so two boundaries can still end up each other's
 * ancestor (`a → x` resolved for a, `x → a` for x). Walk the resolved links and cut the
 * one that closes a loop, so no node is its own ancestor.
 */
function breakCycles(
  nodes: Map<string, ViewNode>,
  dropped: DroppedEdges,
  parentOf: Map<string, { edge: RawEdge }>,
): void {
  for (const node of nodes.values()) {
    const seen = new Set<string>([node.id]);
    let current: ViewNode | undefined = node;
    while (current?.parentId) {
      if (seen.has(current.parentId)) {
        const edge = parentOf.get(current.id)?.edge;
        if (edge) dropped.add(edge, "cycle");
        current.parentId = null;
        break;
      }
      seen.add(current.parentId);
      current = nodes.get(current.parentId);
    }
  }
}
