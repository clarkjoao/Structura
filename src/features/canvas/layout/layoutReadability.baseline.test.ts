import { describe, expect, it } from "vitest";
import { validateIR } from "@/features/llm/ir/ir-validator";
import { layoutIRGraph } from "./irLayoutEngine";
import { measureReadability, type ReadabilityReport } from "./layoutReadability";
import { measureRenderedReadability } from "./renderedEdgePath";
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
      const graph = await layoutIRGraph(ir);
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
      const graph = await layoutIRGraph(ir);
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

  it("produces a layout for every reference diagram", async () => {
    for (const { name, ir } of REFERENCE_DIAGRAMS) {
      const graph = await layoutIRGraph(ir);
      const report = measureReadability(graph);
      expect(report.nodeCount, name).toBe(ir.nodes.length);
      expect(report.edgeCount, name).toBe(ir.edges.length);
    }
  });
});
