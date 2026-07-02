import { useEffect } from "react";
import type { ReactFlowInstance } from "@xyflow/react";
import type { Diagram, DiagramModel, Flow } from "@/features/diagram";
import { getStepById, useDiagramStore } from "@/features/diagram";
import {
  FIT_VIEW_DURATION_MS,
  FIT_VIEW_INITIAL_PADDING,
  FIT_VIEW_MAX_ZOOM,
  FIT_VIEW_PADDING,
  VIEWPORT_MIN_ZOOM,
} from "../canvas.constants";

interface UseCanvasEffectsParams {
  diagram: Diagram | DiagramModel | null | undefined;
  reactFlowInstance: ReactFlowInstance;
  isPlaying: boolean;
  activeFlow?: Flow | null;
  currentStepId?: string | null;
  onClearSelection: () => void;
  skipInitialFit?: boolean;
}

const MAX_ZOOM = 1;
const ZOOM_FACTOR = 1.1;

/**
 * New diagrams are created with viewport {0, 0, 1} (see diagram.slice.ts), so
 * a default viewport means "never panned/zoomed" and we fit the view instead.
 */
export function hasSavedViewport(
  viewport: { x: number; y: number; zoom: number } | undefined,
): viewport is { x: number; y: number; zoom: number } {
  if (!viewport) return false;
  return viewport.x !== 0 || viewport.y !== 0 || viewport.zoom !== 1;
}

export function useCanvasEffects({
  diagram,
  reactFlowInstance,
  isPlaying,
  activeFlow,
  currentStepId,
  onClearSelection,
  skipInitialFit = false,
}: UseCanvasEffectsParams) {
  const diagramId = diagram?.id ?? null;

  useEffect(() => {
    if (!diagramId || skipInitialFit) return;
    let cancelled = false;
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (cancelled) return;
        // Non-reactive read: subscribing to the viewport would re-run this
        // effect on every pan/zoom (onMoveEnd persists it to the store).
        const savedViewport = useDiagramStore.getState().diagrams[diagramId]?.viewport;
        if (hasSavedViewport(savedViewport)) {
          void reactFlowInstance.setViewport(savedViewport, { duration: 0 });
          return;
        }
        void reactFlowInstance.fitView({
          padding: FIT_VIEW_INITIAL_PADDING,
          minZoom: VIEWPORT_MIN_ZOOM,
          maxZoom: FIT_VIEW_MAX_ZOOM,
          duration: 0,
        });
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(id);
    };
  }, [diagramId, reactFlowInstance, skipInitialFit]);

  
  useEffect(() => {
    if (!isPlaying) return;
    onClearSelection();
  }, [isPlaying, onClearSelection]);

  
  useEffect(() => {
    const el = document.querySelector(".react-flow__renderer");
    if (!el || !diagramId) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { x, y, zoom } = reactFlowInstance.getViewport();

      if (e.ctrlKey || e.metaKey) {
        const factor = e.deltaY > 0 ? 1 / ZOOM_FACTOR : ZOOM_FACTOR;
        reactFlowInstance.setViewport(
          { x, y, zoom: Math.min(MAX_ZOOM, Math.max(VIEWPORT_MIN_ZOOM, zoom * factor)) },
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
  }, [reactFlowInstance, diagramId]);

  
  useEffect(() => {
    if (!isPlaying || !activeFlow || !currentStepId) return;
    const step = getStepById(activeFlow, currentStepId);
    if (!step) return;

    if (step.componentId) {
      const node = reactFlowInstance.getNode(step.componentId);
      if (node) {
        void reactFlowInstance.fitView({
          nodes: [{ id: step.componentId }],
          duration: FIT_VIEW_DURATION_MS,
          padding: FIT_VIEW_PADDING,
          maxZoom: FIT_VIEW_MAX_ZOOM,
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
            duration: FIT_VIEW_DURATION_MS,
            padding: FIT_VIEW_PADDING,
            maxZoom: FIT_VIEW_MAX_ZOOM,
          });
        }
      }
    }
  }, [isPlaying, activeFlow, currentStepId, reactFlowInstance]);
}
