import type { ElkExtendedEdge, ElkNode } from "elkjs";
import { DEFAULT_NODE_W, DEFAULT_NODE_H } from "@/features/diagram";
// Leaf import, not the `ir` barrel: the barrel reaches back into this module.
import type { DiagramIR, IRNode } from "@/features/llm/ir/ir.types";

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

let elkConstructor: (new () => { layout(graph: ElkNode): Promise<ElkNode> }) | null = null;

async function getElk(): Promise<{ layout(graph: ElkNode): Promise<ElkNode> }> {
  if (!elkConstructor) {
    // Dynamic import to keep ELK out of the initial bundle.
    const module = await import(/* @vite-ignore */ "elkjs/lib/elk.bundled.js");
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

function buildElkNode(node: IRNode, childrenByParent: Map<string | null, IRNode[]>): ElkNode {
  const children = childrenByParent.get(node.id) ?? [];
  if (children.length === 0) {
    return { id: node.id, width: DEFAULT_NODE_W, height: DEFAULT_NODE_H };
  }
  return {
    id: node.id,
    width: CONTAINER_SEED_W,
    height: CONTAINER_SEED_H,
    layoutOptions: { ...IR_ELK_OPTIONS },
    children: children.map((child) => buildElkNode(child, childrenByParent)),
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
 * Lays out every node of the IR. Positions come back relative to the parent
 * (root nodes relative to the canvas origin), which is exactly what React Flow
 * expects from a child node.
 */
export async function layoutIR(ir: DiagramIR): Promise<IRLayoutResult> {
  const boxes = new Map<string, IRLayoutBox>();
  if (ir.nodes.length === 0) {
    return { boxes };
  }

  const childrenByParent = buildChildrenByParent(ir.nodes);
  const roots = childrenByParent.get(null) ?? [];

  const elkEdges: ElkExtendedEdge[] = ir.edges.map((edge) => ({
    id: edge.id,
    sources: [edge.sourceId],
    targets: [edge.targetId],
  }));

  const graph: ElkNode = {
    id: ELK_ROOT_ID,
    layoutOptions: { ...IR_ELK_OPTIONS },
    children: roots.map((root) => buildElkNode(root, childrenByParent)),
    edges: elkEdges,
  };

  const elk = await getElk();
  const laidOut = await elk.layout(graph);
  collectBoxes(laidOut, boxes);

  return { boxes };
}
