import { exportError } from "./export-error";
import type { Diagram } from "@/features/diagram";
import type { ReactFlowInstance } from "@xyflow/react";
import { toBlob } from "html-to-image";

export type ExportFraming = "viewport" | "full";

const MIN_WIDTH = 800;
const MIN_HEIGHT = 600;
const MAX_PHYSICAL_PX = 4096;

/**
 * Export the current React Flow pane as a PNG Blob.
 *
 * Uses html-to-image's `toBlob` which rasterizes the DOM directly to a canvas
 * and returns a Blob, avoiding the intermediate SVG step that loses foreignObject
 * content in the browser's image renderer.
 *
 * Quality settings:
 * - Always uses devicePixelRatio for sharp output on Retina/HiDPI screens.
 * - Full-diagram mode caps logical width so physical pixels stay under 4096px.
 * - Viewport mode captures at native resolution with a minimum of 800×600.
 */
export async function exportPng(
  diagram: Diagram,
  framing: ExportFraming,
  reactFlowInstance: ReactFlowInstance,
): Promise<Blob> {
  const pane = document.querySelector(".react-flow__pane") as HTMLElement | null;
  if (!pane) throw new Error("React Flow pane not found — is the canvas mounted?");

  const dpr = window.devicePixelRatio || 1;

  if (framing === "full") {
    const bounds = computeFullBounds(reactFlowInstance);
    // Cap logical width so physical pixels (logical × dpr) stay under MAX_PHYSICAL_PX.
    const maxLogicalW = Math.floor(MAX_PHYSICAL_PX / dpr);
    const { width, height } = clampSize(bounds.width, bounds.height, maxLogicalW);

    if (width <= 0 || height <= 0) {
      throw new Error(`Invalid diagram bounds: ${width}×${height}px — the diagram may be empty`);
    }

    try {
      const blob = await toBlob(pane, {
        width,
        height,
        pixelRatio: dpr,
        backgroundColor: "transparent",
      });
      if (!blob) throw new Error("PNG encoding returned empty result");
      return blob;
    } catch (err) {
      throw exportError(`Failed to generate full-diagram PNG (${width}×${height}px)`, err);
    }
  }

  // viewport: capture at native resolution, minimum 800×600
  const rect = pane.getBoundingClientRect();
  const { width, height } = clampSize(rect.width, rect.height);

  if (width <= 0 || height <= 0) {
    throw new Error(`Invalid viewport dimensions: ${Math.round(width)}×${Math.round(height)}px`);
  }

  try {
    const blob = await toBlob(pane, {
      width,
      height,
      pixelRatio: dpr,
      backgroundColor: "transparent",
    });
    if (!blob) throw new Error("PNG encoding returned empty result");
    return blob;
  } catch (err) {
    throw exportError(`Failed to generate viewport PNG`, err);
  }
}

function clampSize(
  width: number,
  height: number,
  maxWidth = Infinity,
): { width: number; height: number } {
  const w = Math.max(MIN_WIDTH, Math.min(width, maxWidth));
  const h = Math.max(MIN_HEIGHT, height);
  return { width: w, height: h };
}

/** Compute the bounding box that contains every node in the flow. */
function computeFullBounds(reactFlowInstance: ReactFlowInstance): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const nodes = reactFlowInstance.getNodes();
  if (nodes.length === 0) return { x: 0, y: 0, width: 800, height: 600 };

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const node of nodes) {
    const nx = node.position.x;
    const ny = node.position.y;
    const measured = node.measured;
    const w = measured?.width ?? 200;
    const h = measured?.height ?? 100;
    if (nx < minX) minX = nx;
    if (ny < minY) minY = ny;
    if (nx + w > maxX) maxX = nx + w;
    if (ny + h > maxY) maxY = ny + h;
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX || 800,
    height: maxY - minY || 600,
  };
}
