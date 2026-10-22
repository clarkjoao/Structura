import { describe, expect, it } from "vitest";
import { irToLayoutGraph } from "@/features/llm/ir/ir-to-layout-graph";
import type { LayoutGraph } from "./contract";
import { edgeLabelBox } from "./edgeLabelBox";
import { handleAlignedRoutes } from "./edgeLayoutsFromLayoutResult";
import { readElkHandleOrder } from "./elkHandleOrder";
import { layout, layoutElkGraph } from "./layoutEngine";
import { measureReadability, totalReadability, type ReadabilityReport } from "./layoutReadability";
import { measureRenderedReadability } from "./renderedEdgePath";
import { labelsOf, REFERENCE_DIAGRAMS } from "./reference-diagrams";

/**
 * Mermaid 12 parity experiment. Measurement only — nothing here changes what
 * ships; inline labels and BALANCED/110 shipped from it.
 *
 * Mermaid 12 lays flowcharts out with ELK (its default `layout`), the same
 * engine as Structura, and its diagrams read noticeably cleaner. Two things it
 * does that Structura does not:
 *   1. Edge labels go to ELK as inline labels, so each one is a dummy node in
 *      the layer between its endpoints and edges route around it.
 *   2. A tuned option preset (`cat.default` + root options in mermaid's ELK
 *      layout module): BALANCED alignment, DEPTH_FIRST cycle breaking,
 *      NETWORK_SIMPLEX layering, port margins and bendpoint pruning.
 *
 * Each is measured alone and together, and each preset option alone, so a
 * winner can be attributed to the option that earned it. The labelled variants
 * already include the engine's labelled profile (`ELK_OPTIONS_LABELLED`), which
 * this experiment is where it came from.
 *
 * Two drawn paths are measured, because they are different products:
 *   - `gen`: generated diagrams (`apply-ir`), which discard ELK's routes and
 *     draw the mid-X step between handles.
 *   - `auto`: the auto-layout button, which keeps ELK's corridors and snaps
 *     their ends onto the handle slots (`handleAlignedRoutes`).
 *
 *   npx vitest run elkMermaidParity.experiment --silent=false
 */

const MERMAID_PRESET: Record<string, string> = {
  "elk.layered.layering.strategy": "NETWORK_SIMPLEX",
  "elk.layered.nodePlacement.bk.fixedAlignment": "BALANCED",
  "elk.layered.cycleBreaking.strategy": "DEPTH_FIRST",
  "elk.layered.unnecessaryBendpoints": "true",
  "elk.layered.mergeHierarchyEdges": "true",
  "elk.spacing.portsSurrounding": "[top=12,left=12,bottom=12,right=12]",
  "elk.layered.nodePlacement.networkSimplex.nodeFlexibility": "PORT_POSITION",
};

function withLabels(graph: LayoutGraph, labels: Map<string, string>): LayoutGraph {
  return {
    ...graph,
    edges: graph.edges.map((edge) => {
      const labelBox = edgeLabelBox(labels.get(edge.id));
      return labelBox ? { ...edge, labelBox } : edge;
    }),
  };
}

interface Variant {
  name: string;
  labels: boolean;
  overrides: Record<string, string>;
}

const VARIANTS: Variant[] = [
  { name: "baseline", labels: false, overrides: {} },
  // Labels with the engine's labelled profile (BALANCED, 110): what ships.
  { name: "labels (shipped)", labels: true, overrides: {} },
  // Labels with the unlabelled profile, to show what the profile buys.
  {
    name: "labels, unlabelled spacing",
    labels: true,
    overrides: {
      "elk.layered.spacing.nodeNodeBetweenLayers": "220",
      "elk.layered.nodePlacement.bk.fixedAlignment": "NONE",
    },
  },
  { name: "preset", labels: false, overrides: MERMAID_PRESET },
  { name: "labels+preset", labels: true, overrides: MERMAID_PRESET },
  // The between-layer gap around the shipped 110.
  ...["160", "130", "90"].map((gap) => ({
    name: `labels+betweenLayers=${gap}`,
    labels: true,
    overrides: { "elk.layered.spacing.nodeNodeBetweenLayers": gap },
  })),
  ...Object.entries(MERMAID_PRESET).map(([key, value]) => ({
    name: `labels+${key.split(".").slice(-2).join(".")}`,
    labels: true,
    overrides: { [key]: value },
  })),
];

interface Measured {
  elk: ReadabilityReport;
  generated: ReadabilityReport;
  autoLayout: ReadabilityReport;
}

async function measure(variant: Variant): Promise<Measured[]> {
  const out: Measured[] = [];
  for (const { ir } of REFERENCE_DIAGRAMS) {
    const labels = labelsOf(ir);
    const base = irToLayoutGraph(ir);
    const input = variant.labels ? withLabels(base, labels) : base;
    const graph = await layoutElkGraph(input, variant.overrides);
    const result = await layout(input, variant.overrides);
    const cornersByEdgeId = new Map(
      [...handleAlignedRoutes(input, result)].map(([id, route]) => [id, route.corners]),
    );
    out.push({
      elk: measureReadability(graph, { labels }),
      generated: measureRenderedReadability(graph, ir.edges, {
        labels,
        handleOrder: readElkHandleOrder(graph),
      }),
      autoLayout: measureRenderedReadability(graph, ir.edges, {
        labels,
        handleOrder: result.handleOrder,
        cornersByEdgeId,
      }),
    });
  }
  return out;
}

describe("mermaid parity experiment", () => {
  it("prints every variant per diagram and in total", async () => {
    const pad = (value: number | string, width = 5) => String(value).padStart(width);
    const header =
      "variant".padEnd(40) +
      " | elk-x | gen-x  over  lbl | auto-x  over  lbl | auto-x per diagram | area k";
    const rows: string[] = [header, "-".repeat(header.length)];

    for (const variant of VARIANTS) {
      const measured = await measure(variant);
      const elk = totalReadability(measured.map((m) => m.elk));
      const generated = totalReadability(measured.map((m) => m.generated));
      const auto = totalReadability(measured.map((m) => m.autoLayout));
      const area = measured.reduce((sum, m) => sum + m.elk.width * m.elk.height, 0) / 1000;

      rows.push(
        variant.name.padEnd(40) +
          " |" +
          pad(elk.edgeCrossings, 6) +
          " |" +
          pad(generated.edgeCrossings, 6) +
          pad(generated.edgeNodeOverlaps, 6) +
          pad(generated.labelOverlaps, 5) +
          " |" +
          pad(auto.edgeCrossings, 7) +
          pad(auto.edgeNodeOverlaps, 6) +
          pad(auto.labelOverlaps, 5) +
          " | " +
          measured.map((m) => pad(m.autoLayout.edgeCrossings, 3)).join(" ") +
          "    |" +
          pad(Math.round(area), 7),
      );
    }

    console.info(
      `\nMermaid parity (${REFERENCE_DIAGRAMS.map((d) => d.name).join(", ")})\n` +
        `elk-x = ELK-routed crossings; gen = generated-diagram path; auto = auto-layout path\n` +
        `x = crossings, over = edge through a node, lbl = label overlaps\n\n` +
        rows.join("\n") +
        "\n",
    );
    expect(rows).toHaveLength(VARIANTS.length + 2);
  });
});
