import { useEffect, useRef } from "react";
import { useStore, type ReactFlowInstance } from "@xyflow/react";
import type { Diagram, DiagramModel, Flow } from "@/features/diagram";
import { getStepById, useDiagramStore } from "@/features/diagram";
import {
  FIT_VIEW_DURATION_MS,
  FIT_VIEW_INITIAL_PADDING,
  FIT_VIEW_MAX_ZOOM,
  FIT_VIEW_PADDING,
  FIT_VIEW_READING_PADDING,
  VIEWPORT_MIN_ZOOM,
  WHEEL_MAX_ZOOM,
} from "../canvas.constants";
import { useCanvasPreferencesStore } from "../preferences";
import { resolveWheelIntent } from "./resolve-wheel-intent";

interface UseCanvasEffectsParams {
  diagram: Diagram | DiagramModel | null | undefined;
  reactFlowInstance: ReactFlowInstance;
  isPlaying: boolean;
  activeFlow?: Flow | null;
  currentStepId?: string | null;
  onClearSelection: () => void;
  skipInitialFit?: boolean;
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
}: UseCanvasEffectsParams) {
  const diagramId = diagram?.id ?? null;
  const scrollMode = useCanvasPreferencesStore((state) => state.scrollMode);

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
    const wrapperEl = document.querySelector<HTMLElement>(".react-flow__renderer");
    if (!wrapperEl || !diagramId) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const viewport = reactFlowInstance.getViewport();
      const paneRect = wrapperEl.getBoundingClientRect();
      const intent = resolveWheelIntent(e, scrollMode, paneRect.height);

      if (intent.kind === "zoom") {
        const next = cursorCenteredZoom(
          viewport,
          { x: e.clientX, y: e.clientY },
          intent.factor,
          paneRect,
        );
        reactFlowInstance.setViewport(next, { duration: 0 });
        return;
      }

      reactFlowInstance.setViewport(
        { x: viewport.x - intent.dx, y: viewport.y - intent.dy, zoom: viewport.zoom },
        { duration: 0 },
      );
    };

    wrapperEl.addEventListener("wheel", handleWheel, { passive: false });
    return () => wrapperEl.removeEventListener("wheel", handleWheel);
  }, [reactFlowInstance, diagramId, scrollMode]);

  /**
   * Reframe when the reading gives the canvas its column back.
   *
   * The reading rail is a column beside the canvas, not a card over it, so
   * going in takes its width off the canvas and coming out hands it back.
   * React Flow keeps the viewport transform across a resize, and on the way
   * out nothing else reframes — the diagram would sit where the last step left
   * it, zoomed into a corner of a canvas that just grew.
   *
   * Waiting on the width React Flow reports rather than on a frame or two:
   * the size reaches its store through a ResizeObserver, and fitting before
   * that arrives measures against the width the canvas has just stopped
   * having. On the way in there is nothing to do here — the effect below
   * frames the step being read, and now waits on the same width.
   */
  const paneWidth = useStore((state) => state.width);
  const readingWasOpenRef = useRef(isPlaying);
  const reframeOnResizeRef = useRef(false);

  useEffect(() => {
    const wasOpen = readingWasOpenRef.current;
    readingWasOpenRef.current = isPlaying;
    // Assigned rather than raised, so a reading that opens again drops a
    // reframe the canvas never got round to: the way in has its own framing,
    // and an unclaimed flag would spend itself on that instead.
    reframeOnResizeRef.current = wasOpen && !isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    if (!reframeOnResizeRef.current) return;
    reframeOnResizeRef.current = false;

    // Next frame: leaving a reading re-renders every node as it comes back to
    // full strength, and a pan-and-zoom transition started in the middle of
    // that commit is dropped before it draws anything.
    let cancelled = false;
    const id = requestAnimationFrame(() => {
      if (cancelled) return;
      void reactFlowInstance.fitView({
        duration: FIT_VIEW_DURATION_MS,
        padding: FIT_VIEW_READING_PADDING,
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(id);
    };
  }, [paneWidth, reactFlowInstance]);

  useEffect(() => {
    if (!isPlaying || !activeFlow || !currentStepId) return;
    const step = getStepById(activeFlow, currentStepId);
    if (!step) return;

    let cancelled = false;
    // `paneWidth` is a dependency, not a value used here: opening the reading
    // rail narrows the canvas, and framing a step against the width it had a
    // moment ago puts it half a rail off centre. The width arrives through a
    // ResizeObserver, so it lands a beat after this effect first runs and this
    // run is cancelled in favour of one that measures the canvas it now has.
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (cancelled) return;

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
          return;
        }

        if (step.connectionId) {
          const edge = reactFlowInstance.getEdge(step.connectionId);
          if (!edge) return;
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
      });
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(id);
    };
  }, [isPlaying, activeFlow, currentStepId, paneWidth, reactFlowInstance]);
}
