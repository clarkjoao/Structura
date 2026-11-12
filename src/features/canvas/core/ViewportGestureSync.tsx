import { useCallback, useEffect, useRef } from "react";
import { useOnViewportChange, useStore } from "@xyflow/react";

/**
 * How long the viewport has to stay still before it counts as at rest. A wheel
 * pan moves the viewport programmatically, one start and one end per wheel
 * event: without this wait the mark would come and go on every tick.
 */
export const VIEWPORT_REST_MS = 200;

/**
 * Marks the React Flow wrapper with `data-viewport-moving` while the viewport
 * pans or zooms (a wheel, a pinch, a pane drag, a fit), for the stylesheet.
 *
 * What it is for: panels blur what is behind them (`data-canvas-blur` in
 * `index.css`), and while the viewport moves that blur makes the compositor
 * re-layerize the canvas on every frame. Measured at 1000 nodes, zoom 0.73,
 * nine panels on screen: 30 wheel ticks cost 6 long tasks (~415 ms) with the
 * blur and none without it. The mark is cleared `VIEWPORT_REST_MS` after the
 * last movement, so the canvas at rest looks as before. Rendered inside
 * `<ReactFlow>`.
 */
export function ViewportGestureSync() {
  const domNode = useStore((state) => state.domNode);
  const restTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelRest = useCallback(() => {
    if (restTimer.current === null) return;
    clearTimeout(restTimer.current);
    restTimer.current = null;
  }, []);
  const onStart = useCallback(() => {
    cancelRest();
    if (domNode instanceof HTMLElement && domNode.dataset.viewportMoving === undefined) {
      domNode.dataset.viewportMoving = "";
    }
  }, [cancelRest, domNode]);
  const onEnd = useCallback(() => {
    cancelRest();
    restTimer.current = setTimeout(() => {
      restTimer.current = null;
      if (domNode instanceof HTMLElement) delete domNode.dataset.viewportMoving;
    }, VIEWPORT_REST_MS);
  }, [cancelRest, domNode]);
  useEffect(() => cancelRest, [cancelRest]);

  useOnViewportChange({ onStart, onEnd });
  return null;
}
