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
 * Only the slot is in play. Which *side* an edge uses is fixed by the reading
 * direction and is not something this experiment may trade away — see the module
 * comment in `edges/connectionDerivations.ts`.
 *
 *   npx vitest run elkHandleOrder.experiment --reporter=verbose --silent=false
 */

async function measureBothModes(ir: (typeof REFERENCE_DIAGRAMS)[number]["ir"]) {
  const graph = await layoutIRGraph(ir);
  const labels = labelsOf(ir);
  const handleOrder = readElkHandleOrder(graph);

  return {
    // Round-robin handles: what shipped before Fatia 5.
    roundRobin: measureRenderedReadability(graph, ir.edges, { labels }),
    // ELK order: the current default.
    order: measureRenderedReadability(graph, ir.edges, { labels, handleOrder }),
  };
}

const MODES = ["roundRobin", "order"] as const;

describe("handle order experiment", () => {
  it("compares every mode per diagram and in total", async () => {
    const cell = (value: number) => String(value).padStart(8);
    const rows: string[] = [
      "diagram".padEnd(24) + "  |    crossings    |    over-node    |     labels",
      "".padEnd(24) + "  | rrobin   order | rrobin   order | rrobin   order",
    ];
    const totals: Record<string, ReturnType<typeof measureRenderedReadability>[]> = {
      roundRobin: [],
      order: [],
    };

    for (const { name, ir } of REFERENCE_DIAGRAMS) {
      const measured = await measureBothModes(ir);
      for (const mode of MODES) totals[mode].push(measured[mode]);

      rows.push(
        name.padEnd(24) +
          "  |" +
          MODES.map((mode) => cell(measured[mode].edgeCrossings)).join("") +
          "  |" +
          MODES.map((mode) => cell(measured[mode].edgeNodeOverlaps)).join("") +
          "  |" +
          MODES.map((mode) => cell(measured[mode].labelOverlaps)).join(""),
      );
    }

    const summed = Object.fromEntries(
      MODES.map((mode) => [mode, totalReadability(totals[mode])]),
    ) as Record<(typeof MODES)[number], ReturnType<typeof totalReadability>>;

    rows.push(
      "TOTAL".padEnd(24) +
        "  |" +
        MODES.map((mode) => cell(summed[mode].edgeCrossings)).join("") +
        "  |" +
        MODES.map((mode) => cell(summed[mode].edgeNodeOverlaps)).join("") +
        "  |" +
        MODES.map((mode) => cell(summed[mode].labelOverlaps)).join(""),
    );

    console.info(`\nrrobin = round-robin handles | order = ELK's edge order\n${rows.join("\n")}\n`);
    expect(rows.length).toBe(REFERENCE_DIAGRAMS.length + 3);
  });

  it("never loses an edge in any mode", async () => {
    for (const { name, ir } of REFERENCE_DIAGRAMS) {
      const measured = await measureBothModes(ir);
      for (const mode of MODES) {
        expect(measured[mode].edgeCount, `${name} ${mode}`).toBe(ir.edges.length);
      }
    }
  });
});
