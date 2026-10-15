import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useStore, type ReactFlowState } from "@xyflow/react";
import { placeFloatingToolbar, type ScreenRect, type ScreenSize } from "./floatingToolbarPlacement";

/** A box in flow coordinates. */
export interface FlowRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface FloatingSelectionToolbarProps {
  /** Nodes the toolbar acts on; with several it follows their bounding box. */
  nodeIds?: readonly string[];
  /** A box in flow coordinates, for what is not a node (an edge's label point). */
  flowRect?: FlowRect;
  children: ReactNode;
}

interface View {
  rect: ScreenRect | null;
  viewport: ScreenSize;
}

const TOOLBAR_Z_INDEX = 5;

function flowBounds(state: ReactFlowState, nodeIds?: readonly string[]): FlowRect | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const id of nodeIds ?? []) {
    const node = state.nodeLookup.get(id);
    if (!node || node.hidden) continue;
    const at = node.internals.positionAbsolute;
    const width = node.measured.width ?? node.width ?? 0;
    const height = node.measured.height ?? node.height ?? 0;
    minX = Math.min(minX, at.x);
    minY = Math.min(minY, at.y);
    maxX = Math.max(maxX, at.x + width);
    maxY = Math.max(maxY, at.y + height);
  }
  if (minX === Infinity) return null;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function sameView(a: View, b: View): boolean {
  if (a === b) return true;
  if (a.viewport.width !== b.viewport.width || a.viewport.height !== b.viewport.height) {
    return false;
  }
  if (a.rect === null || b.rect === null) return a.rect === b.rect;
  return (
    a.rect.x === b.rect.x &&
    a.rect.y === b.rect.y &&
    a.rect.width === b.rect.width &&
    a.rect.height === b.rect.height
  );
}

/**
 * The selection's toolbar, drawn in screen space instead of inside the
 * zoomed viewport. Two things follow from that and are the point of it:
 *
 *  - It is the same size at every zoom; a toolbar inside the viewport shrinks
 *    to nothing when zoomed out and balloons when zoomed in.
 *  - It is placed against the canvas, not the node, so it stays on screen and
 *    reachable when the selection is a group bigger than the viewport.
 *
 * Children are the caller's own elements, so a viewport change re-renders only
 * this wrapper, never the toolbar's contents.
 */
export function FloatingSelectionToolbar({
  nodeIds,
  flowRect,
  children,
}: FloatingSelectionToolbarProps) {
  const domNode = useStore((state) => state.domNode);
  const view = useStore((state): View => {
    const [tx, ty, zoom] = state.transform;
    const box = flowRect ?? flowBounds(state, nodeIds);
    return {
      viewport: { width: state.width, height: state.height },
      rect: box && {
        x: box.x * zoom + tx,
        y: box.y * zoom + ty,
        width: box.width * zoom,
        height: box.height * zoom,
      },
    };
  }, sameView);

  const hasTarget = view.rect !== null;
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<ScreenSize | null>(null);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => {
      const { offsetWidth: width, offsetHeight: height } = element;
      setSize((prev) =>
        prev && prev.width === width && prev.height === height ? prev : { width, height },
      );
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [domNode, hasTarget]);

  if (!domNode || !view.rect) return null;

  const placement = size
    ? placeFloatingToolbar({ target: view.rect, toolbar: size, viewport: view.viewport })
    : null;

  return createPortal(
    <div
      ref={ref}
      className="nodrag nopan pointer-events-auto absolute left-0 top-0 w-max"
      style={{
        zIndex: TOOLBAR_Z_INDEX,
        visibility: placement ? "visible" : "hidden",
        transform: placement ? `translate(${placement.x}px, ${placement.y}px)` : undefined,
      }}
      data-toolbar-side={placement?.side}
    >
      {children}
    </div>,
    domNode,
  );
}
