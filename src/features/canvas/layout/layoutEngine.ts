import type { ElkExtendedEdge, ElkNode } from "elkjs";
import { readLaidOutGraph } from "./layoutReadability";
import { readElkHandleOrder } from "./elkHandleOrder";
import type {
  LayoutBox,
  LayoutEdge,
  LayoutGraph,
  LayoutNode,
  LayoutPoint,
  LayoutResult,
} from "./contract";

/**
 * The layout options the auto-layout button (Cmd/Ctrl+Shift+L) has always run.
 *
 * The option set is tuned against `layoutReadability`'s counters, not the one
 * that happened to be older. Three notes on it, all verified against elkjs
 * rather than assumed:
 *   - `elk.direction` is "RIGHT". ELK has no "LEFT_TO_RIGHT" token; it ignores
 *     the value and falls back to a default that happens to flow rightwards, so
 *     the mistake is invisible.
 *   - `elk.padding` uses `=` separators. With `:` ELK fails to parse the value
 *     and silently applies its 12px default.
 *   - There is no `elk.resize`. Containers sized to fit their children is ELK's
 *     default for compound nodes, which is what this relies on.
 *
 * Spacing (110 / 220 + edgeNode/edgeEdge) was promoted from the visualization
 * profile after C4 panels with many same-layer siblings still read as a tall
 * stack at 80/150. Between-layer gap is the L→R lever; node/edge gaps keep
 * labels and orthogonal paths from collapsing. Placement stays BRANDES_KOEPF
 * so long edges stay straight for the editor's ELK waypoints.
 *
 * Options that are *not* here were removed on measurement, not on taste:
 * `layering.strategy=LONGEST_PATH` measured worse (11 crossings against 9), and
 * `layered.wrapping.strategy` breaks a linear chain into rows, which contradicts
 * the reading-direction rule in AGENTS.md. Both are covered by tests.
 */
export const ELK_OPTIONS_INTERACTIVE: Record<string, string> = {
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
 * The options the reading view runs.
 *
 * The difference from `ELK_OPTIONS_INTERACTIVE` is not taste. The interactive
 * profile runs on a diagram the user arranged, so its job is to not make that
 * worse while still reading L→R; this one runs where nobody arranged anything
 * and the only thing being optimised is how the picture reads. Placement is
 * the remaining lever: NETWORK_SIMPLEX vs BRANDES_KOEPF.
 *
 * **Measured against how `/viewer` actually draws**, which is the only comparison
 * worth making. The viewer stamps handle-aligned ELK corridors from
 * `layoutForVisualization` onto edge data (`layoutPoints`), so the reading
 * surface draws the same orthogonal paths as the editor after auto-layout. An
 * option tuned only against ELK's raw border routes can still disagree with
 * handle-aligned corridors — `bk.fixedAlignment=BALANCED` measured 14 -> 12
 * crossings with ELK's routing and 15 -> 20 without it. It is not here for that
 * reason.
 *
 * Over the four `reference-diagrams`, rendered as the viewer renders them.
 * Baseline is the interactive profile: 15 crossings, 2 label overlaps, 1959px
 * of collinear edge overlap. With this set: **13 crossings, 1 label overlap,
 * 1772px** — better on all three. On the 400-node audit fixture, crossings are
 * flat (20742 -> 20739), collinear overlap falls 22% (3213px -> 2517px), and
 * the canvas is 11% shorter despite the wider spacings.
 *
 *   - `nodePlacement.strategy=NETWORK_SIMPLEX` is the option that moved the
 *     crossing count: 15 -> 13 on its own. BRANDES_KOEPF, which the interactive
 *     profile keeps, optimises for straight long edges; NETWORK_SIMPLEX reads
 *     better once corridors are handle-aligned on the canvas.
 *   - Interactive already carries the generous spacing + edge gaps; this
 *     profile only swaps placement. 140/260 was measured too and is worse on
 *     overlap (2060px) for more width — do not re-widen here without a new
 *     table.
 *
 * Measured and rejected: `layered.thoroughness`, `spacing.edgeLabel`,
 * `spacing.labelNode` and `separateConnectedComponents` change nothing at all
 * here — byte-identical to the control, the same result a deliberately invalid
 * option key produces, which is how ELK reports an option it does not use.
 * `nodePlacement.strategy` SIMPLE (31 crossings) and LINEAR_SEGMENTS (26) are
 * far worse. `considerModelOrder.strategy` throws inside elkjs 0.12 on these
 * graphs.
 *
 * Not here, because they are already true of the base set: left-to-right is
 * `elk.direction=RIGHT`, which both profiles share, and user positions are
 * ignored by construction — `LayoutNode` carries no x/y for ELK to read.
 */
export const ELK_OPTIONS_VISUALIZATION: Record<string, string> = {
  ...ELK_OPTIONS_INTERACTIVE,
  "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
};

/** Which of the two option sets a caller wants. */
export type LayoutProfile = "interactive" | "visualization";

const PROFILE_OPTIONS: Record<LayoutProfile, Record<string, string>> = {
  interactive: ELK_OPTIONS_INTERACTIVE,
  visualization: ELK_OPTIONS_VISUALIZATION,
};

const ELK_ROOT_ID = "__structura_layout_root__";

let elkConstructor: (new () => { layout(graph: ElkNode): Promise<ElkNode> }) | null = null;

async function getElk(): Promise<{ layout(graph: ElkNode): Promise<ElkNode> }> {
  if (!elkConstructor) {
    // Dynamic import to keep ELK's ~250KB out of the initial bundle.
    const module = await import("elkjs/lib/elk.bundled.js");
    elkConstructor = module.default;
  }
  return new elkConstructor();
}

/**
 * Input order is not information.
 *
 * ELK's result depends on the order it receives nodes and edges in, so an
 * unsorted caller makes the same architecture lay out differently depending on
 * how a `Record` happened to enumerate or an array happened to be built. Sorting
 * by id here is what makes the contract deterministic for every caller at once,
 * and it is locked by the permutation test.
 */
function sortById<T extends { id: string }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Children per parent, with a `parentId` pointing outside the graph collapsed to
 * a root. That is what lets a caller hand over a panel's children on their own.
 */
function buildChildrenByParent(nodes: readonly LayoutNode[]): Map<string | null, LayoutNode[]> {
  const present = new Set(nodes.map((node) => node.id));
  const childrenByParent = new Map<string | null, LayoutNode[]>();

  for (const node of nodes) {
    const parentId = node.parentId !== null && present.has(node.parentId) ? node.parentId : null;
    const siblings = childrenByParent.get(parentId);
    if (siblings) siblings.push(node);
    else childrenByParent.set(parentId, [node]);
  }

  return childrenByParent;
}

function buildElkNode(
  node: LayoutNode,
  childrenByParent: Map<string | null, LayoutNode[]>,
  options: Record<string, string>,
  visited: Set<string>,
): ElkNode {
  // A containment cycle would recurse forever and hang the tab. The IR validator
  // rejects cycles and the store should not create them, so this is insurance
  // rather than an expected path.
  if (visited.has(node.id)) {
    return { id: node.id, width: node.width, height: node.height };
  }
  visited.add(node.id);

  const children = childrenByParent.get(node.id) ?? [];
  if (children.length === 0) {
    return { id: node.id, width: node.width, height: node.height };
  }

  return {
    id: node.id,
    width: node.width,
    height: node.height,
    layoutOptions: { ...options },
    children: children.map((child) => buildElkNode(child, childrenByParent, options, visited)),
  };
}

function collectBoxes(node: ElkNode, boxes: Map<string, LayoutBox>): void {
  if (node.id !== ELK_ROOT_ID) {
    boxes.set(node.id, {
      x: node.x ?? 0,
      y: node.y ?? 0,
      width: node.width ?? 0,
      height: node.height ?? 0,
    });
  }
  for (const child of node.children ?? []) {
    collectBoxes(child, boxes);
  }
}

function emptyResult(): LayoutResult {
  return {
    boxes: new Map(),
    edgeRoutes: new Map(),
    handleOrder: { outgoing: new Map(), incoming: new Map() },
    bounds: { width: 0, height: 0 },
  };
}

/**
 * Runs ELK and returns its graph untouched.
 *
 * Exposed so the readability counter can measure the same output the canvas is
 * built from, and so layout options can be compared without going through a
 * consumer. `optionOverrides` exists for that comparison only — production
 * callers use `layout`, which applies the configuration above.
 */
export async function layoutElkGraph(
  graph: LayoutGraph,
  optionOverrides: Record<string, string> = {},
  profile: LayoutProfile = "interactive",
): Promise<ElkNode> {
  const options = { ...PROFILE_OPTIONS[profile], ...optionOverrides };

  const nodes = sortById(graph.nodes);
  const present = new Set(nodes.map((node) => node.id));
  const childrenByParent = buildChildrenByParent(nodes);
  const roots = childrenByParent.get(null) ?? [];

  // An edge with an endpoint outside the graph has nothing to attach to; ELK
  // throws on an unresolvable endpoint rather than ignoring it.
  const edges: LayoutEdge[] = sortById(graph.edges).filter(
    (edge) => present.has(edge.sourceId) && present.has(edge.targetId),
  );

  const elkEdges: ElkExtendedEdge[] = edges.map((edge) => ({
    id: edge.id,
    sources: [edge.sourceId],
    targets: [edge.targetId],
  }));

  const visited = new Set<string>();
  const elkGraph: ElkNode = {
    id: ELK_ROOT_ID,
    layoutOptions: options,
    children: roots.map((root) => buildElkNode(root, childrenByParent, options, visited)),
    edges: elkEdges,
  };

  const elk = await getElk();
  return elk.layout(elkGraph);
}

/**
 * Lays out a graph. Pure and deterministic: no React, no store, no DOM, no
 * measurement of a rendered element. Everything that varies is in the graph.
 */
export async function layout(
  graph: LayoutGraph,
  profile: LayoutProfile = "interactive",
): Promise<LayoutResult> {
  if (graph.nodes.length === 0) return emptyResult();

  const laidOut = await layoutElkGraph(graph, {}, profile);
  if (!laidOut.children?.length) return emptyResult();

  const boxes = new Map<string, LayoutBox>();
  collectBoxes(laidOut, boxes);

  // Points come back absolute: `readLaidOutGraph` owns the
  // lowest-common-ancestor correction and is tested in `layoutReadability.test.ts`.
  // Do not re-derive the offset here.
  const edgeRoutes = new Map<string, LayoutPoint[]>();
  for (const edge of readLaidOutGraph(laidOut).edges) {
    edgeRoutes.set(
      edge.id,
      edge.points.map((point) => ({ x: point.x, y: point.y })),
    );
  }

  return {
    boxes,
    edgeRoutes,
    handleOrder: readElkHandleOrder(laidOut),
    bounds: { width: laidOut.width ?? 0, height: laidOut.height ?? 0 },
  };
}
