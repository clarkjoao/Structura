import { describe, expect, it } from "vitest";
import type { ElkNode } from "elkjs";
import { measureReadability, segmentsIntersect, totalReadability } from "./layoutReadability";

const leaf = (id: string, x: number, y: number): ElkNode => ({
  id,
  x,
  y,
  width: 100,
  height: 50,
});

/** Builds a laid-out-looking graph; coordinates are already "post-ELK". */
function graph(children: ElkNode[], edges: ElkNode["edges"] = [], size = 1000): ElkNode {
  return { id: "root", x: 0, y: 0, width: size, height: size, children, edges };
}

function straightEdge(id: string, source: string, target: string, points: number[][]) {
  return {
    id,
    sources: [source],
    targets: [target],
    sections: [
      {
        id: `${id}-s`,
        startPoint: { x: points[0][0], y: points[0][1] },
        endPoint: { x: points[points.length - 1][0], y: points[points.length - 1][1] },
        ...(points.length > 2
          ? { bendPoints: points.slice(1, -1).map(([x, y]) => ({ x, y })) }
          : {}),
      },
    ],
  };
}

describe("segmentsIntersect", () => {
  it("detects a proper crossing", () => {
    expect(
      segmentsIntersect({ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 10, y: 0 }),
    ).toBe(true);
  });

  it("returns false for parallel segments", () => {
    expect(
      segmentsIntersect({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 5 }, { x: 10, y: 5 }),
    ).toBe(false);
  });

  it("returns false when segments miss each other", () => {
    expect(segmentsIntersect({ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 5, y: 5 }, { x: 6, y: 6 })).toBe(
      false,
    );
  });
});

describe("measureReadability — crossings", () => {
  it("counts a crossing between two edges", () => {
    const report = measureReadability(
      graph(
        [leaf("a", 0, 0), leaf("b", 400, 300), leaf("c", 0, 300), leaf("d", 400, 0)],
        [
          straightEdge("e1", "a", "b", [
            [100, 25],
            [400, 325],
          ]),
          straightEdge("e2", "c", "d", [
            [100, 325],
            [400, 25],
          ]),
        ],
      ),
    );
    expect(report.edgeCrossings).toBe(1);
  });

  it("reports no crossing for edges that run in parallel", () => {
    const report = measureReadability(
      graph(
        [leaf("a", 0, 0), leaf("b", 400, 0), leaf("c", 0, 300), leaf("d", 400, 300)],
        [
          straightEdge("e1", "a", "b", [
            [100, 25],
            [400, 25],
          ]),
          straightEdge("e2", "c", "d", [
            [100, 325],
            [400, 325],
          ]),
        ],
      ),
    );
    expect(report.edgeCrossings).toBe(0);
  });

  it("does not count two edges meeting at a shared endpoint", () => {
    const report = measureReadability(
      graph(
        [leaf("hub", 0, 100), leaf("x", 400, 0), leaf("y", 400, 300)],
        [
          straightEdge("e1", "hub", "x", [
            [100, 125],
            [400, 25],
          ]),
          straightEdge("e2", "hub", "y", [
            [100, 125],
            [400, 325],
          ]),
        ],
      ),
    );
    expect(report.edgeCrossings).toBe(0);
  });
});

describe("measureReadability — nested coordinates", () => {
  /**
   * ELK reports an edge relative to the lowest common ancestor of its endpoints,
   * even when the edge is stored on the root. Without that correction this edge
   * would be read ~1000px away from its nodes and the crossing count would be
   * meaningless.
   */
  it("anchors a nested edge to the common ancestor, not the root", () => {
    const nested: ElkNode = {
      id: "root",
      x: 0,
      y: 0,
      width: 2000,
      height: 800,
      children: [
        {
          id: "box",
          x: 500,
          y: 200,
          width: 600,
          height: 300,
          children: [leaf("p", 40, 40), leaf("q", 400, 40)],
        },
      ],
      // Coordinates relative to "box": p's right edge to q's left edge.
      edges: [
        straightEdge("inner", "p", "q", [
          [140, 65],
          [400, 65],
        ]),
      ],
    };

    const report = measureReadability(nested);
    // Read correctly, this edge stays inside the box and hits nothing.
    expect(report.edgeNodeOverlaps).toBe(0);
    expect(report.edgeCount).toBe(1);
  });
});

describe("measureReadability — edges over nodes", () => {
  it("counts an edge crossing an unrelated node box", () => {
    const report = measureReadability(
      graph(
        [leaf("a", 0, 0), leaf("b", 800, 0), leaf("blocker", 400, 0)],
        [
          straightEdge("e1", "a", "b", [
            [100, 25],
            [800, 25],
          ]),
        ],
      ),
    );
    expect(report.edgeNodeOverlaps).toBe(1);
  });

  it("does not count the container the edge legitimately runs inside", () => {
    const nested: ElkNode = {
      id: "root",
      x: 0,
      y: 0,
      width: 1200,
      height: 400,
      children: [
        {
          id: "box",
          x: 0,
          y: 0,
          width: 600,
          height: 300,
          children: [leaf("p", 40, 40), leaf("q", 400, 40)],
        },
      ],
      edges: [
        straightEdge("inner", "p", "q", [
          [140, 65],
          [400, 65],
        ]),
      ],
    };
    expect(measureReadability(nested).edgeNodeOverlaps).toBe(0);
  });
});

describe("measureReadability — labels", () => {
  it("counts two labels landing on top of each other", () => {
    const report = measureReadability(
      graph(
        [leaf("a", 0, 0), leaf("b", 600, 0), leaf("c", 0, 10), leaf("d", 600, 10)],
        [
          straightEdge("e1", "a", "b", [
            [100, 25],
            [600, 25],
          ]),
          straightEdge("e2", "c", "d", [
            [100, 30],
            [600, 30],
          ]),
        ],
      ),
      {
        labels: new Map([
          ["e1", "reads/writes"],
          ["e2", "publishes"],
        ]),
      },
    );
    expect(report.labelOverlaps).toBeGreaterThanOrEqual(1);
  });

  it("counts nothing when no labels are supplied", () => {
    const report = measureReadability(
      graph(
        [leaf("a", 0, 0), leaf("b", 600, 0)],
        [
          straightEdge("e1", "a", "b", [
            [100, 25],
            [600, 25],
          ]),
        ],
      ),
    );
    expect(report.labelOverlaps).toBe(0);
  });
});

describe("totalReadability", () => {
  it("sums counts and keeps the largest dimensions", () => {
    const total = totalReadability([
      {
        edgeCrossings: 2,
        placementCrossings: 3,
        edgeNodeOverlaps: 1,
        labelOverlaps: 0,
        nodeCount: 5,
        edgeCount: 4,
        width: 100,
        height: 900,
      },
      {
        edgeCrossings: 1,
        placementCrossings: 1,
        edgeNodeOverlaps: 0,
        labelOverlaps: 2,
        nodeCount: 3,
        edgeCount: 2,
        width: 800,
        height: 200,
      },
    ]);
    expect(total).toMatchObject({
      edgeCrossings: 3,
      placementCrossings: 4,
      edgeNodeOverlaps: 1,
      labelOverlaps: 2,
      nodeCount: 8,
      edgeCount: 6,
      width: 800,
      height: 900,
    });
  });
});
