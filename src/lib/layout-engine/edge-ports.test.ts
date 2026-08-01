import { describe, it, expect } from "vitest";
import {
  assignEdgePorts,
  sideFacing,
  hasArrowheadClearance,
  horizontalGap,
  verticalGap,
  type Rect,
  type EdgeEndpointInput,
} from "./edge-ports";
import { LAYOUT } from "./constants";

const rect = (x: number, y: number, width = 200, height = 80): Rect => ({ x, y, width, height });

describe("sideFacing", () => {
  it("picks the side by dominant axis", () => {
    const origin = rect(0, 0);
    expect(sideFacing(origin, rect(500, 0))).toBe("right");
    expect(sideFacing(origin, rect(-500, 0))).toBe("left");
    expect(sideFacing(origin, rect(0, 500))).toBe("bottom");
    expect(sideFacing(origin, rect(0, -500))).toBe("top");
  });

  it("prefers horizontal when the deltas tie", () => {
    // A diagonal peer at exactly 45° resolves horizontally, matching the reference port.
    expect(sideFacing(rect(0, 0), rect(300, 300))).toBe("right");
  });
});

describe("assignEdgePorts", () => {
  it("leaves a lone edge on a side unpinned — the centre is already right", () => {
    const rects = new Map([
      ["a", rect(0, 0)],
      ["b", rect(400, 0)],
    ]);
    const edges: EdgeEndpointInput[] = [{ id: "e1", source: "a", target: "b" }];

    expect(assignEdgePorts(edges, rects).size).toBe(0);
  });

  it("spreads several edges leaving one side into distinct slots", () => {
    const rects = new Map([
      ["hub", rect(0, 200)],
      ["t1", rect(500, 0)],
      ["t2", rect(500, 200)],
      ["t3", rect(500, 400)],
    ]);
    const edges: EdgeEndpointInput[] = [
      { id: "e1", source: "hub", target: "t1" },
      { id: "e2", source: "hub", target: "t2" },
      { id: "e3", source: "hub", target: "t3" },
    ];

    const ports = assignEdgePorts(edges, rects);

    const ys = ["e1", "e2", "e3"].map((id) => ports.get(id)!.source!.y);
    expect(new Set(ys).size).toBe(3);
    for (const id of ["e1", "e2", "e3"]) {
      expect(ports.get(id)!.source!.side).toBe("right");
      expect(ports.get(id)!.source!.x).toBe(1);
    }
  });

  it("orders ports by the far endpoint, so edges do not cross", () => {
    // Targets are declared in an order that does NOT match their vertical position.
    // Sorting by the peer must still put the topmost target on the topmost port.
    const rects = new Map([
      ["hub", rect(0, 200)],
      ["low", rect(500, 400)],
      ["high", rect(500, 0)],
      ["mid", rect(500, 200)],
    ]);
    const edges: EdgeEndpointInput[] = [
      { id: "to-low", source: "hub", target: "low" },
      { id: "to-high", source: "hub", target: "high" },
      { id: "to-mid", source: "hub", target: "mid" },
    ];

    const ports = assignEdgePorts(edges, rects);
    const yFor = (id: string) => ports.get(id)!.source!.y;

    // Port order must mirror target order: high above mid above low.
    expect(yFor("to-high")).toBeLessThan(yFor("to-mid"));
    expect(yFor("to-mid")).toBeLessThan(yFor("to-low"));
  });

  it("spreads along X for top and bottom sides", () => {
    const rects = new Map([
      ["hub", rect(200, 400)],
      ["a", rect(0, 0)],
      ["b", rect(200, 0)],
      ["c", rect(400, 0)],
    ]);
    const edges: EdgeEndpointInput[] = [
      { id: "e1", source: "hub", target: "a" },
      { id: "e2", source: "hub", target: "b" },
      { id: "e3", source: "hub", target: "c" },
    ];

    const ports = assignEdgePorts(edges, rects);

    for (const id of ["e1", "e2", "e3"]) {
      expect(ports.get(id)!.source!.side).toBe("top");
      expect(ports.get(id)!.source!.y).toBe(0);
    }
    const xs = ["e1", "e2", "e3"].map((id) => ports.get(id)!.source!.x);
    expect(xs).toEqual([...xs].sort((a, b) => a - b));
    expect(new Set(xs).size).toBe(3);
  });

  it("keeps the spread coordinate off the corners even with many edges on a side", () => {
    // Peers are packed tightly enough that they all stay to the right of the hub, so
    // every end lands on the same side and the slots subdivide it finely.
    const rects = new Map<string, Rect>([["hub", rect(0, 500)]]);
    const edges: EdgeEndpointInput[] = [];
    for (let i = 0; i < 20; i += 1) {
      rects.set(`t${i}`, rect(2000, 400 + i * 10));
      edges.push({ id: `e${i}`, source: "hub", target: `t${i}` });
    }

    const ports = assignEdgePorts(edges, rects);
    const [low, high] = LAYOUT.ANCHOR_CLAMP;

    expect(ports.size).toBe(20);
    for (const port of ports.values()) {
      const anchor = port.source;
      if (!anchor) continue;
      expect(anchor.side).toBe("right");
      // The spread axis for a left/right side is Y; X is pinned to the side itself.
      expect(anchor.y).toBeGreaterThanOrEqual(low);
      expect(anchor.y).toBeLessThanOrEqual(high);
    }
  });

  it("never overwrites a hand-pinned anchor", () => {
    const rects = new Map([
      ["hub", rect(0, 200)],
      ["t1", rect(500, 0)],
      ["t2", rect(500, 400)],
    ]);
    const pinned = { x: 1, y: 0.75, side: "right" as const };
    const edges: EdgeEndpointInput[] = [
      { id: "e1", source: "hub", target: "t1", fixedSourceAnchor: pinned },
      { id: "e2", source: "hub", target: "t2" },
    ];

    const ports = assignEdgePorts(edges, rects);
    expect(ports.get("e1")!.source).toEqual(pinned);
  });

  it("is idempotent — feeding its own output back changes nothing", () => {
    const rects = new Map([
      ["hub", rect(0, 200)],
      ["t1", rect(500, 0)],
      ["t2", rect(500, 200)],
      ["t3", rect(500, 400)],
    ]);
    const edges: EdgeEndpointInput[] = [
      { id: "e1", source: "hub", target: "t1" },
      { id: "e2", source: "hub", target: "t2" },
      { id: "e3", source: "hub", target: "t3" },
    ];

    const first = assignEdgePorts(edges, rects);
    const rerun = assignEdgePorts(
      edges.map((edge) => ({
        ...edge,
        fixedSourceAnchor: first.get(edge.id)?.source,
        fixedTargetAnchor: first.get(edge.id)?.target,
      })),
      rects,
    );

    for (const id of ["e1", "e2", "e3"]) {
      expect(rerun.get(id)).toEqual(first.get(id));
    }
  });

  it("is deterministic regardless of input edge order", () => {
    const rects = new Map([
      ["hub", rect(0, 200)],
      ["t1", rect(500, 0)],
      ["t2", rect(500, 200)],
      ["t3", rect(500, 400)],
    ]);
    const edges: EdgeEndpointInput[] = [
      { id: "e1", source: "hub", target: "t1" },
      { id: "e2", source: "hub", target: "t2" },
      { id: "e3", source: "hub", target: "t3" },
    ];

    const forward = assignEdgePorts(edges, rects);
    const reversed = assignEdgePorts([...edges].reverse(), rects);

    for (const id of ["e1", "e2", "e3"]) {
      expect(reversed.get(id)).toEqual(forward.get(id));
    }
  });

  it("ties ports at both ends when two nodes share several edges", () => {
    const rects = new Map([
      ["a", rect(0, 0)],
      ["b", rect(500, 0)],
    ]);
    const edges: EdgeEndpointInput[] = [
      { id: "e1", source: "a", target: "b" },
      { id: "e2", source: "a", target: "b" },
      { id: "e3", source: "a", target: "b" },
    ];

    const ports = assignEdgePorts(edges, rects);

    // Both the a-side and the b-side of the bundle get spread.
    const sourceYs = ["e1", "e2", "e3"].map((id) => ports.get(id)!.source!.y);
    const targetYs = ["e1", "e2", "e3"].map((id) => ports.get(id)!.target!.y);
    expect(new Set(sourceYs).size).toBe(3);
    expect(new Set(targetYs).size).toBe(3);
  });

  it("skips edges with a dangling endpoint", () => {
    const rects = new Map([["a", rect(0, 0)]]);
    const edges: EdgeEndpointInput[] = [{ id: "e1", source: "a", target: "ghost" }];
    expect(assignEdgePorts(edges, rects).size).toBe(0);
  });

  it("runs headless with no DOM", () => {
    const rects = new Map([
      ["a", rect(0, 0)],
      ["b", rect(400, 0)],
      ["c", rect(400, 200)],
    ]);
    const ports = assignEdgePorts(
      [
        { id: "e1", source: "a", target: "b" },
        { id: "e2", source: "a", target: "c" },
      ],
      rects,
    );
    expect(ports.size).toBeGreaterThan(0);
  });
});

describe("arrowhead clearance", () => {
  it("measures the clear gap between rects, not centre distance", () => {
    expect(horizontalGap(rect(0, 0, 200, 80), rect(300, 0, 200, 80))).toBe(100);
    expect(verticalGap(rect(0, 0, 200, 80), rect(0, 200, 200, 80))).toBe(120);
  });

  it("reports negative gaps for overlapping rects", () => {
    expect(horizontalGap(rect(0, 0, 200, 80), rect(100, 0, 200, 80))).toBeLessThan(0);
  });

  it("fails nodes too close for the arrowhead to render", () => {
    const source = rect(0, 0, 200, 80);
    const tooClose = rect(200 + LAYOUT.ARROWHEAD_CLEARANCE - 5, 0, 200, 80);
    const farEnough = rect(200 + LAYOUT.ARROWHEAD_CLEARANCE + 5, 0, 200, 80);

    expect(hasArrowheadClearance(source, tooClose)).toBe(false);
    expect(hasArrowheadClearance(source, farEnough)).toBe(true);
  });

  it("checks the axis the edge actually runs along", () => {
    const source = rect(0, 0, 200, 80);
    // Vertically stacked with a generous gap: clearance is measured on Y, not X.
    expect(hasArrowheadClearance(source, rect(0, 300, 200, 80))).toBe(true);
  });
});
