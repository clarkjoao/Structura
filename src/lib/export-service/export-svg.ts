import { exportError } from "./export-error";
import type { Diagram } from "@/features/diagram";
import type { ReactFlowInstance } from "@xyflow/react";
import { toSvg } from "html-to-image";

export type ExportFraming = "viewport" | "full";

/**
 * Strip the data:image/svg+xml;charset=utf-8, prefix and decode the
 * percent-encoded payload that html-to-image wraps around the raw SVG.
 */
function decodeSvgDataUri(dataUri: string): string {
  const prefix = "data:image/svg+xml;charset=utf-8,";
  if (!dataUri.startsWith(prefix)) return dataUri;
  return decodeURIComponent(dataUri.slice(prefix.length));
}

/**
 * Export the current React Flow pane as a standalone SVG string.
 *
 * @param diagram - Diagram metadata (used for bounds computation).
 * @param framing - "viewport" captures the visible area; "full" fits all nodes.
 * @param reactFlowInstance - The React Flow instance to capture from.
 */
export async function exportSvg(
  diagram: Diagram,
  framing: ExportFraming,
  reactFlowInstance: ReactFlowInstance,
): Promise<string> {
  const pane = document.querySelector(".react-flow__pane") as HTMLElement | null;
  if (!pane) throw new Error("React Flow pane not found — is the canvas mounted?");

  if (framing === "full") {
    const bounds = computeFullBounds(reactFlowInstance);
    const width = Math.min(bounds.width, 4096);
    const height = Math.round((bounds.height / bounds.width) * width);

    if (width <= 0 || height <= 0) {
      throw new Error(`Invalid diagram bounds: ${width}×${height}px — the diagram may be empty`);
    }

    try {
      const dataUri = await toSvg(pane, {
        width,
        height,
        pixelRatio: 1,
        backgroundColor: "transparent",
      });
      return decodeSvgDataUri(dataUri);
    } catch (err) {
      throw exportError(`Failed to generate full-diagram SVG (${width}×${height}px)`, err);
    }
  }

  // viewport: capture at the current pane dimensions
  const rect = pane.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    throw new Error(
      `Invalid viewport dimensions: ${Math.round(rect.width)}×${Math.round(rect.height)}px`,
    );
  }

  try {
    const dataUri = await toSvg(pane, {
      width: rect.width,
      height: rect.height,
      pixelRatio: window.devicePixelRatio,
      backgroundColor: "transparent",
    });
    return decodeSvgDataUri(dataUri);
  } catch (err) {
    throw exportError(`Failed to generate viewport SVG`, err);
  }
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
