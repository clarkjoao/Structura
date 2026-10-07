import ELK from "elkjs/lib/elk.bundled.js";
import type { ElkNode } from "elkjs/lib/elk-api";
import type { ViewBox, ViewLayoutGraph, ViewLayoutResult } from "./generated/opscr-mapping";

/**
 * Mirrors `ELK_OPTIONS_INTERACTIVE` in the host's
 * `src/features/canvas/layout/layoutEngine.ts`: a plugin cannot import the host, and a
 * dozen constants are cheaper to copy than a shared module with one consumer. Keep them
 * in step when the host's change.
 */
const ELK_OPTIONS: Record<string, string> = {
  "elk.algorithm": "layered",
  "elk.direction": "RIGHT",
  "elk.edgeRouting": "ORTHOGONAL",
  "elk.layered.spacing.nodeNodeBetweenLayers": "220",
  "elk.spacing.nodeNode": "110",
  "elk.spacing.edgeNode": "40",
  "elk.spacing.edgeEdge": "25",
  "elk.layered.nodePlacement.strategy": "BRANDES_KOEPF",
  "elk.padding": "[top=40,left=40,bottom=40,right=40]",
  "elk.hierarchyHandling": "INCLUDE_CHILDREN",
};

const ROOT_ID = "__opscr_layout_root__";

/** Input order is not information: sorting by id makes the layout deterministic. */
const byId = <T extends { id: string }>(items: readonly T[]): T[] =>
  [...items].sort((a, b) => a.id.localeCompare(b.id));

/**
 * Lays out the view's graph and returns each node's box relative to its parent. Edge routes
 * are not returned: the import API has nowhere to put them, the canvas routes connections.
 */
export async function layoutView(graph: ViewLayoutGraph): Promise<ViewLayoutResult> {
  const nodes = byId(graph.nodes);
  const present = new Set(nodes.map((n) => n.id));
  const children = new Map<string | null, typeof nodes>();
  for (const node of nodes) {
    const parent = node.parentId !== null && present.has(node.parentId) ? node.parentId : null;
    children.set(parent, [...(children.get(parent) ?? []), node]);
  }

  const visited = new Set<string>();
  const build = (node: (typeof nodes)[number]): ElkNode => {
    const kids = visited.has(node.id) ? [] : (children.get(node.id) ?? []);
    visited.add(node.id);
    return kids.length === 0
      ? { id: node.id, width: node.width, height: node.height }
      : {
          id: node.id,
          width: node.width,
          height: node.height,
          layoutOptions: ELK_OPTIONS,
          children: kids.map(build),
        };
  };

  const laidOut = await new ELK().layout({
    id: ROOT_ID,
    layoutOptions: ELK_OPTIONS,
    children: (children.get(null) ?? []).map(build),
    edges: byId(graph.edges)
      .filter((e) => present.has(e.sourceId) && present.has(e.targetId))
      .map((e) => ({ id: e.id, sources: [e.sourceId], targets: [e.targetId] })),
  });

  const boxes = new Map<string, ViewBox>();
  const collect = (node: ElkNode): void => {
    if (node.id !== ROOT_ID) {
      boxes.set(node.id, {
        x: node.x ?? 0,
        y: node.y ?? 0,
        width: node.width ?? 0,
        height: node.height ?? 0,
      });
    }
    for (const child of node.children ?? []) collect(child);
  };
  collect(laidOut);
  return { boxes, edgeRoutes: new Map() };
}
