import { useContext, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useStore } from "@xyflow/react";
import { CanvasLodContext, SetCanvasLodContext, nextCanvasLod, type CanvasLod } from "./canvasLod";

/**
 * Holds the level of detail for one canvas surface (`canvasLod.ts`). Like
 * `LineHopsProvider` it wraps `<ReactFlow>`, because edges are rendered by
 * React Flow, not by its children. The value changes only when the zoom crosses
 * the threshold — one notification per crossing, never one per zoom frame.
 */
export function CanvasLodProvider({ children }: { children: ReactNode }) {
  const [lod, setLod] = useState<CanvasLod>("full");
  return (
    <SetCanvasLodContext.Provider value={setLod}>
      <CanvasLodContext.Provider value={lod}>{children}</CanvasLodContext.Provider>
    </SetCanvasLodContext.Provider>
  );
}

/**
 * The one zoom subscriber that drives the level: it publishes it to the
 * context and writes `data-lod` on the React Flow wrapper for the stylesheet.
 * Rendered inside `<ReactFlow>`, next to `EdgeLabelPortalHost`.
 */
export function CanvasLodSync() {
  const setLod = useContext(SetCanvasLodContext);
  const zoom = useStore((state) => state.transform[2]);
  const domNode = useStore((state) => state.domNode);
  const current = useRef<CanvasLod>("full");

  useLayoutEffect(() => {
    const next = nextCanvasLod(current.current, zoom);
    if (domNode instanceof HTMLElement && domNode.dataset.lod !== next) {
      domNode.dataset.lod = next;
    }
    if (next === current.current) return;
    current.current = next;
    setLod?.(next);
  }, [zoom, domNode, setLod]);

  return null;
}
