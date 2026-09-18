import type { Node } from "@xyflow/react";
import { focusDimOverlay, selectedOverlay } from "../nodes/nodeOverlays";
import type { ViewSnapshot } from "./resolveViewSnapshot";

/**
 * The editor's focus dim on a reader's nodes: with a node focused, or an edge
 * highlighted, every node that has not got the focus is dimmed, exactly as
 * `focusDimOverlay` dims them in the editor (a focused panel keeps its
 * children lit). The focused node is marked `selected`, so every node type —
 * card, panel, group, note, custom — draws the ring it draws in the editor. While a flow is being read the flow owns opacity
 * and the dim stands down, as it does in the editor.
 *
 * `nodes` must be the projection of `view` (`nodes[i]` drawn from
 * `view.nodes[i]`). Every node handed back carries the size React Flow
 * measured for it (`measuredOf`): a node object without `measured` makes
 * React Flow drop its size and handles and hide it, with its edges, until it
 * is measured again — a blank frame each time the highlight comes or goes.
 */
export function withReaderFocus(
  nodes: readonly Node[],
  view: ViewSnapshot,
  focusedNodeIds: Set<string>,
  highlightedNodeIds: Set<string>,
  flowModeActive: boolean,
  measuredOf: (id: string) => Node["measured"] | undefined,
): Node[] {
  return nodes.map((node, i) => {
    const viewNode = view.nodes[i];
    let next = node;
    if (viewNode) {
      next = selectedOverlay(next, viewNode, focusedNodeIds);
      if (!flowModeActive && (focusedNodeIds.size > 0 || highlightedNodeIds.size > 0)) {
        next = focusDimOverlay(next, viewNode, focusedNodeIds, highlightedNodeIds, false);
      }
    }
    const measured = measuredOf(node.id);
    return measured ? { ...next, measured } : next;
  });
}
