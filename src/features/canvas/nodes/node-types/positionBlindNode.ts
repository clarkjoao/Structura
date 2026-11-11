import { memo } from "react";
import type { NodeTypes } from "@xyflow/react";

/**
 * Props React Flow hands a node renderer that only say where the node is.
 *
 * React Flow places the node itself (the wrapper's `transform`); no renderer
 * draws from these. They change on every frame of a drag, and with them every
 * dragged node's renderer re-ran — `memo` on the renderer could not help, its
 * shallow comparison saw two new numbers each frame. Measured on a 400-node
 * diagram with 169 nodes dragged together: ~40 long tasks per gesture, most of
 * it card renders and the forced layout their effects read.
 */
const POSITION_ONLY_PROPS: ReadonlySet<string> = new Set([
  "positionAbsoluteX",
  "positionAbsoluteY",
]);

/** Whether two renderer props differ in anything but where the node is. */
export function sameNodePropsIgnoringPosition(previous: object, next: object): boolean {
  const previousEntries = Object.entries(previous);
  if (previousEntries.length !== Object.keys(next).length) return false;
  for (const [key, value] of previousEntries) {
    if (POSITION_ONLY_PROPS.has(key)) continue;
    if (!Object.prototype.hasOwnProperty.call(next, key)) return false;
    if (!Object.is(value, Reflect.get(next, key))) return false;
  }
  return true;
}

type NodeRenderer = NodeTypes[string];

const wrapped = new WeakMap<NodeRenderer, NodeRenderer>();

/**
 * The renderer, skipping renders where only the node's position changed.
 * Cached per renderer, so the `nodeTypes` map keeps its identities across
 * registry rebuilds — a new identity would remount every node of that type.
 */
export function positionBlindNode(renderer: NodeRenderer): NodeRenderer {
  const cached = wrapped.get(renderer);
  if (cached) return cached;
  const next = memo(renderer, sameNodePropsIgnoringPosition);
  wrapped.set(renderer, next);
  return next;
}
