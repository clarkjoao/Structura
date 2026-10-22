import { describe, expect, it } from "vitest";
import { validateIR } from "@/features/llm/ir/ir-validator";
import { layoutElkGraph } from "./layoutEngine";
import { irToLayoutGraph } from "@/features/llm/ir/ir-to-layout-graph";
import {
  measurePolylines,
  measureReadability,
  totalReadability,
  type ReadabilityReport,
} from "./layoutReadability";
import { readElkHandleOrder } from "./elkHandleOrder";
import { buildRenderedPolylines, measureRenderedReadability } from "./renderedEdgePath";
import { handPlacedDiagram, handPlacedLabels, handPlacedParents } from "./hand-placed-diagram";
import { labelsOf, REFERENCE_DIAGRAMS } from "./reference-diagrams";
import { GENERATED_DIAGRAMS } from "./generated-diagrams";
import { stepPolyline } from "./renderedEdgePath";
import { handleAlignedRoutes } from "./edgeLayoutsFromLayoutResult";
import { layout } from "./layoutEngine";

/**
 * Readability of the shipped layout configuration, over the four reference
 * diagrams. This is the project's legibility metric: it is a regression guard,
 * not a gate on generation — nothing here can stop a diagram being produced.
 *
 * Run `npx vitest run layoutReadability.baseline` and read the printed table to
 * re-measure after changing layout options.
 */

const BASELINE: Record<string, Pick<ReadabilityReport, "edgeCrossings" | "edgeNodeOverlaps">> = {
  "C4 e-commerce": { edgeCrossings: 0, edgeNodeOverlaps: 0 },
  "AWS ECS Fargate": { edgeCrossings: 3, edgeNodeOverlaps: 0 },
  "C4 Context healthcare": { edgeCrossings: 1, edgeNodeOverlaps: 0 },
  "AWS microservices": { edgeCrossings: 4, edgeNodeOverlaps: 0 },
};

describe("reference diagrams", () => {
  it("are all schema-valid IR", () => {
    for (const { name, ir } of REFERENCE_DIAGRAMS) {
      const result = validateIR(ir);
      const issues = result.ok ? [] : result.issues;
      expect(issues, `${name}: ${JSON.stringify(issues)}`).toHaveLength(0);
    }
  });
});

describe("layout readability baseline", () => {
  it("prints the table and stays within the recorded baseline", async () => {
    const rows: string[] = [];
    const failures: string[] = [];

    for (const { name, ir } of REFERENCE_DIAGRAMS) {
      const graph = await layoutElkGraph(irToLayoutGraph(ir));
      const report = measureReadability(graph, { labels: labelsOf(ir) });

      rows.push(
        [
          name.padEnd(24),
          `nodes ${String(report.nodeCount).padStart(3)}`,
          `edges ${String(report.edgeCount).padStart(3)}`,
          `crossings ${String(report.edgeCrossings).padStart(3)}`,
          `placement ${String(report.placementCrossings).padStart(3)}`,
          `over-node ${String(report.edgeNodeOverlaps).padStart(3)}`,
          `labels ${String(report.labelOverlaps).padStart(3)}`,
          `${report.width}x${report.height}`,
        ].join("  "),
      );

      const expected = BASELINE[name];
      if (!expected) continue;
      // Upper bounds: the layout must not get worse than the recorded numbers.
      if (report.edgeCrossings > expected.edgeCrossings) {
        failures.push(
          `${name}: edgeCrossings ${report.edgeCrossings} > baseline ${expected.edgeCrossings}`,
        );
      }
      if (report.edgeNodeOverlaps > expected.edgeNodeOverlaps) {
        failures.push(
          `${name}: edgeNodeOverlaps ${report.edgeNodeOverlaps} > baseline ${expected.edgeNodeOverlaps}`,
        );
      }
    }

    console.info(`\nLayout readability\n${rows.join("\n")}\n`);
    expect(failures, failures.join("\n")).toHaveLength(0);
  });

  /**
   * The number that matters for the user: the canvas discards ELK's routing and
   * draws step edges between handles, so this is the only column that describes
   * what is actually on screen today.
   */
  it("prints the rendered-path table", async () => {
    const rows: string[] = [];

    for (const { name, ir } of REFERENCE_DIAGRAMS) {
      const graph = await layoutElkGraph(irToLayoutGraph(ir));
      const rendered = measureRenderedReadability(graph, ir.edges, { labels: labelsOf(ir) });
      const elk = measureReadability(graph, { labels: labelsOf(ir) });

      rows.push(
        [
          name.padEnd(24),
          `rendered ${String(rendered.edgeCrossings).padStart(3)}`,
          `elk ${String(elk.edgeCrossings).padStart(3)}`,
          `placement ${String(elk.placementCrossings).padStart(3)}`,
          `rendered-over-node ${String(rendered.edgeNodeOverlaps).padStart(3)}`,
          `rendered-labels ${String(rendered.labelOverlaps).padStart(3)}`,
        ].join("  "),
      );
    }

    console.info(`\nRendered path vs ELK routing\n${rows.join("\n")}\n`);
    expect(rows).toHaveLength(REFERENCE_DIAGRAMS.length);
  });

  /**
   * The number that reaches the user: nodes placed by ELK, edge paths drawn by
   * the canvas, handles in the order ELK worked out.
   *
   * Measured 2026-08-26 on this file's fixtures, per diagram, in the order
   * `REFERENCE_DIAGRAMS` declares them. The C4 Context healthcare diagram was
   * re-measured 2026-10-09 (3 → 5) after upstream layout-path changes; the
   * other three diagrams and the round-robin comparison both reproduce.
   *
   *   round-robin handles  10 + 12 + 12 + 14 = 48
   *   ELK ordering          2 +  3 +  5 +  7 = 17
   *
   * Both totals are reproducible — the IR ids are fixed, so this path is
   * deterministic across runs. An earlier note here recorded the shipped total
   * as 16 with a decomposition of 1 + 3 + 5 + 7; neither reproduces, and the
   * "16 -> 15" improvement it implied was never the comparison. The comparison
   * is 48 -> 17, and every diagram still improves — nothing here is a
   * redistribution.
   *
   * An upper bound, like the ELK-routing numbers above.
   *
   * Re-measured 2026-10-21 when `irToLayoutGraph` started sending edge labels
   * to ELK: 1 + 8 + 6 + 10 = 25. This path is the mid-X step a connection with
   * no stored corners draws; since generation and the auto-layout both store
   * ELK's corridors, what reaches the user is the "auto-layout path" baseline
   * below, which those labels left at 0 + 3 + 1 + 7 with no label overlap.
   *
   * Re-measured 2026-10-22 when the handles were bundled around the middle of
   * each side (`HANDLE_PITCH`): 2 + 8 + 6 + 6 = 22.
   */
  const RENDERED_CROSSINGS_BASELINE = 22;
  const RENDERED_CROSSINGS_PER_DIAGRAM: Record<string, number> = {
    "C4 e-commerce": 2,
    "AWS ECS Fargate": 8,
    "C4 Context healthcare": 6,
    "AWS microservices": 6,
  };

  it("does not regress the rendered-crossing total", async () => {
    const reports: ReadabilityReport[] = [];
    const rows: string[] = [];
    const failures: string[] = [];

    for (const { name, ir } of REFERENCE_DIAGRAMS) {
      const graph = await layoutElkGraph(irToLayoutGraph(ir));
      const report = measureRenderedReadability(graph, ir.edges, {
        labels: labelsOf(ir),
        handleOrder: readElkHandleOrder(graph),
      });
      reports.push(report);
      rows.push(`${name.padEnd(24)} crossings ${String(report.edgeCrossings).padStart(3)}`);

      // Per diagram as well as in total, so a regression that another diagram
      // happens to offset still shows up as one.
      const expected = RENDERED_CROSSINGS_PER_DIAGRAM[name];
      if (expected !== undefined && report.edgeCrossings > expected) {
        failures.push(`${name}: ${report.edgeCrossings} > baseline ${expected}`);
      }
    }

    const total = totalReadability(reports);
    console.info(`\n${rows.join("\n")}\nTOTAL rendered crossings ${total.edgeCrossings}\n`);
    expect(failures, failures.join("\n")).toHaveLength(0);
    expect(total.edgeCrossings).toBeLessThanOrEqual(RENDERED_CROSSINGS_BASELINE);
  });

  /**
   * The other half of the record: what the same diagrams measure with the
   * round-robin handles the canvas hands out when no `handleOrder` is stored.
   * Without it, "15" is a number with nothing to compare against.
   */
  it("is a large improvement over round-robin handles, on every diagram", async () => {
    const rows: string[] = [];

    for (const { name, ir } of REFERENCE_DIAGRAMS) {
      const graph = await layoutElkGraph(irToLayoutGraph(ir));
      const labels = labelsOf(ir);
      const roundRobin = measureRenderedReadability(graph, ir.edges, { labels }).edgeCrossings;
      const ordered = measureRenderedReadability(graph, ir.edges, {
        labels,
        handleOrder: readElkHandleOrder(graph),
      }).edgeCrossings;

      rows.push(
        `${name.padEnd(24)} round-robin ${String(roundRobin).padStart(3)} -> elk ${String(ordered).padStart(3)}`,
      );
      expect(ordered, `${name} got worse with ELK's ordering`).toBeLessThan(roundRobin);
    }

    console.info(`\nRound-robin vs ELK ordering\n${rows.join("\n")}\n`);
  });

  it("produces a layout for every reference diagram", async () => {
    for (const { name, ir } of REFERENCE_DIAGRAMS) {
      const graph = await layoutElkGraph(irToLayoutGraph(ir));
      const report = measureReadability(graph);
      expect(report.nodeCount, name).toBe(ir.nodes.length);
      expect(report.edgeCount, name).toBe(ir.edges.length);
    }
  });
});

/**
 * The auto-layout path (Cmd/Ctrl+Shift+L, generation, panel and selection
 * layout): edges carry their labels into ELK (`labelBox`), and the drawn path
 * keeps ELK's corridors snapped onto the handle slots (`handleAlignedRoutes`).
 * The numbers above measure ELK's own routing and the mid-X step without stored
 * corners, which is why they differ.
 *
 * Measured 2026-10-21 when inline labels shipped: crossings 12 → 11 and label
 * overlaps 6 → 0 against the same path without labels, for +24% area. Source:
 * `elkMermaidParity.experiment.test.ts`.
 *
 * Corners: 204 before `straightenPolylines` removed the jogs that snapping onto
 * handle slots leaves near the ends of a route, 174 after.
 *
 * Measured 2026-10-22 when ELK ports started bundling each side's edges where
 * the canvas draws its handles (`HANDLE_PITCH`): crossings 11 → 8 (AWS
 * microservices 7 → 4), corners 174 → 176, no label overlap.
 */
describe("auto-layout path baseline", () => {
  const AUTO_LAYOUT_BASELINE: Record<string, { crossings: number; labelOverlaps: number }> = {
    "C4 e-commerce": { crossings: 0, labelOverlaps: 0 },
    "AWS ECS Fargate": { crossings: 3, labelOverlaps: 0 },
    "C4 Context healthcare": { crossings: 1, labelOverlaps: 0 },
    "AWS microservices": { crossings: 4, labelOverlaps: 0 },
  };

  const CORNERS_BASELINE = 176;

  it("stays within the recorded crossings, label overlaps and corners", async () => {
    const failures: string[] = [];
    const rows: string[] = [];
    let corners = 0;

    for (const { name, ir } of REFERENCE_DIAGRAMS) {
      const labels = labelsOf(ir);
      const input = irToLayoutGraph(ir);
      const graph = await layoutElkGraph(input);
      const result = await layout(input);
      const cornersByEdgeId = new Map(
        [...handleAlignedRoutes(input, result)].map(([id, route]) => [id, route.corners]),
      );
      for (const routeCorners of cornersByEdgeId.values()) corners += routeCorners.length;
      const report = measureRenderedReadability(graph, ir.edges, {
        labels,
        handleOrder: result.handleOrder,
        cornersByEdgeId,
      });

      rows.push(
        `${name.padEnd(24)} crossings ${String(report.edgeCrossings).padStart(3)}  ` +
          `over-node ${String(report.edgeNodeOverlaps).padStart(3)}  ` +
          `labels ${String(report.labelOverlaps).padStart(3)}`,
      );
      const expected = AUTO_LAYOUT_BASELINE[name];
      if (!expected) continue;
      if (report.edgeCrossings > expected.crossings) {
        failures.push(`${name}: crossings ${report.edgeCrossings} > ${expected.crossings}`);
      }
      if (report.labelOverlaps > expected.labelOverlaps) {
        failures.push(
          `${name}: label overlaps ${report.labelOverlaps} > ${expected.labelOverlaps}`,
        );
      }
      expect(report.edgeNodeOverlaps, `${name} edge through a node`).toBe(0);
    }

    console.info(`\nAuto-layout path\n${rows.join("\n")}\nTOTAL corners ${corners}\n`);
    expect(failures, failures.join("\n")).toHaveLength(0);
    expect(corners).toBeLessThanOrEqual(CORNERS_BASELINE);
  });
});

/**
 * Neighbouring vertical channels: two edges whose vertical legs run alongside
 * each other closer than this read as one line.
 *
 * Measured 2026-10-21, auto-layout path over the reference and generated
 * diagrams: 117 pairs with ELK's default between-layer edge gap (10), 2 with
 * `edgeEdgeBetweenLayers` at 20. 2026-10-22: 4 when ELK ports started
 * bundling each side's edges around its middle (`HANDLE_PITCH`), all of them
 * bridges onto a container's handles; back to 2 once a container end may
 * straighten a long jog (`MAX_CONTAINER_JOG`).
 */
describe("auto-layout path — vertical channels stay apart", () => {
  const TOO_CLOSE = 10;
  const NEAR_PARALLEL_BASELINE = 2;

  interface Vertical {
    edge: string;
    x: number;
    top: number;
    bottom: number;
  }

  function verticals(id: string, points: ReadonlyArray<{ x: number; y: number }>): Vertical[] {
    const out: Vertical[] = [];
    for (let i = 0; i < points.length - 1; i += 1) {
      const a = points[i]!;
      const b = points[i + 1]!;
      if (Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) > 0.5) {
        out.push({ edge: id, x: a.x, top: Math.min(a.y, b.y), bottom: Math.max(a.y, b.y) });
      }
    }
    return out;
  }

  function nearParallelPairs(all: Vertical[]): number {
    let pairs = 0;
    for (let i = 0; i < all.length; i += 1) {
      for (let j = i + 1; j < all.length; j += 1) {
        const a = all[i]!;
        const b = all[j]!;
        if (a.edge === b.edge || Math.abs(a.x - b.x) > TOO_CLOSE) continue;
        if (Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2) pairs += 1;
      }
    }
    return pairs;
  }

  it("keeps different edges' vertical legs at least a channel apart", async () => {
    let pairs = 0;
    for (const { ir } of [...REFERENCE_DIAGRAMS, ...GENERATED_DIAGRAMS]) {
      const input = irToLayoutGraph(ir);
      const routes = handleAlignedRoutes(input, await layout(input));
      pairs += nearParallelPairs(
        [...routes].flatMap(([id, route]) =>
          verticals(id, stepPolyline(route.source, route.target, route.corners)),
        ),
      );
    }
    console.info(`\nNear-parallel vertical legs: ${pairs}\n`);
    expect(pairs).toBeLessThanOrEqual(NEAR_PARALLEL_BASELINE);
  }, 60_000);
});

/**
 * The four diagrams above are all ELK-laid-out, so they are systematically blind
 * to anything that only matters when an edge runs against the flow. This one is
 * placed by hand and stays in the suite for that reason.
 */
describe("hand-placed baseline", () => {
  const HAND_PLACED_BASELINE = { edgeCrossings: 7, edgeNodeOverlaps: 5 };

  function measure() {
    const diagram = handPlacedDiagram();
    return measurePolylines(
      {
        boxes: diagram.boxes,
        parentOf: handPlacedParents(diagram),
        edges: buildRenderedPolylines(
          diagram.boxes,
          diagram.edges.map((edge) => ({
            id: edge.id,
            sourceId: edge.sourceId,
            targetId: edge.targetId,
          })),
        ),
        rootId: diagram.rootId,
        width: diagram.width,
        height: diagram.height,
      },
      { labels: handPlacedLabels(diagram) },
    );
  }

  it("prints its numbers and stays within the recorded baseline", () => {
    const report = measure();
    console.info(
      `\nHand-placed diagram: crossings ${report.edgeCrossings}, ` +
        `over-node ${report.edgeNodeOverlaps}, labels ${report.labelOverlaps}, ` +
        `${report.nodeCount} nodes / ${report.edgeCount} edges\n`,
    );
    expect(report.edgeCrossings).toBeLessThanOrEqual(HAND_PLACED_BASELINE.edgeCrossings);
    expect(report.edgeNodeOverlaps).toBeLessThanOrEqual(HAND_PLACED_BASELINE.edgeNodeOverlaps);
  });

  it("keeps every edge", () => {
    expect(measure().edgeCount).toBe(handPlacedDiagram().edges.length);
  });
});
