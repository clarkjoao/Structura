/**
 * Effects do canvas: wheel zoom/pan, flow playback focus, clear selection on play.
 */
import { useEffect } from "react";
import type { ReactFlowInstance } from "@xyflow/react";
import type { Diagram, Flow } from "@/features/diagram";

interface UseCanvasEffectsParams {
  diagram: Diagram | null | undefined;
  reactFlowInstance: ReactFlowInstance;
  isPlaying: boolean;
  activeFlow?: Flow | null;
  currentStep?: number;
  onClearSelection: () => void;
}

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 4;
const ZOOM_FACTOR = 1.1;
const DEFAULT_NODE_W = 160;
const DEFAULT_NODE_H = 80;

export function useCanvasEffects({
  diagram,
  reactFlowInstance,
  isPlaying,
  activeFlow,
  currentStep,
  onClearSelection,
}: UseCanvasEffectsParams) {
  // Clear selection when playback starts
  useEffect(() => {
    if (!isPlaying) return;
    onClearSelection();
    reactFlowInstance.setNodes((nodes) =>
      nodes.map((node) => ({ ...node, selected: false })),
    );
  }, [isPlaying, onClearSelection, reactFlowInstance]);

  // Wheel: zoom (Ctrl/Cmd), horizontal pan (Shift), vertical pan
  useEffect(() => {
    const el = document.querySelector(".react-flow__renderer");
    if (!el || !diagram) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { x, y, zoom } = reactFlowInstance.getViewport();

      if (e.ctrlKey || e.metaKey) {
        const factor = e.deltaY > 0 ? 1 / ZOOM_FACTOR : ZOOM_FACTOR;
        reactFlowInstance.setViewport(
          { x, y, zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * factor)) },
          { duration: 0 },
        );
      } else if (e.shiftKey) {
        reactFlowInstance.setViewport(
          { x: x - e.deltaY, y, zoom },
          { duration: 0 },
        );
      } else {
        reactFlowInstance.setViewport(
          { x, y: y - e.deltaY, zoom },
          { duration: 0 },
        );
      }
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [reactFlowInstance, diagram]);

  // Focus viewport on current flow step
  useEffect(() => {
    if (!activeFlow) return;
    const step = activeFlow.steps[currentStep ?? 0];
    if (!step) return;

    if (step.componentId) {
      const node = reactFlowInstance.getNode(step.componentId);
      if (node) {
        void reactFlowInstance.fitView({
          nodes: [{ id: step.componentId }],
          duration: 400,
          padding: 0.35,
          maxZoom: 1.5,
        });
      }
    } else if (step.connectionId) {
      const edge = reactFlowInstance.getEdge(step.connectionId);
      if (edge) {
        const srcNode = reactFlowInstance.getNode(edge.source);
        const tgtNode = reactFlowInstance.getNode(edge.target);
        if (srcNode && tgtNode) {
          const sx = srcNode.position.x + (srcNode.measured?.width ?? DEFAULT_NODE_W) / 2;
          const sy = srcNode.position.y + (srcNode.measured?.height ?? DEFAULT_NODE_H) / 2;
          const tx = tgtNode.position.x + (tgtNode.measured?.width ?? DEFAULT_NODE_W) / 2;
          const ty = tgtNode.position.y + (tgtNode.measured?.height ?? DEFAULT_NODE_H) / 2;
          const { zoom } = reactFlowInstance.getViewport();
          void reactFlowInstance.setCenter((sx + tx) / 2, (sy + ty) / 2, {
            duration: 400,
            zoom: Math.min(Math.max(zoom, 0.8), 1.5),
          });
        }
      }
    }
  }, [activeFlow, currentStep, reactFlowInstance]);
}
