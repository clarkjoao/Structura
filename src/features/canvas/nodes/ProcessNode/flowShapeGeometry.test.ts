import { describe, expect, it } from "vitest";
import type { FlowNodeShape } from "@/features/diagram/model/component.types";
import { CARD_MAX_W, CARD_MIN_W } from "../CardNode/constants";
import {
  CYLINDER_CAP_RY,
  DOCUMENT_WAVE_RISE,
  FLOW_SHAPE_DEFAULT_SIZE,
  IO_SLANT,
  cylinderTopCap,
  flowShapeAccentPath,
  flowShapeHandles,
  flowShapePath,
  isOpenShape,
  readFlowShape,
  type Point,
} from "./flowShapeGeometry";

const SHAPES: FlowNodeShape[] = [
  "rectangle",
  "rounded",
  "stadium",
  "diamond",
  "hexagon",
  "parallelogram",
  "cylinder",
  "circle",
  "subroutine",
  "start",
  "end",
  "document",
  "event",
  "junction-and",
  "junction-or",
  "annotation",
  "evidence",
];

const SIZES: Array<[number, number]> = [
  [60, 60],
  [160, 60],
  [220, 78],
  [180, 112],
  [400, 240],
];

/** Every number in a path, in order — enough to bound-check the coordinates it visits. */
function numbers(d: string): number[] {
  return (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
}

const onSegment = (p: Point, a: Point, b: Point): boolean => {
  const cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
  const within =
    p.x >= Math.min(a.x, b.x) - 1e-6 &&
    p.x <= Math.max(a.x, b.x) + 1e-6 &&
    p.y >= Math.min(a.y, b.y) - 1e-6 &&
    p.y <= Math.max(a.y, b.y) + 1e-6;
  return Math.abs(cross) < 1e-6 * Math.hypot(b.x - a.x, b.y - a.y) && within;
};

describe("flowShapePath", () => {
  it.each(SHAPES)("draws a closed, non-empty %s at every size", (shape) => {
    for (const [w, h] of SIZES) {
      const d = flowShapePath(shape, w, h);
      expect(d.startsWith("M")).toBe(true);
      expect(d.trim().endsWith("Z")).toBe(!isOpenShape(shape));
      expect(d).not.toMatch(/NaN|Infinity/);
    }
  });

  it("scales with the box instead of being a fixed drawing", () => {
    expect(flowShapePath("diamond", 180, 112)).not.toBe(flowShapePath("diamond", 360, 112));
  });

  it("keeps the diamond's coordinates inside the box", () => {
    for (const [w, h] of SIZES) {
      const values = numbers(flowShapePath("diamond", w, h));
      for (const v of values) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(Math.max(w, h));
      }
    }
  });

  it("keeps the cylinder cap at a fixed radius whatever the height", () => {
    expect(cylinderTopCap(150, 108).ry).toBe(CYLINDER_CAP_RY);
    expect(cylinderTopCap(150, 400).ry).toBe(CYLINDER_CAP_RY);
    expect(cylinderTopCap(300, 108).ry).toBe(CYLINDER_CAP_RY);
  });

  it("keeps the io slant fixed on a wide node", () => {
    const narrow = numbers(flowShapePath("parallelogram", 230, 64));
    const wide = numbers(flowShapePath("parallelogram", 460, 64));
    // First move: M(slant + inset) inset — the slant does not grow with the width.
    expect(narrow[0]).toBe(wide[0]);
    expect(narrow[0]).toBe(IO_SLANT + 1);
  });
});

describe("flowShapeHandles", () => {
  it.each(SHAPES)("puts every %s handle inside or on the box", (shape) => {
    for (const [w, h] of SIZES) {
      const handles = flowShapeHandles(shape, w, h);
      for (const p of Object.values(handles)) {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(w);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThanOrEqual(h);
      }
    }
  });

  it("puts one handle at the centre of each side", () => {
    const handles = flowShapeHandles("rectangle", 220, 78);
    expect(handles).toEqual({
      left: { x: 0, y: 39 },
      right: { x: 220, y: 39 },
      top: { x: 110, y: 0 },
      bottom: { x: 110, y: 78 },
    });
  });

  it("puts the diamond's handles on its four vertices", () => {
    const [w, h] = [180, 112];
    const handles = flowShapeHandles("diamond", w, h);
    const vertices = numbers(flowShapePath("diamond", w, h));
    // M top, L right, L bottom, L left — the pairs in path order.
    const [tx, ty, rx, ry, bx, by, lx, ly] = vertices;
    expect(handles.top).toEqual({ x: tx, y: 0 });
    expect(Math.abs(handles.top.y - ty)).toBeLessThanOrEqual(1);
    expect(handles.right.y).toBe(ry);
    expect(Math.abs(handles.right.x - rx)).toBeLessThanOrEqual(1);
    expect(handles.bottom.x).toBe(bx);
    expect(Math.abs(handles.bottom.y - by)).toBeLessThanOrEqual(1);
    expect(handles.left.y).toBe(ly);
    expect(Math.abs(handles.left.x - lx)).toBeLessThanOrEqual(1);
  });

  it("puts the io's side handles halfway down the slanted edges, not on the box", () => {
    const [w, h] = [230, 64];
    const handles = flowShapeHandles("parallelogram", w, h);
    const topLeft = { x: IO_SLANT, y: 0 };
    const bottomLeft = { x: 0, y: h };
    const topRight = { x: w, y: 0 };
    const bottomRight = { x: w - IO_SLANT, y: h };
    expect(onSegment(handles.left, topLeft, bottomLeft)).toBe(true);
    expect(onSegment(handles.right, topRight, bottomRight)).toBe(true);
    expect(handles.left.x).toBeGreaterThan(0);
    expect(handles.right.x).toBeLessThan(w);
  });
});

describe("flowShapeAccentPath", () => {
  it("paints the io accent along its left slanted edge", () => {
    const d = flowShapeAccentPath("parallelogram", 230, 64);
    expect(d).not.toBeNull();
    const [x0, y0, x1, y1] = numbers(d!);
    expect(x0).toBeGreaterThan(x1);
    expect(y1).toBeGreaterThan(y0);
  });

  it("has no edge accent for a card shape", () => {
    expect(flowShapeAccentPath("rectangle", 220, 78)).toBeNull();
  });
});

describe("readFlowShape", () => {
  it("reads the legacy start / end circle as a start", () => {
    expect(readFlowShape("circle")).toBe("start");
  });

  it("leaves every other shape as stored", () => {
    for (const shape of ["rectangle", "diamond", "start", "end"] as const) {
      expect(readFlowShape(shape)).toBe(shape);
    }
  });
});

describe("document", () => {
  it("puts the bottom handle on the wave, not on the box", () => {
    const [w, h] = [220, 78];
    const { bottom, left, right } = flowShapeHandles("document", w, h);
    expect(bottom.x).toBe(w / 2);
    // The wave dips below the base line around the middle, but never to the box edge.
    expect(bottom.y).toBeGreaterThan(h - DOCUMENT_WAVE_RISE);
    expect(bottom.y).toBeLessThan(h);
    expect(left).toEqual({ x: 0, y: h / 2 });
    expect(right).toEqual({ x: w, y: h / 2 });
  });

  it("keeps the wave's height when the document gets wider", () => {
    const narrow = flowShapeHandles("document", 220, 78).bottom.y;
    const wide = flowShapeHandles("document", 440, 78).bottom.y;
    expect(wide).toBeCloseTo(narrow, 1);
  });

  it("paints its accent down the left edge", () => {
    expect(flowShapeAccentPath("document", 220, 78)).toMatch(/^M1\.5 /);
  });
});

describe("event", () => {
  it("matches the reference drawing at 210x60", () => {
    expect(flowShapePath("event", 210, 60)).toBe("M1 1 H184 L209 30 L184 59 H1 Q18 30 1 1 Z");
  });

  it("puts the left handle in the bottom of the notch and the right one on the point", () => {
    const { left, right } = flowShapeHandles("event", 210, 60);
    expect(left).toEqual({ x: 9.5, y: 30 });
    expect(right).toEqual({ x: 210, y: 30 });
  });

  it("paints its accent along the notch", () => {
    expect(flowShapeAccentPath("event", 210, 60)).toBe("M1.5 1.5 Q18 30 1.5 58.5");
  });
});

describe("card shapes are created within the C4 card's width bounds", () => {
  it.each(["rectangle", "rounded", "subroutine", "document", "evidence"] as const)(
    "%s",
    (shape) => {
      const { width } = FLOW_SHAPE_DEFAULT_SIZE[shape];
      expect(width).toBeGreaterThanOrEqual(CARD_MIN_W);
      expect(width).toBeLessThanOrEqual(CARD_MAX_W);
    },
  );
});
