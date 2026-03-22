/**
 * Effects do canvas: wheel zoom/pan, flow playback focus, clear selection on play.
 */
import { useEffect } from "react";
import type { ReactFlowInstance } from "@xyflow/react";
import type { Diagram, Flow } from "@/features/diagram";
import { getStepById } from "@/features/diagram";

interface UseCanvasEffectsParams {
  diagram: Diagram | null | undefined;
  reactFlowInstance: ReactFlowInstance;
  isPlaying: boolean;
  activeFlow?: Flow | null;
  currentStepId?: string | null;
  onClearSelection: () => void;
}

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 1;
const ZOOM_FACTOR = 1.1;

export function useCanvasEffects({
  diagram,
  reactFlowInstance,
  isPlaying,
  activeFlow,
  currentStepId,
  onClearSelection,
}: UseCanvasEffectsParams) {
  // Clear selection when playback starts
  useEffect(() => {
    if (!isPlaying) return;
    onClearSelection();
  }, [isPlaying, onClearSelection]);

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

  // Fit viewport on the element highlighted during flow playback
  useEffect(() => {
    if (!isPlaying || !activeFlow || !currentStepId) return;
    const step = getStepById(activeFlow, currentStepId);
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
          void reactFlowInstance.fitView({
            nodes: [{ id: edge.source }, { id: edge.target }],
            duration: 400,
            padding: 0.35,
            maxZoom: 1.5,
          });
        }
      }
    }
  }, [isPlaying, activeFlow, currentStepId, reactFlowInstance]);
}
