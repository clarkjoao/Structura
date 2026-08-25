import type { ElkExtendedEdge, ElkNode } from "elkjs";
import { DEFAULT_NODE_W, DEFAULT_NODE_H } from "@/features/diagram";
// Leaf import, not the `ir` barrel: the barrel reaches back into this module.
import { isBoundaryNode, type DiagramIR, type IRNode } from "@/features/llm/ir/ir.types";
import { readLaidOutGraph } from "./layoutReadability";
import { readElkHandleOrder, type ElkHandleOrder } from "./elkHandleOrder";

/**
 * ELK layout for a generated IR (spec §7).
 *
 * Deliberately a single, direct pass: build the containment tree, hand it to ELK,
 * read the boxes back. There is no tier mechanism here — `tier` travels through
 * the IR untouched until that decision is made (spec §8, Fatia 4).
 *
 * Three deviations from the options literal in spec §7, all verified against
 * elkjs 0.11:
 *   - `elk.direction` is "RIGHT", not "LEFT_TO_RIGHT". ELK has no LEFT_TO_RIGHT
 *     token; it silently ignores it and falls back to the default (which happens
 *     to flow rightwards, so the mistake was invisible).
 *   - `elk.padding` uses `=` separators. With the spec's `:` form ELK fails to
 *     parse the value and applies its 12px default instead of 40px.
 *   - `elk.resize` is dropped: no such option exists. Its intent — containers
 *     sized to fit their children — is ELK's default behaviour for compound
 *     nodes, which is what we rely on.
 */
const IR_ELK_OPTIONS: Record<string, string> = {
  "elk.algorithm": "layered",
  "elk.direction": "RIGHT",
  "elk.edgeRouting": "ORTHOGONAL",
  "elk.layered.spacing.nodeNodeBetweenLayers": "150",
  "elk.spacing.nodeNode": "80",
  "elk.layered.nodePlacement.strategy": "BRANDES_KOEPF",
  "elk.padding": "[top=40,left=40,bottom=40,right=40]",
  "elk.hierarchyHandling": "INCLUDE_CHILDREN",
};

const ELK_ROOT_ID = "__structura_ir_root__";

/** Placeholder size for a container; ELK replaces it with the fitted size. */
const CONTAINER_SEED_W = 240;
const CONTAINER_SEED_H = 160;

/**
 * An empty boundary keeps this size verbatim — ELK has no children to fit it
 * around — so it has to be wide enough for the header label not to truncate.
 */
const EMPTY_BOUNDARY_W = 360;
const EMPTY_BOUNDARY_H = 200;

let elkConstructor: (new () => { layout(graph: ElkNode): Promise<ElkNode> }) | null = null;

async function getElk(): Promise<{ layout(graph: ElkNode): Promise<ElkNode> }> {
  if (!elkConstructor) {
    // Dynamic import to keep ELK out of the initial bundle.
    const module = await import("elkjs/lib/elk.bundled.js");
    elkConstructor = module.default;
  }
  return new elkConstructor();
}

export interface IRLayoutBox {
  /** Position relative to the parent node, matching React Flow's child semantics. */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface IRLayoutResult {
  /** Keyed by IR node id. */
  boxes: Map<string, IRLayoutBox>;
  /**
   * ELK's routed path per edge id, in coordinates relative to the layout origin
   * — already corrected for ELK's lowest-common-ancestor coordinate space.
   * Includes the endpoints on the node borders, so interior bend points are
   * everything between the first and last entry.
   */
  edgeRoutes: Map<string, Array<{ x: number; y: number }>>;
  /**
   * The order ELK attached edges along each node's side, keyed by IR node id.
   * Feeding this into `handleOrder` is what makes the canvas pick handles in a
   * crossing-minimising order instead of round-robin.
   */
  handleOrder: ElkHandleOrder;
}

function buildChildrenByParent(nodes: IRNode[]): Map<string | null, IRNode[]> {
  const childrenByParent = new Map<string | null, IRNode[]>();
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
  node: IRNode,
  childrenByParent: Map<string | null, IRNode[]>,
  options: Record<string, string>,
): ElkNode {
  const children = childrenByParent.get(node.id) ?? [];
  if (children.length === 0) {
    // An empty boundary still has to read as a box, so it keeps the container
    // size instead of collapsing to a leaf-sized node.
    const isEmptyBoundary = isBoundaryNode(node);
    return {
      id: node.id,
      width: isEmptyBoundary ? EMPTY_BOUNDARY_W : DEFAULT_NODE_W,
      height: isEmptyBoundary ? EMPTY_BOUNDARY_H : DEFAULT_NODE_H,
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

function collectBoxes(node: ElkNode, boxes: Map<string, IRLayoutBox>): void {
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
 * `layoutIR`, which applies the configuration this project settled on.
 */
export async function layoutIRGraph(
  ir: DiagramIR,
  optionOverrides: Record<string, string> = {},
): Promise<ElkNode> {
  const options = { ...IR_ELK_OPTIONS, ...optionOverrides };
  const childrenByParent = buildChildrenByParent(ir.nodes);
  const roots = childrenByParent.get(null) ?? [];

  const elkEdges: ElkExtendedEdge[] = ir.edges.map((edge) => ({
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
 * Lays out every node of the IR. Positions come back relative to the parent
 * (root nodes relative to the canvas origin), which is exactly what React Flow
 * expects from a child node.
 */
export async function layoutIR(ir: DiagramIR): Promise<IRLayoutResult> {
  const boxes = new Map<string, IRLayoutBox>();
  const edgeRoutes = new Map<string, Array<{ x: number; y: number }>>();
  if (ir.nodes.length === 0) {
    return {
      boxes,
      edgeRoutes,
      handleOrder: { outgoing: new Map(), incoming: new Map() },
    };
  }

  const laidOut = await layoutIRGraph(ir);
  collectBoxes(laidOut, boxes);

  // Points come back absolute: `readLaidOutGraph` owns the
  // lowest-common-ancestor correction, shared with `autoLayoutEngine`, and is
  // tested in `layoutReadability.test.ts`. Do not re-derive the offset here.
  for (const edge of readLaidOutGraph(laidOut).edges) {
    edgeRoutes.set(
      edge.id,
      edge.points.map((point) => ({ x: point.x, y: point.y })),
    );
  }

  return { boxes, edgeRoutes, handleOrder: readElkHandleOrder(laidOut) };
}
