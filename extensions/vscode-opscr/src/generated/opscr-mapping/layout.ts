/**
 * AUTO-GENERATED — DO NOT EDIT BY HAND.
 * Verbatim copy of the host's src/lib/opscr-mapping, synced via `npm run sync-shared`.
 * Edit the host files and re-sync instead of changing this file.
 */

import type { TechnicalView, ViewEdge, ViewNode } from "./types";

/**
 * The layout contract's shapes (`features/canvas/layout/contract.ts`), restated
 * structurally so this library imports nothing from the app. The app's `layout()`
 * accepts the graph and returns the result as they are.
 */
export interface ViewLayoutGraph {
  nodes: Array<{ id: string; parentId: string | null; width: number; height: number }>;
  edges: Array<{ id: string; sourceId: string; targetId: string }>;
}

export interface ViewBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ViewLayoutResult {
  boxes: ReadonlyMap<string, ViewBox>;
  edgeRoutes: ReadonlyMap<string, ReadonlyArray<{ x: number; y: number }>>;
  /**
   * The parent each box is relative to (null: the root), when known. A box moved to another
   * parent no longer means anything there — see `stabilizeLayout`.
   */
  parents?: ReadonlyMap<string, string | null>;
}

/** Leaf size — Structura's `DEFAULT_NODE_W`/`DEFAULT_NODE_H`. */
export const LEAF_W = 180;
export const LEAF_H = 80;
/** Seed for a boundary with children; the engine fits it around them. */
const CONTAINER_SEED_W = 240;
const CONTAINER_SEED_H = 160;
/** An empty boundary keeps its size verbatim, so it must fit its header label. */
export const EMPTY_BOUNDARY_W = 360;
export const EMPTY_BOUNDARY_H = 200;

/** The view as a layout graph: ids, parents, seed sizes and edges. */
export function toLayoutGraph(view: TechnicalView): ViewLayoutGraph {
  const parents = new Set(
    view.nodes.map((n) => n.parentId).filter((id): id is string => id !== null),
  );
  return {
    nodes: view.nodes.map((node) => {
      const size = parents.has(node.id)
        ? { width: CONTAINER_SEED_W, height: CONTAINER_SEED_H }
        : node.isBoundary
          ? { width: EMPTY_BOUNDARY_W, height: EMPTY_BOUNDARY_H }
          : { width: LEAF_W, height: LEAF_H };
      return { id: node.id, parentId: node.parentId, ...size };
    }),
    edges: view.edges.map((edge) => ({
      id: edge.id,
      sourceId: edge.sourceId,
      targetId: edge.targetId,
    })),
  };
}

export interface PlacedNode extends ViewNode {
  /** Relative to the parent's box; roots relative to the layout origin. */
  box: ViewBox;
}

export interface PlacedEdge extends ViewEdge {
  /** The engine's route, border to border, in absolute coordinates; empty if none. */
  route: Array<{ x: number; y: number }>;
}

export interface PlacedView extends Omit<TechnicalView, "nodes" | "edges"> {
  nodes: PlacedNode[];
  edges: PlacedEdge[];
}

/**
 * Attach a layout result to the view. A node the result has no box for keeps its
 * seed size at the origin, so a partial result degrades instead of losing nodes.
 */
export function placeView(view: TechnicalView, result: ViewLayoutResult): PlacedView {
  const seeds = new Map(toLayoutGraph(view).nodes.map((n) => [n.id, n]));
  return {
    ...view,
    nodes: view.nodes.map((node) => {
      const box = result.boxes.get(node.id);
      const seed = seeds.get(node.id)!;
      return {
        ...node,
        box: box ? { ...box } : { x: 0, y: 0, width: seed.width, height: seed.height },
      };
    }),
    edges: view.edges.map((edge) => ({
      ...edge,
      route: (result.edgeRoutes.get(edge.id) ?? []).map((p) => ({ x: p.x, y: p.y })),
    })),
  };
}
