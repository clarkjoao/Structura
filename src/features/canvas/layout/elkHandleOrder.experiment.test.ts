import { describe, expect, it } from "vitest";
import { readElkHandleOrder } from "./elkHandleOrder";
import { layoutIRGraph } from "./irLayoutEngine";
import { totalReadability } from "./layoutReadability";
import { measureRenderedReadability } from "./renderedEdgePath";
import { labelsOf, REFERENCE_DIAGRAMS } from "./reference-diagrams";

/**
 * Fatia 5's experiment: the rendered crossings live at the edge ends, where
 * Structura picks handles round-robin in connection order. ELK already sorted
 * its attachments to avoid crossings — does reusing that order help?
 *
 *   npx vitest run elkHandleOrder.experiment --reporter=verbose --silent=false
 */

async function measureBothModes(ir: (typeof REFERENCE_DIAGRAMS)[number]["ir"]) {
  const graph = await layoutIRGraph(ir);
  const labels = labelsOf(ir);
  const handleOrder = readElkHandleOrder(graph);

  return {
    off: measureRenderedReadability(graph, ir.edges, { labels }),
    on: measureRenderedReadability(graph, ir.edges, { labels, handleOrder }),
  };
}

describe("ELK handle order experiment", () => {
  it("compares both modes per diagram and in total", async () => {
    const rows: string[] = [
      "diagram".padEnd(24) + "  crossings off/on   over-node off/on   labels off/on",
    ];
    const offReports = [];
    const onReports = [];

    for (const { name, ir } of REFERENCE_DIAGRAMS) {
      const { off, on } = await measureBothModes(ir);
      offReports.push(off);
      onReports.push(on);

      rows.push(
        name.padEnd(24) +
          `${String(off.edgeCrossings).padStart(9)} /${String(on.edgeCrossings).padStart(3)}` +
          `${String(off.edgeNodeOverlaps).padStart(16)} /${String(on.edgeNodeOverlaps).padStart(3)}` +
          `${String(off.labelOverlaps).padStart(13)} /${String(on.labelOverlaps).padStart(3)}`,
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
      `\nELK handle order: off = round-robin, on = ELK attachment order\n${rows.join("\n")}\n`,
    );
    expect(rows.length).toBe(REFERENCE_DIAGRAMS.length + 2);
  });

  it("never loses an edge in either mode", async () => {
    for (const { name, ir } of REFERENCE_DIAGRAMS) {
      const { off, on } = await measureBothModes(ir);
      expect(off.edgeCount, `${name} off`).toBe(ir.edges.length);
      expect(on.edgeCount, `${name} on`).toBe(ir.edges.length);
    }
  });
});
