import type { FlowNodeShape } from "@/features/diagram/model/component.types";

/**
 * The geometry of every flowchart shape, as pure functions of the node's box.
 *
 * Paths are generated from `(w, h)` rather than drawn once in a fixed viewBox
 * and stretched with `preserveAspectRatio="none"`: stretching distorts the
 * curves — the cylinder's cap turns into a lozenge on a wide node — while the
 * parts of a shape that carry meaning keep a fixed size here and only the
 * straight runs grow.
 *
 * Handles come from the same function as the outline so they sit on the shape
 * itself: on the diamond's vertices, halfway down the parallelogram's slanted
 * edges, on the cylinder's cap. A handle placed on the bounding box instead
 * floats in the air beside any shape that does not fill it.
 */

export interface Point {
  x: number;
  y: number;
}

/** One handle per side, where that side of the shape actually is. */
export interface FlowShapeHandles {
  left: Point;
  right: Point;
  top: Point;
  bottom: Point;
}

/** Half the outline stroke, so a 1.5px stroke is not clipped by the node's box. */
const INSET = 1;

/** Corner radius of the process rectangle, same as a C4 card (`--radius`). */
export const PROCESS_RADIUS = 8;
/** Corner radius of the alternative process. */
export const ROUNDED_RADIUS = 18;
/** Horizontal run of the input/output parallelogram's slanted edges. */
export const IO_SLANT = 18;
/** Horizontal run of the preparation hexagon's pointed ends. */
export const HEXAGON_CUT = 18;
/** Vertical radius of the cylinder's caps — fixed, so the cap never flattens or balloons. */
export const CYLINDER_CAP_RY = 13;

/** Keeps a fixed feature from eating more than a quarter of a small node. */
function clampFeature(size: number, span: number): number {
  return Math.max(0, Math.min(size, span / 4));
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function roundedRectPath(w: number, h: number, radius: number): string {
  const x0 = INSET;
  const y0 = INSET;
  const x1 = w - INSET;
  const y1 = h - INSET;
  const r = Math.max(0, Math.min(radius, (x1 - x0) / 2, (y1 - y0) / 2));
  return [
    `M${round(x0 + r)} ${round(y0)}`,
    `H${round(x1 - r)}`,
    `A${round(r)} ${round(r)} 0 0 1 ${round(x1)} ${round(y0 + r)}`,
    `V${round(y1 - r)}`,
    `A${round(r)} ${round(r)} 0 0 1 ${round(x1 - r)} ${round(y1)}`,
    `H${round(x0 + r)}`,
    `A${round(r)} ${round(r)} 0 0 1 ${round(x0)} ${round(y1 - r)}`,
    `V${round(y0 + r)}`,
    `A${round(r)} ${round(r)} 0 0 1 ${round(x0 + r)} ${round(y0)}`,
    "Z",
  ].join(" ");
}

function diamondPath(w: number, h: number): string {
  return (
    `M${round(w / 2)} ${INSET} L${round(w - INSET)} ${round(h / 2)} ` +
    `L${round(w / 2)} ${round(h - INSET)} L${INSET} ${round(h / 2)} Z`
  );
}

function hexagonPath(w: number, h: number): string {
  const cut = clampFeature(HEXAGON_CUT, w);
  return (
    `M${round(cut + INSET)} ${INSET} H${round(w - cut - INSET)} L${round(w - INSET)} ${round(h / 2)} ` +
    `L${round(w - cut - INSET)} ${round(h - INSET)} H${round(cut + INSET)} L${INSET} ${round(h / 2)} Z`
  );
}

function parallelogramPath(w: number, h: number): string {
  const slant = clampFeature(IO_SLANT, w);
  return (
    `M${round(slant + INSET)} ${INSET} H${round(w - INSET)} ` +
    `L${round(w - slant - INSET)} ${round(h - INSET)} H${INSET} Z`
  );
}

/** The cylinder's body: sides plus the bottom cap's front curve. The top cap is drawn apart. */
function cylinderPath(w: number, h: number): string {
  const ry = clampFeature(CYLINDER_CAP_RY, h);
  const rx = (w - 2 * INSET) / 2;
  return (
    `M${INSET} ${round(ry + INSET)} ` +
    `V${round(h - ry - INSET)} ` +
    `A${round(rx)} ${round(ry)} 0 0 0 ${round(w - INSET)} ${round(h - ry - INSET)} ` +
    `V${round(ry + INSET)} ` +
    `A${round(rx)} ${round(ry)} 0 0 0 ${INSET} ${round(ry + INSET)} Z`
  );
}

function ellipsePath(w: number, h: number): string {
  const rx = (w - 2 * INSET) / 2;
  const ry = (h - 2 * INSET) / 2;
  return (
    `M${INSET} ${round(h / 2)} ` +
    `A${round(rx)} ${round(ry)} 0 1 1 ${round(w - INSET)} ${round(h / 2)} ` +
    `A${round(rx)} ${round(ry)} 0 1 1 ${INSET} ${round(h / 2)} Z`
  );
}

/** The outline of `shape` at `w × h`, as an SVG path in node-local pixels. */
export function flowShapePath(shape: FlowNodeShape, w: number, h: number): string {
  switch (shape) {
    case "rectangle":
    case "subroutine":
      return roundedRectPath(w, h, PROCESS_RADIUS);
    case "rounded":
      return roundedRectPath(w, h, ROUNDED_RADIUS);
    case "stadium":
      return roundedRectPath(w, h, Math.min(w, h) / 2);
    case "diamond":
      return diamondPath(w, h);
    case "hexagon":
      return hexagonPath(w, h);
    case "parallelogram":
      return parallelogramPath(w, h);
    case "cylinder":
      return cylinderPath(w, h);
    case "circle":
      return ellipsePath(w, h);
    default: {
      const exhaustive: never = shape;
      return exhaustive;
    }
  }
}

/** The cylinder's top cap, drawn over the body so the accent can paint it alone. */
export function cylinderTopCap(
  w: number,
  h: number,
): { cx: number; cy: number; rx: number; ry: number } {
  const ry = clampFeature(CYLINDER_CAP_RY, h);
  return { cx: round(w / 2), cy: round(ry + INSET), rx: round((w - 2 * INSET) / 2), ry: round(ry) };
}

/**
 * The stroke that carries the accent on a shape whose accent is an edge rather
 * than a bar: the input/output's left slanted edge, the preparation hexagon's
 * left point. `null` for shapes that take their accent some other way.
 */
export function flowShapeAccentPath(shape: FlowNodeShape, w: number, h: number): string | null {
  if (shape === "parallelogram") {
    const slant = clampFeature(IO_SLANT, w);
    return `M${round(slant + INSET + 0.5)} ${INSET + 0.5} L${INSET + 0.5} ${round(h - INSET - 0.5)}`;
  }
  if (shape === "hexagon") {
    const cut = clampFeature(HEXAGON_CUT, w);
    return (
      `M${round(cut + INSET + 0.5)} ${INSET + 0.5} L${INSET + 0.5} ${round(h / 2)} ` +
      `L${round(cut + INSET + 0.5)} ${round(h - INSET - 0.5)}`
    );
  }
  return null;
}

/** Where the four handles of `shape` sit at `w × h`. */
export function flowShapeHandles(shape: FlowNodeShape, w: number, h: number): FlowShapeHandles {
  const box: FlowShapeHandles = {
    left: { x: 0, y: h / 2 },
    right: { x: w, y: h / 2 },
    top: { x: w / 2, y: 0 },
    bottom: { x: w / 2, y: h },
  };
  if (shape === "parallelogram") {
    // Halfway down each slanted edge, not on the box: the box's left midpoint
    // is outside the shape by half the slant.
    const slant = clampFeature(IO_SLANT, w);
    return {
      ...box,
      left: { x: round(slant / 2), y: h / 2 },
      right: { x: round(w - slant / 2), y: h / 2 },
    };
  }
  return box;
}

/**
 * The box a new node of each shape is created at — declared, not left to the
 * content, so the editor, the reader and auto-layout all agree on it. Existing
 * nodes keep the size they were stored with.
 */
export const FLOW_SHAPE_DEFAULT_SIZE: Record<FlowNodeShape, { width: number; height: number }> = {
  rectangle: { width: 220, height: 72 },
  rounded: { width: 220, height: 72 },
  subroutine: { width: 220, height: 88 },
  stadium: { width: 210, height: 50 },
  diamond: { width: 180, height: 112 },
  hexagon: { width: 210, height: 64 },
  parallelogram: { width: 230, height: 64 },
  cylinder: { width: 150, height: 108 },
  circle: { width: 80, height: 80 },
};
