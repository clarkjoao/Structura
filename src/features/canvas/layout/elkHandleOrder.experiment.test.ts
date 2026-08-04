import { describe, expect, it } from "vitest";
import { readElkHandleOrder } from "./elkHandleOrder";
import { layoutIRGraph } from "./irLayoutEngine";
import { measurePolylines, totalReadability } from "./layoutReadability";
import { buildRenderedPolylines, measureRenderedReadability } from "./renderedEdgePath";
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
    // Fixed sides, round-robin handles: what shipped before Fatia 5.
    roundRobin: measureRenderedReadability(graph, ir.edges, { labels }),
    // Fixed sides + ELK order: the current default.
    order: measureRenderedReadability(graph, ir.edges, { labels, handleOrder }),
    // Dynamic sides, with and without the ordering on top.
    sidesAndOrder: measureRenderedReadability(graph, ir.edges, {
      labels,
      handleOrder,
      dynamicSides: true,
    }),
    sidesOnly: measureRenderedReadability(graph, ir.edges, { labels, dynamicSides: true }),
  };
}

const MODES = ["roundRobin", "order", "sidesAndOrder", "sidesOnly"] as const;

describe("handle order and side experiment", () => {
  it("compares every mode per diagram and in total", async () => {
    const cell = (value: number) => String(value).padStart(6);
    const rows: string[] = [
      "diagram".padEnd(24) + "  |      crossings          |     over-node           |      labels",
      "".padEnd(24) +
        "  | rrobin  order  s+o   s  | rrobin  order  s+o   s  | rrobin  order  s+o   s",
    ];
    const totals: Record<string, ReturnType<typeof measureRenderedReadability>[]> = {
      roundRobin: [],
      order: [],
      sidesAndOrder: [],
      sidesOnly: [],
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

    console.info(
      `\nrrobin = fixed sides + round-robin | order = fixed sides + ELK order` +
        `\ns+o = dynamic sides + ELK order | s = dynamic sides, round-robin\n${rows.join("\n")}\n`,
    );
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

/**
 * The four reference diagrams are all ELK-laid-out, so almost every edge already
 * runs left to right and dynamic sides has little to act on. That under-sells
 * it: the case it exists for is a hand-placed diagram, where a target can sit to
 * the left of its source and the fixed right->left rule sends the edge all the
 * way around. This measures that case directly, on hand-set positions.
 */
describe("dynamic sides on a hand-placed diagram", () => {
  const boxes = new Map([
    ["client", { x: 0, y: 0, width: 180, height: 80 }],
    ["api", { x: 400, y: 0, width: 180, height: 80 }],
    ["worker", { x: 800, y: 0, width: 180, height: 80 }],
    // Placed to the LEFT of the nodes that talk to it — the back-edge case.
    ["db", { x: 0, y: 300, width: 180, height: 80 }],
    ["cache", { x: 400, y: 300, width: 180, height: 80 }],
  ]);

  const edges = [
    { id: "e1", sourceId: "client", targetId: "api" },
    { id: "e2", sourceId: "api", targetId: "worker" },
    { id: "e3", sourceId: "api", targetId: "db" },
    { id: "e4", sourceId: "worker", targetId: "db" },
    { id: "e5", sourceId: "worker", targetId: "cache" },
    { id: "e6", sourceId: "cache", targetId: "db" },
  ];

  const parentOf = new Map<string, string | null>(
    [...boxes.keys()].map((id) => [id, "root"] as const),
  );
  parentOf.set("root", null);
  const withRoot = new Map(boxes);
  withRoot.set("root", { x: 0, y: 0, width: 1200, height: 500 });

  function measure(dynamicSides: boolean) {
    return measurePolylines({
      boxes: withRoot,
      parentOf,
      edges: buildRenderedPolylines(withRoot, edges, {}, { dynamicSides }),
      rootId: "root",
      width: 1200,
      height: 500,
    });
  }

  it("reports both modes", () => {
    const fixed = measure(false);
    const dynamic = measure(true);
    console.info(
      `\nHand-placed diagram (${edges.length} edges, 3 of them running right-to-left)\n` +
        `  fixed sides   : crossings ${fixed.edgeCrossings}, over-node ${fixed.edgeNodeOverlaps}\n` +
        `  dynamic sides : crossings ${dynamic.edgeCrossings}, over-node ${dynamic.edgeNodeOverlaps}\n`,
    );
    expect(dynamic.edgeCount).toBe(edges.length);
    expect(fixed.edgeCount).toBe(edges.length);
  });
});
