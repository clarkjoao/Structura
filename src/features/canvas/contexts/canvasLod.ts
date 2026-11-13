import { createContext, useContext } from "react";
import { LOD_FAR_ENTER_ZOOM, LOD_FAR_EXIT_ZOOM } from "../canvas.constants";

/**
 * How much the canvas draws at the current zoom.
 *
 * - `full`: everything.
 * - `far`: zoomed out past the point where text and handles can be read. Edges
 *   draw their stroke and arrowheads only, and nodes hide their secondary
 *   content (through `data-lod` on the canvas, in CSS).
 */
export type CanvasLod = "full" | "far";

export const CanvasLodContext = createContext<CanvasLod>("full");
export const SetCanvasLodContext = createContext<((lod: CanvasLod) => void) | null>(null);

export function useCanvasLod(): CanvasLod {
  return useContext(CanvasLodContext);
}

/** The level for `zoom`, given the current one: entering and leaving `far` use two thresholds. */
export function nextCanvasLod(current: CanvasLod, zoom: number): CanvasLod {
  if (current === "full") return zoom < LOD_FAR_ENTER_ZOOM ? "far" : "full";
  return zoom > LOD_FAR_EXIT_ZOOM ? "full" : "far";
}
