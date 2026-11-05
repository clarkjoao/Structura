import { describe, expect, it } from "vitest";
import {
  cullingWindow,
  edgeRouteBox,
  sameIds,
  visibleEdgeIds,
  type Box,
  type CullableEdge,
} from "./routeCulling";

const box = (x: number, y: number, w = 200, h = 100): Box => ({
  minX: x,
  minY: y,
  maxX: x + w,
  maxY: y + h,
});

/** Viewport 1000×800 px at zoom 1, looking at flow (0,0)–(1000,800). */
const WINDOW = cullingWindow([0, 0, 1], 1000, 800, 0)!;

describe("cullingWindow", () => {
  it("always contains the real viewport grown by the margin", () => {
    let seed = 7;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let i = 0; i < 2000; i += 1) {
      const zoom = 0.1 + rand() * 2;
      const tx = (rand() - 0.5) * 60000;
      const ty = (rand() - 0.5) * 60000;
      const width = 400 + rand() * 2000;
      const height = 300 + rand() * 1200;
      const margin = rand() < 0.5 ? 0 : 1;
      const w = cullingWindow([tx, ty, zoom], width, height, margin)!;
      const viewX = -tx / zoom;
      const viewY = -ty / zoom;
      const viewW = width / zoom;
      const viewH = height / zoom;
      expect(w.minX).toBeLessThanOrEqual(viewX - margin * viewW + 1e-6);
      expect(w.minY).toBeLessThanOrEqual(viewY - margin * viewH + 1e-6);
      expect(w.maxX).toBeGreaterThanOrEqual(viewX + viewW + margin * viewW - 1e-6);
      expect(w.maxY).toBeGreaterThanOrEqual(viewY + viewH + margin * viewH - 1e-6);
    }
  });

  it("keeps its key during a small pan and changes it across a cell", () => {
    const a = cullingWindow([0, 0, 0.3], 1600, 1000)!;
    const b = cullingWindow([-40, -30, 0.3], 1600, 1000)!;
    const far = cullingWindow([-2000, 0, 0.3], 1600, 1000)!;
    expect(b.key).toBe(a.key);
    expect(far.key).not.toBe(a.key);
  });

  it("is null before React Flow has a size", () => {
    expect(cullingWindow([0, 0, 1], 0, 0)).toBeNull();
  });
});

describe("visibleEdgeIds", () => {
  const nodes: Record<string, Box> = {
    near: box(100, 100),
    near2: box(600, 300),
    farLeft: box(-40000, 400),
    farRight: box(40000, 400),
    farA: box(20000, 20000),
    farB: box(21000, 20000),
  };
  const nodeBox = (id: string) => nodes[id];
  const edge = (id: string, source: string, target: string, extra: Partial<CullableEdge> = {}) => ({
    id,
    source,
    target,
    ...extra,
  });

  it("keeps an edge between two nodes on screen and drops one far away", () => {
    const ids = visibleEdgeIds(
      [edge("on", "near", "near2"), edge("off", "farA", "farB")],
      nodeBox,
      WINDOW,
    );
    expect([...ids]).toEqual(["on"]);
  });

  it("keeps a long edge whose endpoints are both off screen but whose route crosses it", () => {
    const ids = visibleEdgeIds([edge("long", "farLeft", "farRight")], nodeBox, WINDOW);
    expect(ids.has("long")).toBe(true);
  });

  it("keeps an edge whose detour, not its endpoints, reaches the viewport", () => {
    // Both ends far below; the route climbs into view and back down.
    const detour = edge("detour", "farA", "farB", {
      data: {
        layoutPoints: [
          { x: 20300, y: 20050 },
          { x: 20300, y: 400 },
          { x: 500, y: 400 },
          { x: 500, y: 20050 },
        ],
      },
    });
    expect(visibleEdgeIds([detour], nodeBox, WINDOW).has("detour")).toBe(true);
  });

  it("keeps selected edges and the step being played wherever they are", () => {
    const ids = visibleEdgeIds(
      [
        edge("selected", "farA", "farB", { selected: true }),
        edge("playing", "farA", "farB", { data: { isActivePlayback: true } }),
      ],
      nodeBox,
      WINDOW,
    );
    expect(ids).toEqual(new Set(["selected", "playing"]));
  });

  it("keeps an edge whose endpoint has not been measured yet", () => {
    expect(visibleEdgeIds([edge("e", "near", "unknown")], nodeBox, WINDOW).has("e")).toBe(true);
  });
});

describe("edgeRouteBox", () => {
  it("covers both node boxes and every corner", () => {
    expect(edgeRouteBox(box(0, 0), box(500, 500), [{ x: -100, y: 900 }])).toEqual({
      minX: -100,
      minY: 0,
      maxX: 700,
      maxY: 900,
    });
  });
});

describe("sameIds", () => {
  it("compares by members", () => {
    expect(sameIds(new Set(["a", "b"]), new Set(["b", "a"]))).toBe(true);
    expect(sameIds(new Set(["a"]), new Set(["b"]))).toBe(false);
  });
});
