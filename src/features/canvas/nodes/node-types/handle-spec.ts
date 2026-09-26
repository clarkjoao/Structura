import { MAX_HANDLES } from "@/features/diagram/model/layout.constants";

/**
 * What a node type renders on its two sides — declared, not inferred.
 *
 * A leaf module on purpose. `connectionDerivations` needs to read these specs
 * to pick a slot, and three node components need `singleIncomingTargetHandleId`
 * to render their handle; keeping both here is what stops
 * `connectionDerivations -> registry -> descriptor -> NoteNode ->
 * connectionDerivations` from closing into an import cycle.
 *
 * Sides are still fixed — left is input, right is output, whatever the node's
 * position (see the module comment in `edges/connectionDerivations.ts`). A spec
 * says how many slots a side has, never which side an edge uses.
 */
export interface NodeHandleSpec {
  /**
   * Target slots. A number `n` means `target-0 .. target-(n-1)`; `"shared"`
   * means one handle for every incoming edge, whose id is
   * `singleIncomingTargetHandleId(nodeId)`.
   */
  incoming: "shared" | number;
  /**
   * Source slots: `source-0 .. source-(n-1)`. **Zero means the type is not a
   * source** — it renders no outgoing handle because nothing should leave it.
   */
  outgoing: number;
  /**
   * Also renders an input on the top side and an output on the bottom — the
   * flowchart shapes, where a decision's "no" leaves downwards and a step can
   * be entered from above. The side is chosen by the edge (`Connection.sourceSide`
   * / `targetSide`, written when the user draws from or to one of these
   * handles), never derived from where the nodes sit.
   */
  verticalSides?: boolean;
}

/** The top-side input of a node with `verticalSides`. */
export const TOP_TARGET_HANDLE_ID = "target-top";
/** The bottom-side output of a node with `verticalSides`. */
export const BOTTOM_SOURCE_HANDLE_ID = "source-bottom";

/** The sides a connection asks for, as stored. Absent means right/left. */
export interface ConnectionSides {
  sourceSide?: "bottom";
  targetSide?: "top";
}

/**
 * The sides a connection drawn between two handles asks for. Only the keys
 * that differ from the default are present, so a plain right-to-left edge
 * stores nothing new.
 */
export function sidesFromHandles(
  sourceHandle: string | null | undefined,
  targetHandle: string | null | undefined,
): ConnectionSides {
  return {
    ...(sourceHandle === BOTTOM_SOURCE_HANDLE_ID ? { sourceSide: "bottom" as const } : {}),
    ...(targetHandle === TOP_TARGET_HANDLE_ID ? { targetSide: "top" as const } : {}),
  };
}

/**
 * The id of the one incoming handle on a type that takes every edge on a single
 * anchor. Node-scoped rather than `target-0` because these types render one
 * handle whatever the edge count, and a slot-shaped id would read as the first
 * of several.
 */
export function singleIncomingTargetHandleId(nodeId: string): string {
  return `in-${nodeId}`;
}

/** A node that spreads its edges over the full set of slots. */
export const SPREAD_HANDLES: NodeHandleSpec = {
  incoming: MAX_HANDLES,
  outgoing: MAX_HANDLES,
};

/**
 * Takes edges, never emits one: `note`, `json-viewer` and `db-table`.
 *
 * These are things a diagram points *at* — an annotation, a payload, a table —
 * and the arrow runs from the thing being described to them, never back out.
 * So there is one incoming anchor, shared by every edge that arrives, and no
 * outgoing handle at all. That is the design, not a gap: an earlier pass here
 * read the missing handle as an omission and added one, which is what this
 * comment exists to stop happening again.
 *
 * One anchor rather than slots down the border because their body is content
 * the reader scans, and spread anchors would sit beside arbitrary rows of it.
 */
export const SINGLE_INCOMING_HANDLES: NodeHandleSpec = {
  incoming: "shared",
  outgoing: 0,
};

/**
 * One slot per side: `external-element`, `svg` and `endpoint`. They are drawn
 * as a single small row or tile, with no height to spread anchors over.
 */
export const SINGLE_PAIR_HANDLES: NodeHandleSpec = {
  incoming: 1,
  outgoing: 1,
};

/**
 * One slot in the middle of each side, on the shape's own outline: the
 * flowchart shapes. Left and right take every plain edge (in and out); top and
 * bottom take the edges drawn to or from them.
 */
export const FLOW_SHAPE_HANDLES: NodeHandleSpec = {
  incoming: 1,
  outgoing: 1,
  verticalSides: true,
};

/** Slots actually available on a side, for a spec and a wanted count. */
export function slotCountFor(side: "shared" | number, wanted: number): number {
  if (side === "shared") return 1;
  return Math.min(side, Math.max(1, wanted));
}
