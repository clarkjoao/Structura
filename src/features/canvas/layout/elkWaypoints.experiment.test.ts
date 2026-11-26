import { describe, expect, it } from "vitest";
import { interiorWaypoints } from "./applyLayout";
import { layout, layoutElkGraph } from "./layoutEngine";
import { measureReadability, totalReadability } from "./layoutReadability";
import { measureRenderedReadability } from "./renderedEdgePath";
import { labelsOf, REFERENCE_DIAGRAMS, edgesOf, fixtureGraph } from "./reference-diagrams";

/**
 * Fatia 4's experiment: does feeding ELK's bend points to the canvas produce a
 * better picture than the canvas's own step routing?
 *
 * Both modes are measured with the rendered-path metric, because that is what
 * the user sees either way — the only difference is whether the connection has
 * stored control points.
 *
 *   npx vitest run elkWaypoints.experiment --reporter=verbose --silent=false
 */

const NO_ORIGIN = { x: 0, y: 0 };

async function measureBothModes(diagram: (typeof REFERENCE_DIAGRAMS)[number]["diagram"]) {
  const graph = await layoutElkGraph(fixtureGraph(diagram));
  const { edgeRoutes } = await layout(fixtureGraph(diagram));
  const labels = labelsOf(diagram);

  const cornersByEdgeId = new Map<string, Array<{ x: number; y: number }>>();
  for (const edge of edgesOf(diagram)) {
    const route = edgeRoutes.get(edge.id);
    if (!route) continue;
    const waypoints = interiorWaypoints(route, NO_ORIGIN);
    if (waypoints.length > 0) cornersByEdgeId.set(edge.id, waypoints);
  }

  return {
    off: measureRenderedReadability(graph, edgesOf(diagram), { labels }),
    on: measureRenderedReadability(graph, edgesOf(diagram), { labels, cornersByEdgeId }),
    elk: measureReadability(graph, { labels }),
    withWaypoints: cornersByEdgeId.size,
  };
}

describe("ELK waypoints experiment", () => {
  it("compares both modes per diagram and in total", async () => {
    const rows: string[] = [
      "diagram".padEnd(24) +
        "  crossings off/on   over-node off/on   labels off/on   edges w/ waypoints",
    ];
    const offReports = [];
    const onReports = [];

    for (const { name, diagram } of REFERENCE_DIAGRAMS) {
      const { off, on, withWaypoints } = await measureBothModes(diagram);
      offReports.push(off);
      onReports.push(on);

      rows.push(
        name.padEnd(24) +
          `${String(off.edgeCrossings).padStart(9)} /${String(on.edgeCrossings).padStart(3)}` +
          `${String(off.edgeNodeOverlaps).padStart(16)} /${String(on.edgeNodeOverlaps).padStart(3)}` +
          `${String(off.labelOverlaps).padStart(13)} /${String(on.labelOverlaps).padStart(3)}` +
          `${String(withWaypoints).padStart(14)}/${edgesOf(diagram).length}`,
      );
    }

    const offTotal = totalReadability(offReports);
    const onTotal = totalReadability(onReports);
    rows.push(
      "TOTAL".padEnd(24) +
        `${String(offTotal.edgeCrossings).padStart(9)} /${String(onTotal.edgeCrossings).padStart(3)}` +
        `${String(offTotal.edgeNodeOverlaps).padStart(16)} /${String(onTotal.edgeNodeOverlaps).padStart(3)}` +
        `${String(offTotal.labelOverlaps).padStart(13)} /${String(onTotal.labelOverlaps).padStart(3)}`,
    );

    console.info(
      `\nELK waypoints: off = canvas routing, on = ELK bend points\n${rows.join("\n")}\n`,
    );
    expect(rows.length).toBe(REFERENCE_DIAGRAMS.length + 2);
  });

  it("never loses an edge in either mode", async () => {
    for (const { name, diagram } of REFERENCE_DIAGRAMS) {
      const { off, on } = await measureBothModes(diagram);
      expect(off.edgeCount, `${name} off`).toBe(edgesOf(diagram).length);
      expect(on.edgeCount, `${name} on`).toBe(edgesOf(diagram).length);
    }
  });
});

describe("interiorWaypoints", () => {
  it("drops the endpoints, which the canvas draws from the handles", () => {
    expect(
      interiorWaypoints(
        [
          { x: 0, y: 0 },
          { x: 50, y: 0 },
          { x: 50, y: 100 },
          { x: 200, y: 100 },
        ],
        NO_ORIGIN,
      ),
    ).toEqual([
      { x: 50, y: 0 },
      { x: 50, y: 100 },
    ]);
  });

  it("returns nothing for a straight two-point route", () => {
    expect(
      interiorWaypoints(
        [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
        ],
        NO_ORIGIN,
      ),
    ).toEqual([]);
  });

  it("shifts the points by the canvas origin", () => {
    expect(
      interiorWaypoints(
        [
          { x: 0, y: 0 },
          { x: 10, y: 20 },
          { x: 100, y: 0 },
        ],
        { x: 1000, y: 500 },
      ),
    ).toEqual([{ x: 1010, y: 520 }]);
  });
});
