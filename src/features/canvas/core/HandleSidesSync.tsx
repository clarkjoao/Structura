import { useEffect, useRef } from "react";
import { useStoreApi, useUpdateNodeInternals } from "@xyflow/react";
import type { ReadingDirection } from "../nodes/node-types/handle-sides";

/**
 * Re-measures every node's handles when the reading direction changes.
 *
 * React Flow keeps each node's handle positions from its last measurement and
 * only measures again when the node's size changes. Switching the direction
 * moves every handle to another side without resizing anything, so edges kept
 * leaving from where the handles used to be — the right side of a node whose
 * output now sits at the bottom. Rendered inside `<ReactFlow>`, after the nodes
 * have drawn their handles on the new sides.
 */
export function HandleSidesSync({ direction }: { direction: ReadingDirection }) {
  const updateNodeInternals = useUpdateNodeInternals();
  const store = useStoreApi();
  const previous = useRef(direction);

  useEffect(() => {
    if (previous.current === direction) return;
    previous.current = direction;
    const frame = requestAnimationFrame(() => {
      updateNodeInternals(store.getState().nodes.map((node) => node.id));
    });
    return () => cancelAnimationFrame(frame);
  }, [direction, store, updateNodeInternals]);

  return null;
}
