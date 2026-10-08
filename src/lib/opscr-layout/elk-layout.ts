import ELK from "elkjs/lib/elk.bundled.js";
import type { ElkNode } from "elkjs/lib/elk-api";
import type { ViewBox, ViewLayoutGraph, ViewLayoutResult } from "../opscr-mapping";

/**
 * Mirrors `ELK_OPTIONS_INTERACTIVE` in the host's
 * `src/features/canvas/layout/layoutEngine.ts`, which plugins and the VSCode extension
 * cannot import. Keep them in step when the host's change.
 */
const ELK_OPTIONS: Readonly<Record<string, string>> = {
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

/**
 * With a seed, ELK reads the nodes' current coordinates to choose layers and the order
 * within them, so the result stays close to the picture the reader already has.
 */
const SEEDED_OPTIONS: Readonly<Record<string, string>> = {
  "elk.layered.layering.strategy": "INTERACTIVE",
  "elk.layered.crossingMinimization.strategy": "INTERACTIVE",
  "elk.layered.nodePlacement.strategy": "INTERACTIVE",
};

const ROOT_ID = "__opscr_layout_root__";

/** Input order is not information: sorting by id makes the layout deterministic. */
const byId = <T extends { id: string }>(items: readonly T[]): T[] =>
  [...items].sort((a, b) => a.id.localeCompare(b.id));

/**
 * Lays out the view's graph and returns each node's box relative to its parent. Edge routes
 * are not returned: hosts hand positions to the canvas, which routes connections itself.
 *
 * `seed` — boxes from a previous layout, by node id — switches ELK to its interactive
 * strategies; feed the result to `stabilizeLayout` to keep surviving nodes exactly in place.
 */
export async function layoutView(
  graph: ViewLayoutGraph,
  seed?: ReadonlyMap<string, ViewBox>,
): Promise<ViewLayoutResult> {
  const options = seed ? { ...ELK_OPTIONS, ...SEEDED_OPTIONS } : ELK_OPTIONS;
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
    const at = seed?.get(node.id);
    return {
      id: node.id,
      width: node.width,
      height: node.height,
      ...(at ? { x: at.x, y: at.y } : {}),
      ...(kids.length > 0 ? { layoutOptions: options, children: kids.map(build) } : {}),
    };
  };

  const laidOut = await new ELK().layout({
    id: ROOT_ID,
    layoutOptions: options,
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
