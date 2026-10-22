import type { ElkExtendedEdge, ElkNode, ElkPort } from "elkjs";
// The leaf module: the layout path must not pull the diagram store in.
import { HANDLE_PITCH } from "@/features/diagram/model/layout.constants";
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
 * There is one profile. A second, `visualization` (the same set with
 * `nodePlacement.strategy=NETWORK_SIMPLEX`), re-arranged diagrams for `/viewer`
 * and measured 13 crossings against this set's 15 over the four
 * `reference-diagrams`. It went with the viewer's re-layout: every surface now
 * draws the layout the author saved, so the only layout that runs is the one
 * the author runs. If the editor's auto-layout ever wants that placement, that
 * measurement is the starting point.
 *
 * `edgeEdgeBetweenLayers` is the gap between the vertical channels edges take
 * between two layers, and is not `spacing.edgeEdge` (that one is within a
 * layer). ELK's default is 10, which drew neighbouring channels close enough
 * to read as one line. Measured 2026-10-21 over the reference, generated and
 * PixLedger diagrams: vertical segments of different edges within 10px of each
 * other 125 → 2, for +1% area, with crossings and label overlaps unchanged. Mermaid gets the same effect from
 * `spacing.baseValue`.
 *
 * The port options bundle each side's edges around its middle, `HANDLE_PITCH`
 * apart — where the canvas draws its handles (see `withPorts`). `FIXED_SIDE`
 * keeps outputs on the right and inputs on the left but leaves ELK free to
 * order them; `spacing.portPort` is only read from the root, not per node.
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
  "elk.layered.spacing.edgeEdgeBetweenLayers": "20",
  "elk.layered.nodePlacement.strategy": "BRANDES_KOEPF",
  "elk.padding": "[top=40,left=40,bottom=40,right=40]",
  "elk.hierarchyHandling": "INCLUDE_CHILDREN",
  "elk.portConstraints": "FIXED_SIDE",
  "elk.portAlignment.default": "CENTER",
  "elk.spacing.portPort": String(HANDLE_PITCH),
};

/**
 * Applied on top of `ELK_OPTIONS_INTERACTIVE` when any edge carries a
 * `labelBox` (the Mermaid 12 approach: labels are inline, so ELK routes around
 * them).
 *
 *   - An inline label is a layer of its own, so a labelled edge spans two
 *     between-layer gaps. Halving the gap gives most of that width back:
 *     measured over the reference diagrams, area went +61% at 220 and +24% at
 *     110, with the same crossing count.
 *   - BALANCED alignment was the one option of Mermaid's preset that helped;
 *     its DEPTH_FIRST cycle breaking made every diagram worse and is left out.
 *
 * Numbers from `elkMermaidParity.experiment.test.ts`.
 */
const ELK_OPTIONS_LABELLED: Record<string, string> = {
  "elk.layered.spacing.nodeNodeBetweenLayers": "110",
  "elk.layered.nodePlacement.bk.fixedAlignment": "BALANCED",
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

/** Replaces `top` in an ELK `[top=..,left=..]` padding string. */
function withTopPadding(padding: string | undefined, top: number): string {
  const sides = (padding ?? "")
    .replace(/[[\]\s]/g, "")
    .split(",")
    .filter((s) => !s.startsWith("top="));
  return `[top=${top},${sides.join(",")}]`;
}

/** Where an edge leaves its source and enters its target, as ELK ports. */
interface EdgePorts {
  byNode: Map<string, ElkPort[]>;
  /** edge id -> its source and target ids, ports where it has them. */
  ends: Map<string, { source: string; target: string }>;
}

function isAncestor(
  ancestorId: string,
  nodeId: string,
  parentOf: ReadonlyMap<string, string | null>,
): boolean {
  const seen = new Set<string>();
  for (let id = parentOf.get(nodeId); id != null && !seen.has(id); id = parentOf.get(id)) {
    if (id === ancestorId) return true;
    seen.add(id);
  }
  return false;
}

/**
 * One port per edge end: the source's on its right side, the target's on its
 * left, as the canvas draws its handles.
 *
 * Without ports ELK spreads a side's edges over the node's whole height —
 * `(i + 1) / (n + 1)` — and the canvas then had to bridge to its own handles.
 * With them, `portAlignment CENTER` and `spacing.portPort` bundle the edges
 * exactly where `handleSlotOffset` puts the handles, so a route starts on its
 * handle. ELK still orders the ports to minimise crossings; `handleOrder`
 * reads that order back off the routes, as before.
 *
 * A side the canvas draws as one point (`LayoutNode.singlePort`) gets one
 * port, which every edge on that side shares.
 *
 * An edge between a container and something inside it gets no ports: its end
 * is on the far side of the border from the side the port would sit on, and
 * ELK routes it better attached to the node itself.
 */
function edgePorts(
  edges: readonly LayoutEdge[],
  nodes: ReadonlyMap<string, LayoutNode>,
  parentOf: ReadonlyMap<string, string | null>,
): EdgePorts {
  const byNode = new Map<string, ElkPort[]>();
  const ends = new Map<string, { source: string; target: string }>();
  const added = new Set<string>();
  /** Adds the port unless a shared one is already there; returns its id. */
  const add = (nodeId: string, id: string, side: "EAST" | "WEST"): string => {
    if (added.has(id)) return id;
    added.add(id);
    const port: ElkPort = { id, width: 0, height: 0, layoutOptions: { "elk.port.side": side } };
    const list = byNode.get(nodeId);
    if (list) list.push(port);
    else byNode.set(nodeId, [port]);
    return id;
  };

  for (const edge of edges) {
    const nested =
      isAncestor(edge.sourceId, edge.targetId, parentOf) ||
      isAncestor(edge.targetId, edge.sourceId, parentOf);
    if (nested) {
      ends.set(edge.id, { source: edge.sourceId, target: edge.targetId });
      continue;
    }
    const sharedOut = nodes.get(edge.sourceId)?.singlePort?.outgoing;
    const sharedIn = nodes.get(edge.targetId)?.singlePort?.incoming;
    const source = add(
      edge.sourceId,
      sharedOut ? `${edge.sourceId}__shared_out` : `${edge.id}__out`,
      "EAST",
    );
    const target = add(
      edge.targetId,
      sharedIn ? `${edge.targetId}__shared_in` : `${edge.id}__in`,
      "WEST",
    );
    ends.set(edge.id, { source, target });
  }
  return { byNode, ends };
}

function buildElkNode(
  node: LayoutNode,
  childrenByParent: Map<string | null, LayoutNode[]>,
  options: Record<string, string>,
  portsByNode: ReadonlyMap<string, ElkPort[]>,
  visited: Set<string>,
): ElkNode {
  const ports = portsByNode.get(node.id);
  const shape: ElkNode = {
    id: node.id,
    width: node.width,
    height: node.height,
    // A leaf has no options of its own, and ELK does not hand a parent's port
    // options down to it: without these its ports would float to any side.
    ...(ports && {
      ports,
      layoutOptions: {
        "elk.portConstraints": options["elk.portConstraints"]!,
        "elk.portAlignment.default": options["elk.portAlignment.default"]!,
      },
    }),
  };
  // A containment cycle would recurse forever and hang the tab. The IR validator
  // rejects cycles and the store should not create them, so this is insurance
  // rather than an expected path.
  if (visited.has(node.id)) return shape;
  visited.add(node.id);

  const children = childrenByParent.get(node.id) ?? [];
  if (children.length === 0) return shape;

  return {
    ...shape,
    layoutOptions:
      node.topInset === undefined
        ? { ...options }
        : { ...options, "elk.padding": withTopPadding(options["elk.padding"], node.topInset) },
    children: children.map((child) =>
      buildElkNode(child, childrenByParent, options, portsByNode, visited),
    ),
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
): Promise<ElkNode> {
  const labelled = graph.edges.some((edge) => edge.labelBox?.text);
  const options = {
    ...ELK_OPTIONS_INTERACTIVE,
    ...(labelled ? ELK_OPTIONS_LABELLED : {}),
    ...optionOverrides,
  };

  const nodes = sortById(graph.nodes);
  const present = new Set(nodes.map((node) => node.id));
  const childrenByParent = buildChildrenByParent(nodes);
  const roots = childrenByParent.get(null) ?? [];

  // An edge with an endpoint outside the graph has nothing to attach to; ELK
  // throws on an unresolvable endpoint rather than ignoring it.
  const edges: LayoutEdge[] = sortById(graph.edges).filter(
    (edge) => present.has(edge.sourceId) && present.has(edge.targetId),
  );

  const parentOf = new Map<string, string | null>();
  for (const [parentId, children] of childrenByParent) {
    for (const child of children) parentOf.set(child.id, parentId);
  }
  const ports = edgePorts(edges, new Map(nodes.map((node) => [node.id, node])), parentOf);

  const elkEdges: ElkExtendedEdge[] = edges.map((edge) => ({
    id: edge.id,
    sources: [ports.ends.get(edge.id)!.source],
    targets: [ports.ends.get(edge.id)!.target],
    // elkjs ignores a label with no text, so an empty one reserves nothing.
    ...(edge.labelBox?.text && {
      labels: [
        {
          id: `${edge.id}__label`,
          text: edge.labelBox.text,
          width: edge.labelBox.width,
          height: edge.labelBox.height,
          layoutOptions: { "elk.edgeLabels.inline": "true", "elk.edgeLabels.placement": "CENTER" },
        },
      ],
    }),
  }));

  const visited = new Set<string>();
  const elkGraph: ElkNode = {
    id: ELK_ROOT_ID,
    layoutOptions: options,
    children: roots.map((root) =>
      buildElkNode(root, childrenByParent, options, ports.byNode, visited),
    ),
    edges: elkEdges,
  };

  const elk = await getElk();
  return elk.layout(elkGraph);
}

/**
 * Lays out a graph. Pure and deterministic: no React, no store, no DOM, no
 * measurement of a rendered element. Everything that varies is in the graph.
 *
 * `optionOverrides` has the same purpose as on `layoutElkGraph`: comparing
 * configurations end to end. Production callers omit it.
 */
export async function layout(
  graph: LayoutGraph,
  optionOverrides: Record<string, string> = {},
): Promise<LayoutResult> {
  if (graph.nodes.length === 0) return emptyResult();

  const laidOut = await layoutElkGraph(graph, optionOverrides);
  if (!laidOut.children?.length) return emptyResult();

  const boxes = new Map<string, LayoutBox>();
  collectBoxes(laidOut, boxes);

  // Points come back absolute: `readLaidOutGraph` owns the
  // lowest-common-ancestor correction and is tested in `layoutReadability.test.ts`.
  // Do not re-derive the offset here.
  const edgeRoutes = new Map<string, LayoutPoint[]>();
  const labelCenters = new Map<string, LayoutPoint>();
  for (const edge of readLaidOutGraph(laidOut).edges) {
    edgeRoutes.set(
      edge.id,
      edge.points.map((point) => ({ x: point.x, y: point.y })),
    );
    if (edge.labelCenter) labelCenters.set(edge.id, edge.labelCenter);
  }

  return {
    boxes,
    edgeRoutes,
    labelCenters,
    handleOrder: readElkHandleOrder(laidOut),
    bounds: { width: laidOut.width ?? 0, height: laidOut.height ?? 0 },
  };
}
