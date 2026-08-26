/**
 * The layout contract.
 *
 * One shape in, one shape out, for every caller that needs a diagram arranged.
 * Deliberately plain data: ids, numbers and arrays, with no product vocabulary
 * (no `semanticType`, no `panelKind`, no `Component`). Three reasons that
 * matters, in order of how much they cost to get wrong:
 *
 *   1. Sizing policy stays with the caller. The engine never invents a width;
 *      it lays out the boxes it is given. An empty AWS boundary being 360x200
 *      is a decision about AWS diagrams, not about ELK.
 *   2. It is testable without a browser, a store or React.
 *   3. It is JSON but for the `Map`s on the way out, so a future out-of-process
 *      facade is an encode/decode, not a redesign.
 *
 * Note what is *not* here: no ports. ELK spreads edge attachments along a node
 * border and sorts them to minimise crossings, and `handleOrder` is how that
 * ordering gets back to the canvas. Declaring ports with `FIXED_ORDER` would
 * pin the attachments to the caller's round-robin guess and destroy exactly the
 * information this contract exists to return.
 */

export interface LayoutPoint {
  x: number;
  y: number;
}

export interface LayoutNode {
  id: string;
  /**
   * Containment parent. A `parentId` naming a node outside `nodes` is treated
   * as a root, which is what makes a subtree scope work: hand the engine a
   * panel's children and they lay out as top-level nodes.
   */
  parentId: string | null;
  width: number;
  height: number;
}

export interface LayoutEdge {
  id: string;
  sourceId: string;
  targetId: string;
}

export interface LayoutGraph {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
}

export interface LayoutBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Edge ids in the order ELK attached them, top to bottom, per node side. */
export interface LayoutHandleOrder {
  outgoing: Map<string, string[]>;
  incoming: Map<string, string[]>;
}

export interface LayoutResult {
  /**
   * Position relative to the parent (roots relative to the layout origin), and
   * the size the layout settled on. A node holding children comes back sized to
   * fit them — dropping that size is what leaves children outside their panel.
   */
  boxes: Map<string, LayoutBox>;
  /**
   * ELK's routed path per edge id, already corrected for its
   * lowest-common-ancestor coordinate space. Endpoints on the node borders are
   * included, so interior bend points are everything between first and last.
   */
  edgeRoutes: Map<string, LayoutPoint[]>;
  handleOrder: LayoutHandleOrder;
  /** Total size of the laid-out graph, for callers that re-anchor the result. */
  bounds: { width: number; height: number };
}
