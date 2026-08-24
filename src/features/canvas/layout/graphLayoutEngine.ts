import type { ElkExtendedEdge, ElkNode } from "elkjs";
import { DEFAULT_NODE_W, DEFAULT_NODE_H } from "@/features/diagram";
import { readLaidOutGraph } from "./layoutReadability";
import { readElkHandleOrder, type ElkHandleOrder } from "./elkHandleOrder";

/**
 * ELK layout for a structural graph — a set of nodes with a containment tree
 * and a set of edges, and no geometry of its own.
 *
 * Two importers are in that position: the LLM IR (`irLayoutEngine`, which is a
 * thin adapter over this module) and the ASL importer. Both hand over the same
 * shape, so the configuration, the container fitting and the coordinate
 * conventions are decided once.
 *
 * Three deviations from the options originally specified, all verified against
 * elkjs:
 *   - `elk.direction` is "RIGHT", not "LEFT_TO_RIGHT". ELK has no LEFT_TO_RIGHT
 *     token; it silently ignores it and falls back to the default (which happens
 *     to flow rightwards, so the mistake was invisible).
 *   - `elk.padding` uses `=` separators. With the `:` form ELK fails to parse
 *     the value and applies its 12px default instead of 40px.
 *   - `elk.resize` is dropped: no such option exists. Its intent — containers
 *     sized to fit their children — is ELK's default behaviour for compound
 *     nodes, which is what we rely on.
 */
export const DEFAULT_GRAPH_ELK_OPTIONS: Record<string, string> = {
  "elk.algorithm": "layered",
  // Not cosmetic: the canvas contract is that a diagram reads left to right and
  // the handles enforce it, so the geometry has to agree with the handles.
  "elk.direction": "RIGHT",
  "elk.edgeRouting": "ORTHOGONAL",
  "elk.layered.spacing.nodeNodeBetweenLayers": "150",
  "elk.spacing.nodeNode": "80",
  "elk.layered.nodePlacement.strategy": "BRANDES_KOEPF",
  "elk.padding": "[top=40,left=40,bottom=40,right=40]",
  "elk.hierarchyHandling": "INCLUDE_CHILDREN",
};

const ELK_ROOT_ID = "__structura_graph_root__";

/** Placeholder size for a container; ELK replaces it with the fitted size. */
const CONTAINER_SEED_W = 240;
const CONTAINER_SEED_H = 160;

/**
 * An empty container keeps this size verbatim — ELK has no children to fit it
 * around — so it has to be wide enough for the header label not to truncate.
 */
export const EMPTY_CONTAINER_W = 360;
export const EMPTY_CONTAINER_H = 200;

/** A node of a structural graph: containment plus an optional intrinsic size. */
export interface LayoutGraphNode {
  id: string;
  parentId: string | null;
  /** True for a node that holds — or may hold — children. */
  isContainer: boolean;
  width?: number;
  height?: number;
}

export interface LayoutGraphEdge {
  id: string;
  sourceId: string;
  targetId: string;
}

export interface LayoutBox {
  /** Position relative to the parent node, matching React Flow's child semantics. */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GraphLayoutResult {
  /** Keyed by node id. */
  boxes: Map<string, LayoutBox>;
  /**
   * The same boxes in canvas-absolute coordinates, plus the containment map.
   * Both come free from the walk that corrects the edge routes, and a caller
   * placing anything against the finished picture (a note, a label) needs
   * absolute geometry rather than parent-relative.
   */
  absoluteBoxes: Map<string, LayoutBox>;
  parentOf: Map<string, string | null>;
  /**
   * ELK's routed path per edge id, in coordinates relative to the layout origin
   * — already corrected for ELK's lowest-common-ancestor coordinate space.
   * Includes the endpoints on the node borders, so interior bend points are
   * everything between the first and last entry.
   */
  edgeRoutes: Map<string, Array<{ x: number; y: number }>>;
  /**
   * The order ELK attached edges along each node's side, keyed by node id.
   * Feeding this into `handleOrder` is what makes the canvas pick handles in a
   * crossing-minimising order instead of round-robin.
   */
  handleOrder: ElkHandleOrder;
}

let elkConstructor: (new () => { layout(graph: ElkNode): Promise<ElkNode> }) | null = null;

async function getElk(): Promise<{ layout(graph: ElkNode): Promise<ElkNode> }> {
  if (!elkConstructor) {
    // Dynamic import to keep ELK out of the initial bundle.
    const module = await import("elkjs/lib/elk.bundled.js");
    elkConstructor = module.default;
  }
  return new elkConstructor();
}

function buildChildrenByParent(
  nodes: readonly LayoutGraphNode[],
): Map<string | null, LayoutGraphNode[]> {
  const childrenByParent = new Map<string | null, LayoutGraphNode[]>();
  for (const node of nodes) {
    const key = node.parentId;
    const siblings = childrenByParent.get(key);
    if (siblings) {
      siblings.push(node);
    } else {
      childrenByParent.set(key, [node]);
    }
  }
  return childrenByParent;
}

function buildElkNode(
  node: LayoutGraphNode,
  childrenByParent: Map<string | null, LayoutGraphNode[]>,
  options: Record<string, string>,
): ElkNode {
  const children = childrenByParent.get(node.id) ?? [];
  if (children.length === 0) {
    // An empty container still has to read as a box, so it keeps the container
    // size instead of collapsing to a leaf-sized node.
    const fallbackW = node.isContainer ? EMPTY_CONTAINER_W : DEFAULT_NODE_W;
    const fallbackH = node.isContainer ? EMPTY_CONTAINER_H : DEFAULT_NODE_H;
    return {
      id: node.id,
      width: node.width ?? fallbackW,
      height: node.height ?? fallbackH,
    };
  }
  return {
    id: node.id,
    width: CONTAINER_SEED_W,
    height: CONTAINER_SEED_H,
    layoutOptions: { ...options },
    children: children.map((child) => buildElkNode(child, childrenByParent, options)),
  };
}

function collectBoxes(node: ElkNode, boxes: Map<string, LayoutBox>): void {
  if (node.id !== ELK_ROOT_ID) {
    boxes.set(node.id, {
      x: node.x ?? 0,
      y: node.y ?? 0,
      width: node.width ?? DEFAULT_NODE_W,
      height: node.height ?? DEFAULT_NODE_H,
    });
  }
  for (const child of node.children ?? []) {
    collectBoxes(child, boxes);
  }
}

/**
 * Runs ELK and returns its graph untouched. Exposed so the readability counter
 * can measure the same output the canvas is built from, and so layout options
 * can be compared without going through the store.
 *
 * `optionOverrides` exists for that comparison only — production callers use
 * `layoutGraph`, which applies the configuration this project settled on.
 */
export async function layoutGraphElk(
  nodes: readonly LayoutGraphNode[],
  edges: readonly LayoutGraphEdge[],
  optionOverrides: Record<string, string> = {},
): Promise<ElkNode> {
  const options = { ...DEFAULT_GRAPH_ELK_OPTIONS, ...optionOverrides };
  const childrenByParent = buildChildrenByParent(nodes);
  const roots = childrenByParent.get(null) ?? [];

  const elkEdges: ElkExtendedEdge[] = edges.map((edge) => ({
    id: edge.id,
    sources: [edge.sourceId],
    targets: [edge.targetId],
  }));

  const graph: ElkNode = {
    id: ELK_ROOT_ID,
    layoutOptions: options,
    children: roots.map((root) => buildElkNode(root, childrenByParent, options)),
    edges: elkEdges,
  };

  const elk = await getElk();
  return elk.layout(graph);
}

/**
 * Lays out every node of the graph. Positions come back relative to the parent
 * (root nodes relative to the canvas origin), which is exactly what React Flow
 * expects from a child node.
 */
export async function layoutGraph(
  nodes: readonly LayoutGraphNode[],
  edges: readonly LayoutGraphEdge[],
  optionOverrides: Record<string, string> = {},
): Promise<GraphLayoutResult> {
  const boxes = new Map<string, LayoutBox>();
  const edgeRoutes = new Map<string, Array<{ x: number; y: number }>>();
  if (nodes.length === 0) {
    return {
      boxes,
      absoluteBoxes: new Map(),
      parentOf: new Map(),
      edgeRoutes,
      handleOrder: { outgoing: new Map(), incoming: new Map() },
    };
  }

  const laidOut = await layoutGraphElk(nodes, edges, optionOverrides);
  collectBoxes(laidOut, boxes);

  // `readLaidOutGraph` owns the lowest-common-ancestor correction and is tested
  // there; re-deriving it here is exactly how the legacy engine got it wrong.
  const walked = readLaidOutGraph(laidOut);
  for (const edge of walked.edges) {
    edgeRoutes.set(
      edge.id,
      edge.points.map((point) => ({ x: point.x, y: point.y })),
    );
  }

  return {
    boxes,
    absoluteBoxes: walked.boxes,
    parentOf: walked.parentOf,
    edgeRoutes,
    handleOrder: readElkHandleOrder(laidOut),
  };
}
