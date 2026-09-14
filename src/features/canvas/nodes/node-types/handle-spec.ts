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

/** Slots actually available on a side, for a spec and a wanted count. */
export function slotCountFor(side: "shared" | number, wanted: number): number {
  if (side === "shared") return 1;
  return Math.min(side, Math.max(1, wanted));
}
