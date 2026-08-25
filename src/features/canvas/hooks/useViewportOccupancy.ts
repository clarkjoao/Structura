import { useStore, type InternalNode, type Node } from "@xyflow/react";
import { DEFAULT_NODE_H, DEFAULT_NODE_W } from "@/features/diagram";

export interface ViewportOccupancy {
  /** The diagram has at least one node that is not hidden. */
  hasNodes: boolean;
  /** At least one of those nodes intersects the visible area. */
  anyNodeVisible: boolean;
  /** How many non-hidden nodes the diagram has, for the recovery message. */
  nodeCount: number;
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function nodeRect(node: InternalNode<Node>): Rect {
  const { x, y } = node.internals.positionAbsolute;
  return {
    x,
    y,
    width: node.measured.width ?? DEFAULT_NODE_W,
    height: node.measured.height ?? DEFAULT_NODE_H,
  };
}

/** Touching edges count as overlapping — a node flush with the border is still on screen. */
function intersects(a: Rect, b: Rect): boolean {
  return (
    a.x <= b.x + b.width && a.x + a.width >= b.x && a.y <= b.y + b.height && a.y + a.height >= b.y
  );
}

/**
 * Pure core of the hook, exported for testing: does any node overlap the visible area?
 *
 * `transform` is React Flow's `[translateX, translateY, zoom]`; the visible area in flow
 * coordinates is the pane rectangle mapped back through it.
 */
export function computeViewportOccupancy(
  nodes: InternalNode<Node>[],
  transform: [number, number, number],
  paneWidth: number,
  paneHeight: number,
): ViewportOccupancy {
  const visible = nodes.filter((node) => !node.hidden);
  if (visible.length === 0) return { hasNodes: false, anyNodeVisible: false, nodeCount: 0 };

  const [translateX, translateY, zoom] = transform;
  if (zoom === 0 || paneWidth === 0 || paneHeight === 0) {
    // The pane has not been measured yet; assume content is reachable rather than
    // flashing the recovery card on mount.
    return { hasNodes: true, anyNodeVisible: true, nodeCount: visible.length };
  }

  const viewport: Rect = {
    x: -translateX / zoom,
    y: -translateY / zoom,
    width: paneWidth / zoom,
    height: paneHeight / zoom,
  };

  return {
    hasNodes: true,
    anyNodeVisible: visible.some((node) => intersects(nodeRect(node), viewport)),
    nodeCount: visible.length,
  };
}

/**
 * Tracks whether the user has panned or zoomed away from every element on the canvas.
 *
 * The occupancy is derived inside a single React Flow store selector and compared field by
 * field, so the component re-renders only when one of the two booleans actually flips — not on
 * every pixel of a pan.
 */
export function useViewportOccupancy(): ViewportOccupancy {
  return useStore(
    (state) =>
      computeViewportOccupancy(
        Array.from(state.nodeLookup.values()),
        state.transform,
        state.width,
        state.height,
      ),
    (a, b) =>
      a.hasNodes === b.hasNodes &&
      a.anyNodeVisible === b.anyNodeVisible &&
      a.nodeCount === b.nodeCount,
  );
}
