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
  WHEEL_MAX_ZOOM,
  WHEEL_ZOOM_FACTOR,
} from "../canvas.constants";
import type { CanvasInputProfile } from "./useCanvasInputProfile";

interface UseCanvasEffectsParams {
  diagram: Diagram | DiagramModel | null | undefined;
  reactFlowInstance: ReactFlowInstance;
  isPlaying: boolean;
  activeFlow?: Flow | null;
  currentStepId?: string | null;
  onClearSelection: () => void;
  skipInitialFit?: boolean;
  inputProfile: CanvasInputProfile;
}

interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

function clampZoom(zoom: number): number {
  return Math.min(WHEEL_MAX_ZOOM, Math.max(VIEWPORT_MIN_ZOOM, zoom));
}

function cursorCenteredZoom(
  viewport: Viewport,
  cursor: { x: number; y: number } | null,
  factor: number,
  paneRect: DOMRect | null,
): Viewport {
  const nextZoom = clampZoom(viewport.zoom * factor);
  if (!cursor || !paneRect) {
    return { x: viewport.x, y: viewport.y, zoom: nextZoom };
  }
  const offsetX = cursor.x - paneRect.left;
  const offsetY = cursor.y - paneRect.top;
  const worldX = (offsetX - viewport.x) / viewport.zoom;
  const worldY = (offsetY - viewport.y) / viewport.zoom;
  return {
    x: offsetX - worldX * nextZoom,
    y: offsetY - worldY * nextZoom,
    zoom: nextZoom,
  };
}

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
  inputProfile,
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
    const el = document.querySelector<HTMLElement>(".react-flow__renderer");
    if (!el || !diagramId) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const viewport = reactFlowInstance.getViewport();
      const isTrackpad = inputProfile.likelyTrackpad;
      const paneRect = el.getBoundingClientRect();

      // Horizontal pan is identical across devices.
      if (e.shiftKey && !e.ctrlKey && !e.metaKey) {
        reactFlowInstance.setViewport(
          { x: viewport.x - e.deltaY, y: viewport.y, zoom: viewport.zoom },
          { duration: 0 },
        );
        return;
      }

      // Zoom: cursor-centered (or in-place when no cursor info).
      const isZoomGesture = e.ctrlKey || e.metaKey || !isTrackpad;
      if (isZoomGesture) {
        const factor = e.deltaY > 0 ? 1 / WHEEL_ZOOM_FACTOR : WHEEL_ZOOM_FACTOR;
        const next = cursorCenteredZoom(viewport, { x: e.clientX, y: e.clientY }, factor, paneRect);
        reactFlowInstance.setViewport(next, { duration: 0 });
        return;
      }

      // Trackpad plain wheel: pan using both axes. Content follows the fingers:
      // a downward two-finger swipe (deltaY > 0) should move the content down.
      reactFlowInstance.setViewport(
        { x: viewport.x - e.deltaX, y: viewport.y - e.deltaY, zoom: viewport.zoom },
        { duration: 0 },
      );
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [reactFlowInstance, diagramId, inputProfile.likelyTrackpad]);

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
