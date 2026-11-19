import { useEffect, useRef } from "react";
import { useReactFlow, useStoreApi } from "@xyflow/react";
import type { CanvasVisualState } from "../hooks/useCanvasVisualState";
import { frameUnlessInView } from "../focus/focusComponents";
import { useHighlightRequests } from "../focus/highlightRequests";

/** A plugin lights elements it points at (API 1.11): brought into view only when they are not. */
export function usePluginHighlightRequests(visualState: CanvasVisualState): void {
  const reactFlowInstance = useReactFlow();
  const highlightRequest = useHighlightRequests((state) => state.request);
  const flowStore = useStoreApi();
  const handledHighlight = useRef(highlightRequest?.token ?? 0);
  useEffect(() => {
    if (!highlightRequest || highlightRequest.token === handledHighlight.current) return;
    handledHighlight.current = highlightRequest.token;
    const nodeIds = new Set(
      highlightRequest.componentIds.filter((id) => reactFlowInstance.getNode(id)),
    );
    const connectionIds = highlightRequest.connectionIds.filter((id) => {
      const edge = reactFlowInstance.getEdge(id);
      if (edge) [edge.source, edge.target].forEach((end) => nodeIds.add(end));
      return edge !== undefined;
    });
    if (nodeIds.size === 0) {
      visualState.clearHighlight();
      return;
    }
    visualState.setHighlight(connectionIds, [...nodeIds]);
    const { width, height } = flowStore.getState();
    frameUnlessInView(reactFlowInstance, [...nodeIds], { width, height });
  }, [highlightRequest, reactFlowInstance, flowStore, visualState]);
}
