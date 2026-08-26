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
  "AWS ECS Fargate": { edgeCrossings: 4, edgeNodeOverlaps: 0 },
  "C4 Context healthcare": { edgeCrossings: 0, edgeNodeOverlaps: 0 },
  "AWS microservices": { edgeCrossings: 5, edgeNodeOverlaps: 0 },
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
   * `REFERENCE_DIAGRAMS` declares them:
   *
   *   round-robin handles  10 + 12 + 12 + 14 = 48
   *   ELK ordering          2 +  3 +  3 +  7 = 15
   *
   * Both totals are reproducible — the IR ids are fixed, so this path is
   * deterministic across runs. An earlier note here recorded the shipped total
   * as 16 with a decomposition of 1 + 3 + 5 + 7; neither reproduces, and the
   * "16 -> 15" improvement it implied was never the comparison. The comparison
   * is 48 -> 15, and every diagram improves — nothing here is a redistribution.
   *
   * An upper bound, like the ELK-routing numbers above.
   */
  const RENDERED_CROSSINGS_BASELINE = 15;
  const RENDERED_CROSSINGS_PER_DIAGRAM: Record<string, number> = {
    "C4 e-commerce": 2,
    "AWS ECS Fargate": 3,
    "C4 Context healthcare": 3,
    "AWS microservices": 7,
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
