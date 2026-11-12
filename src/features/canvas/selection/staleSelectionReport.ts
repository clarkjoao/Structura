import type { InternalNode } from "@xyflow/react";

/**
 * Whether a selection React Flow reports through `onSelectionChange` is already
 * out of date when it arrives.
 *
 * React Flow's selection listener reports the selection it read when it last
 * rendered, from an effect. Its `StoreUpdater` runs its own effect first, in the
 * same commit, and hands React Flow the nodes this render projected from the
 * selection store. So when the store and React Flow's own selection change in
 * the same gesture (a marquee started inside a selected container: React Flow
 * marks the container selected on its internal node, the store is cleared), the
 * listener reports the selection the store just replaced. Writing it back to
 * the store projects it to React Flow, whose next report is the value it held a
 * moment ago, and so on: the two swap on every commit until React gives up with
 * "Maximum update depth exceeded" (#185).
 *
 * A stale report carries nothing new: React Flow's current selection differs
 * from it, so the listener reports again on its next render with that one.
 * Dropping it is what lets the two settle.
 */
export function isStaleSelectionReport(
  reportedIds: readonly string[],
  nodeLookup: ReadonlyMap<string, InternalNode>,
): boolean {
  let liveCount = 0;
  const reported = new Set(reportedIds);
  for (const node of nodeLookup.values()) {
    // The same rule the report itself was built with: React Flow's internal flag,
    // read through the user node it hands out.
    if (!node.selected || !node.internals.userNode.selected) continue;
    if (!reported.has(node.id)) return true;
    liveCount++;
  }
  return liveCount !== reported.size;
}
