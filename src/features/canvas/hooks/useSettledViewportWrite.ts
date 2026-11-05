import { useCallback, useEffect, useRef } from "react";
import { useDiagramStore } from "@/features/diagram/store/diagram.store";

type Viewport = { x: number; y: number; zoom: number };
type WriteViewport = (viewport: Viewport, diagramId?: string) => void;

/** Quiet time after the last move-end before the viewport is written. */
export const VIEWPORT_SETTLE_MS = 200;

/**
 * Turns React Flow's `onMoveEnd` into one viewport write per gesture.
 *
 * The wheel handler applies one `setViewport` per animation frame, and React
 * Flow reports a move-end for each of them — 60 per second while panning. Each
 * write is a diagram-store `set()`, which serialises the whole workspace and
 * re-renders the canvas; on a large diagram that was most of the pan's cost.
 * The viewport is local (never synced), so only its persisted value matters,
 * and only once the gesture is over.
 *
 * The pending write remembers which diagram was panned, and is flushed before
 * anything can read a stale value: on any pointer or key press (an action the
 * user starts sees the viewport they are looking at), when the page is hidden
 * or left, when the diagram changes and when the canvas unmounts.
 */
export function useSettledViewportWrite(
  write: WriteViewport,
  delayMs: number = VIEWPORT_SETTLE_MS,
): (viewport: Viewport) => void {
  const writeRef = useRef(write);
  const pending = useRef<{ viewport: Viewport; diagramId: string | undefined } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    writeRef.current = write;
  }, [write]);

  const flush = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const next = pending.current;
    if (!next) return;
    pending.current = null;
    writeRef.current(next.viewport, next.diagramId);
  }, []);

  const schedule = useCallback(
    (viewport: Viewport) => {
      pending.current = {
        viewport,
        diagramId: useDiagramStore.getState().activeDiagramId ?? undefined,
      };
      if (timer.current !== null) clearTimeout(timer.current);
      timer.current = setTimeout(flush, delayMs);
    },
    [flush, delayMs],
  );

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pointerdown", flush, true);
    window.addEventListener("keydown", flush, true);
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", flush);
    document.addEventListener("visibilitychange", onVisibility);
    // A diagram switch flushes too: it changes `activeDiagramId` before React
    // unmounts anything, so watch the store rather than wait for cleanup.
    const unsubscribe = useDiagramStore.subscribe((state, previous) => {
      if (state.activeDiagramId !== previous.activeDiagramId) flush();
    });
    return () => {
      window.removeEventListener("pointerdown", flush, true);
      window.removeEventListener("keydown", flush, true);
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", flush);
      document.removeEventListener("visibilitychange", onVisibility);
      unsubscribe();
      flush();
    };
  }, [flush]);

  return schedule;
}
