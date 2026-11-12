import { useMemo } from "react";
import type { Node } from "@xyflow/react";
import { isTextComponent, type useResolvedComponents } from "@/features/diagram";
import type { CanvasVisualState } from "./useCanvasVisualState";

/**
 * The selected nodes as React Flow draws them, and whether the element panel
 * shows. With nothing selected the panel shows the diagram's own properties.
 */
export function useElementPanelGate({
  nodes,
  visualState,
  resolvedComponents,
  canEditCanvas,
}: {
  nodes: Node[];
  visualState: CanvasVisualState;
  resolvedComponents: ReturnType<typeof useResolvedComponents>;
  canEditCanvas: boolean;
}) {
  const selectedNodes = useMemo(
    () => nodes.filter((node) => visualState.selectedNodeIds.has(node.id)),
    [nodes, visualState.selectedNodeIds],
  );
  const selectedCount = visualState.selectedNodeIds.size;
  // A lone text is edited on the canvas and styled from its floating bar; the
  // side panel would only offer a type switch and fields it has no use for.
  const selectedComponent = visualState.selectedNodeId
    ? resolvedComponents[visualState.selectedNodeId]
    : undefined;
  const isLoneTextSelected =
    selectedCount <= 1 &&
    !visualState.selectedEdgeId &&
    selectedComponent !== undefined &&
    isTextComponent(selectedComponent);
  const showElementPanel =
    !isLoneTextSelected &&
    canEditCanvas &&
    visualState.noteInlineEditingId === null &&
    visualState.jsonViewerInlineEditingId === null;
  return { selectedNodes, selectedCount, showElementPanel };
}
