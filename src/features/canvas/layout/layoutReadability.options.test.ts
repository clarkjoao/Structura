import { describe, expect, it } from "vitest";
import { layoutElkGraph } from "./layoutEngine";
import { irToLayoutGraph } from "@/features/llm/ir/ir-to-layout-graph";
import { measureReadability, totalReadability } from "./layoutReadability";
import { labelsOf, REFERENCE_DIAGRAMS } from "./reference-diagrams";

/**
 * Comparison harness for layout options.
 *
 * Kept in the suite so the next tuning round starts from a re-runnable
 * measurement instead of a guess. It prints a table and asserts only the two
 * things that must always hold: every candidate still lays every diagram out
 * (readability is never a gate), and an option name that ELK does not
 * recognise is caught rather than silently ignored.
 *
 * Read it with:
 *   npx vitest run layoutReadability.options --reporter=verbose --silent=false
 */

interface Candidate {
  name: string;
  options: Record<string, string>;
}

const CANDIDATES: Candidate[] = [
  { name: "shipped (baseline)", options: {} },
  {
    name: "crossingMin=LAYER_SWEEP",
    options: { "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP" },
  },
  {
    name: "separateComponents=true",
    options: { "elk.separateConnectedComponents": "true" },
  },
  {
    name: "separateComponents=false",
    options: { "elk.separateConnectedComponents": "false" },
  },
  { name: "aspectRatio=2.5", options: { "elk.aspectRatio": "2.5" } },
  {
    // aspectRatio only has room to act when ELK is allowed to wrap layers, which
    // is how the legacy engine pairs them.
    name: "aspectRatio=2.5 + wrapping",
    options: {
      "elk.aspectRatio": "2.5",
      "elk.layered.wrapping.strategy": "MULTI_EDGE",
      "elk.layered.wrapping.cutting.strategy": "ARD",
    },
  },
  {
    name: "legacy trio",
    options: {
      "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
      "elk.separateConnectedComponents": "true",
      "elk.aspectRatio": "2.5",
    },
  },
  // The legacy trio all turned out to be ELK defaults, so these are the options
  // that could still move crossings: more sweeps, and straighter edges.
  { name: "thoroughness=20", options: { "elk.layered.thoroughness": "20" } },
  { name: "thoroughness=50", options: { "elk.layered.thoroughness": "50" } },
  {
    name: "favorStraightEdges",
    options: { "elk.layered.nodePlacement.favorStraightEdges": "true" },
  },
  {
    name: "layering=NETWORK_SIMPLEX",
    options: { "elk.layered.layering.strategy": "NETWORK_SIMPLEX" },
  },
  {
    name: "layering=LONGEST_PATH (legacy)",
    options: { "elk.layered.layering.strategy": "LONGEST_PATH" },
  },
];

/**
 * A deliberately bad value. If ELK honours the key, crossings must get worse on
 * at least one diagram; if the numbers are identical to the baseline, the key
 * is being ignored and any conclusion drawn from it would be worthless.
 */
const SANITY_CHECK: Candidate = {
  name: "crossingMin=NONE (validity probe)",
  options: { "elk.layered.crossingMinimization.strategy": "NONE" },
};

async function measureCandidate(candidate: Candidate) {
  const reports = [];
  for (const { name, ir } of REFERENCE_DIAGRAMS) {
    const graph = await layoutElkGraph(irToLayoutGraph(ir), candidate.options);
    reports.push({ name, report: measureReadability(graph, { labels: labelsOf(ir) }) });
  }
  return { reports, total: totalReadability(reports.map((entry) => entry.report)) };
}

describe("layout option comparison", () => {
  it("prints per-option totals across the reference diagrams", async () => {
    const lines: string[] = [
      "option".padEnd(34) + "crossings  placement  over-node  labels   widest   tallest",
    ];

    for (const candidate of [...CANDIDATES, SANITY_CHECK]) {
      const { total } = await measureCandidate(candidate);
      lines.push(
        candidate.name.padEnd(34) +
          String(total.edgeCrossings).padStart(9) +
          String(total.placementCrossings).padStart(11) +
          String(total.edgeNodeOverlaps).padStart(11) +
          String(total.labelOverlaps).padStart(8) +
          String(total.width).padStart(9) +
          String(total.height).padStart(10),
      );
    }

    console.info(
      `\nLayout option comparison (totals over 4 reference diagrams)\n${lines.join("\n")}\n`,
    );
    expect(lines.length).toBeGreaterThan(1);
  });

  it("keeps generating every diagram under every candidate", async () => {
    for (const candidate of [...CANDIDATES, SANITY_CHECK]) {
      for (const { name, ir } of REFERENCE_DIAGRAMS) {
        const graph = await layoutElkGraph(irToLayoutGraph(ir), candidate.options);
        const report = measureReadability(graph);
        expect(report.nodeCount, `${candidate.name} / ${name}`).toBe(ir.nodes.length);
      }
    }
  });

  /**
   * The four reference diagrams are each a single connected component, so
   * `separateConnectedComponents` has nothing to separate on them — measuring it
   * there and concluding "no effect" would be measuring nothing. This probe
   * gives it a graph it can actually act on: a generated diagram with an empty
   * boundary is exactly that shape.
   */
  it("measures separateConnectedComponents on a graph that has components to separate", async () => {
    const split: import("@/features/llm/ir/ir.types").DiagramIR = {
      type: "aws-deployment",
      nodes: [
        { id: "a", semanticType: "container", name: "A", parentId: null, tier: "compute" },
        { id: "b", semanticType: "container", name: "B", parentId: null, tier: "data" },
        { id: "c", semanticType: "container", name: "C", parentId: null, tier: "compute" },
        { id: "d", semanticType: "container", name: "D", parentId: null, tier: "data" },
        {
          id: "lonely-vpc",
          semanticType: "aws-vpc",
          name: "Standby",
          parentId: null,
          isBoundary: true,
          tier: "edge",
        },
      ],
      edges: [
        { id: "s1", sourceId: "a", targetId: "b", label: "" },
        { id: "s2", sourceId: "c", targetId: "d", label: "" },
      ],
    };

    const on = measureReadability(
      await layoutElkGraph(irToLayoutGraph(split), { "elk.separateConnectedComponents": "true" }),
    );
    const off = measureReadability(
      await layoutElkGraph(irToLayoutGraph(split), { "elk.separateConnectedComponents": "false" }),
    );

    console.info(
      `\nseparateConnectedComponents on a 3-component graph\n` +
        `  true : ${on.width}x${on.height}, crossings ${on.edgeCrossings}\n` +
        `  false: ${off.width}x${off.height}, crossings ${off.edgeCrossings}\n`,
    );

    // Both must still lay out; the assertion is that generation never breaks.
    expect(on.nodeCount).toBe(split.nodes.length);
    expect(off.nodeCount).toBe(split.nodes.length);
  });

  it("proves ELK actually honours the crossing-minimization key", async () => {
    const shipped = await measureCandidate(CANDIDATES[0]);
    const disabled = await measureCandidate(SANITY_CHECK);
    // Turning crossing minimization off has to change something. If it does not,
    // the option key is wrong and every measurement using it is meaningless.
    expect(
      disabled.total.edgeCrossings !== shipped.total.edgeCrossings ||
        disabled.total.placementCrossings !== shipped.total.placementCrossings,
      "elk.layered.crossingMinimization.strategy appears to be ignored",
    ).toBe(true);
  });
});
