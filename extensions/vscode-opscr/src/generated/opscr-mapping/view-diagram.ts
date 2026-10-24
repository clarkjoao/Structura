/**
 * AUTO-GENERATED — DO NOT EDIT BY HAND.
 * Verbatim copy of the host's src/lib/opscr-mapping, synced via `npm run sync-shared`.
 * Edit the host files and re-sync instead of changing this file.
 */

import { elementFor } from "./elements";
import type { OpscrWorkspaceInput, TechnicalView, ViewEdge, ViewElement, ViewNode } from "./types";

/**
 * What `opscr/core`'s `resolveView` returns, restated structurally (this library imports
 * nothing from opscr): the boxes and lines one View shows, already chosen and lifted by opscr.
 * Layout is Structura's.
 */
export interface ResolvedViewInput {
  name: string;
  type: string;
  scope: string;
  nodes: ReadonlyArray<{
    id: string;
    kind: string;
    name: string;
    parent: string | null;
    collapsed: boolean;
    drillDown?: string;
  }>;
  edges: ReadonlyArray<{
    from: string;
    to: string;
    type: string;
    descriptions: readonly string[];
  }>;
}

/** `DeploymentNode.spec.type` → Structura panel kind; the rest are plain panels. */
const NODE_PANEL_KINDS: Readonly<Record<string, string>> = {
  availabilityZone: "availability-zone",
  vpc: "vpc",
  publicSubnet: "public-subnet",
  privateSubnet: "private-subnet",
};

const text = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() !== "" ? value : undefined;

/** How a node of a resolved view is drawn. */
function elementOf(
  kind: string,
  spec: Record<string, unknown>,
  node: { collapsed: boolean },
  holdsChildren: boolean,
): ViewElement {
  switch (kind) {
    case "Person":
      return { type: "person" };
    case "Component": {
      const technology = text(spec["technology"]);
      return technology ? { type: "component", technology } : { type: "component" };
    }
    case "DeploymentNode": {
      const panelKind = NODE_PANEL_KINDS[String(spec["type"])];
      return panelKind ? { type: "panel", panelKind } : { type: "panel" };
    }
    case "BoundedContext":
    case "Domain":
      // Seen from outside it is a system box; opened up, it is the panel around its contents.
      return node.collapsed || !holdsChildren ? { type: "system" } : { type: "panel" };
    default:
      return holdsChildren ? { type: "panel" } : elementFor({ kind, metadata: { name: "" }, spec });
  }
}

/**
 * One opscr View as a Structura view: the same shape `buildTechnicalView` returns, so layout,
 * stabilizing and the importer graph work on it unchanged. Never throws; a node whose
 * manifest is missing from the workspace is skipped.
 */
export function buildViewDiagram(
  workspace: OpscrWorkspaceInput,
  view: ResolvedViewInput,
): TechnicalView {
  const manifests = new Map(workspace.manifests.map((m) => [`${m.kind}/${m.metadata.name}`, m]));
  const known = view.nodes.filter((n) => manifests.has(n.id));
  const knownIds = new Set(known.map((n) => n.id));
  const parents = new Set(known.map((n) => n.parent).filter((p): p is string => p !== null));

  const nodes = known.map((n): ViewNode => {
    const manifest = manifests.get(n.id)!;
    const holdsChildren = parents.has(n.id);
    const element = elementOf(n.kind, manifest.spec, n, holdsChildren);
    return {
      id: n.id,
      kind: n.kind,
      name: n.name,
      description: text(manifest.spec["description"]) ?? "",
      parentId: n.parent !== null && knownIds.has(n.parent) ? n.parent : null,
      isBoundary: element.type === "panel",
      element,
      ...(n.drillDown !== undefined ? { drillDown: n.drillDown } : {}),
    };
  });

  const edges = view.edges
    .filter((e) => knownIds.has(e.from) && knownIds.has(e.to))
    .map(
      (e): ViewEdge => ({
        id: `${view.name}:${e.from}|${e.to}|${e.type}`,
        sourceId: e.from,
        targetId: e.to,
        type: e.type,
        description: e.descriptions.join("; "),
      }),
    );

  return { nodes, edges, omitted: [], dropped: [] };
}
