import { describe, expect, it } from "vitest";
import {
  EMPTY_BOUNDARY_ASL,
  WIDE_FANOUT_ASL,
  planFromSource,
  readReferenceSolution,
} from "@/lib/asl/asl-fixtures";
import type { AslImportPlan } from "@/lib/asl";
import { toLayoutGraph } from "../import/asl-plan-to-graph";
import { layoutGraphElk } from "./graphLayoutEngine";
import { measureReadability, readLaidOutGraph, type ReadabilityReport } from "./layoutReadability";
import {
  buildRenderedPolylines,
  measureRenderedReadability,
  type RenderedEdgeInput,
} from "./renderedEdgePath";
import {
  resolveLabelPositions,
  pointAtRatio,
  type SpreadLabelsInput,
} from "../import/spread-edge-labels";

/**
 * Readability of the ASL importer over its reference fixtures.
 *
 * Same instrument and same contract as `layoutReadability.baseline.test.ts`:
 * this is a regression guard, never a gate. Nothing here can stop an ASL file
 * being imported — a diagram whose numbers get worse fails CI, not the user.
 *
 * Run `npx vitest run aslReadability.baseline` and read the printed tables.
 */

interface Fixture {
  name: string;
  source: string;
}

const FIXTURES: Fixture[] = [
  { name: "ASL reference solution", source: readReferenceSolution() },
  { name: "ASL empty boundary", source: EMPTY_BOUNDARY_ASL },
  { name: "ASL wide fan-out", source: WIDE_FANOUT_ASL },
];

/** Upper bounds, measured with the shipped configuration after label spreading. */
const BASELINE: Record<string, Pick<ReadabilityReport, "edgeNodeOverlaps" | "labelOverlaps">> = {
  "ASL reference solution": { edgeNodeOverlaps: 0, labelOverlaps: 0 },
  "ASL empty boundary": { edgeNodeOverlaps: 0, labelOverlaps: 0 },
  "ASL wide fan-out": { edgeNodeOverlaps: 0, labelOverlaps: 0 },
};

function labelsOf(plan: AslImportPlan): Map<string, string> {
  return new Map(plan.edges.map((edge) => [edge.key, edge.label]));
}

/**
 * Counts label-overlap issues at the spread positions the import pipeline uses,
 * not at the raw midpoint. `resolveLabelPositions` is the machinery that sets
 * `labelPosition` on connections — this harness measures what the user sees.
 */
function spreadLabelOverlaps(
  laidOut: Parameters<typeof readLaidOutGraph>[0],
  edges: RenderedEdgeInput[],
  labels: ReadonlyMap<string, string>,
  containerIds: ReadonlySet<string>,
): number {
  const { boxes, parentOf } = readLaidOutGraph(laidOut);
  const spreadPositions = resolveLabelPositions({
    absoluteBoxes: boxes,
    parentOf,
    containerIds,
    edges,
    labels,
  });

  const polylines = buildRenderedPolylines(boxes, edges, {});
  let overlaps = 0;

  const hasChildren = new Set<string>();
  for (const parent of parentOf.values()) {
    if (parent !== null && parent !== undefined) hasChildren.add(parent);
  }
  // A node is a leaf for label-obstacle purposes if it has no children AND is
  // not a container (panels and other compound nodes have empty interiors).
  const leafBoxes = Array.from(boxes.entries())
    .filter(([id]) => !hasChildren.has(id) && !containerIds.has(id))
    .map(([, box]) => box);

  const placedBoxes: Array<{ x: number; y: number; width: number; height: number }> = [];

  for (const polyline of polylines) {
    const text = labels.get(polyline.id);
    if (!text) continue;

    const pos = spreadPositions.get(polyline.id) ?? 0.5;
    const centre = pointAtRatio(polyline.points, pos);
    const width = text.length * 6.5 + 16;
    const height = 20;
    const box = {
      x: centre.x - width / 2,
      y: centre.y - height / 2,
      width,
      height,
    };

    for (const other of placedBoxes) {
      if (
        box.x < other.x + other.width &&
        box.x + box.width > other.x &&
        box.y < other.y + other.height &&
        box.y + box.height > other.y
      ) {
        overlaps += 1;
        break;
      }
    }
    for (const leaf of leafBoxes) {
      if (
        box.x < leaf.x + leaf.width &&
        box.x + box.width > leaf.x &&
        box.y < leaf.y + leaf.height &&
        box.y + box.height > leaf.y
      ) {
        overlaps += 1;
        break;
      }
    }
    placedBoxes.push(box);
  }

  return overlaps;
}

async function measure(plan: AslImportPlan) {
  const graph = toLayoutGraph(plan);
  const laidOut = await layoutGraphElk(graph.nodes, graph.edges);
  const labels = labelsOf(plan);
  const containerIds = new Set(graph.nodes.filter((n) => n.isContainer).map((n) => n.id));
  return {
    elk: measureReadability(laidOut, { labels }),
    rendered: measureRenderedReadability(laidOut, graph.edges, { labels }),
    spreadLabelOverlaps: spreadLabelOverlaps(laidOut, graph.edges, labels, containerIds),
  };
}

describe("ASL layout readability baseline", () => {
  it("prints the table and stays within the recorded baseline", async () => {
    const rows: string[] = [];
    const failures: string[] = [];

    for (const fixture of FIXTURES) {
      const plan = await planFromSource(fixture.source);
      const { elk, rendered } = await measure(plan);

      rows.push(
        [
          fixture.name.padEnd(24),
          `nodes ${String(elk.nodeCount).padStart(3)}`,
          `edges ${String(elk.edgeCount).padStart(3)}`,
          `elk-cross ${String(elk.edgeCrossings).padStart(3)}`,
          `rendered-cross ${String(rendered.edgeCrossings).padStart(3)}`,
          `over-node ${String(rendered.edgeNodeOverlaps).padStart(3)}`,
          `labels ${String(rendered.labelOverlaps).padStart(3)}`,
          `spread ${String(rendered.labelOverlaps - spreadLabelOverlaps).padStart(3)}`,
          `${elk.width}x${elk.height}`,
        ].join("  "),
      );

      const expected = BASELINE[fixture.name];
      if (!expected) continue;
      if (rendered.edgeNodeOverlaps > expected.edgeNodeOverlaps) {
        failures.push(
          `${fixture.name}: edgeNodeOverlaps ${rendered.edgeNodeOverlaps} > ${expected.edgeNodeOverlaps}`,
        );
      }
      if (spreadLabelOverlaps > expected.labelOverlaps) {
        failures.push(
          `${fixture.name}: labelOverlaps ${spreadLabelOverlaps} > ${expected.labelOverlaps}`,
        );
      }
    }

    console.info(`\nASL layout readability\n${rows.join("\n")}\n`);
    expect(failures, failures.join("\n")).toHaveLength(0);
  });

  it("lays every fixture out — readability is never a gate", async () => {
    for (const fixture of FIXTURES) {
      const plan = await planFromSource(fixture.source);
      const graph = toLayoutGraph(plan);
      const report = measureReadability(await layoutGraphElk(graph.nodes, graph.edges));
      expect(report.nodeCount, fixture.name).toBe(graph.nodes.length);
    }
  });
});

/**
 * The label decision, settled by measurement rather than taste.
 *
 * ELK is never told about edge labels, and the readability counter estimates a
 * label box at ~6.5px per character. ASL descriptions run 40-60 characters in
 * Portuguese — wider than the 150px gap between layers — so using them as the
 * label is expected to collide. This prints both options side by side.
 */
describe("ASL edge labels — verb vs description", () => {
  it("prints the comparison and keeps the shipped option overlap-free after spreading", async () => {
    const rows: string[] = [];
    let verbOverlaps = 0;

    for (const fixture of FIXTURES) {
      for (const mode of ["verb", "description"] as const) {
        const plan = await planFromSource(fixture.source, { edgeLabel: mode });
        const graph = toLayoutGraph(plan);
        const laidOut = await layoutGraphElk(graph.nodes, graph.edges);
        const labels = labelsOf(plan);
        const containerIds = new Set(graph.nodes.filter((n) => n.isContainer).map((n) => n.id));
        const overlapCount = spreadLabelOverlaps(laidOut, graph.edges, labels, containerIds);
        const longest = Math.max(0, ...plan.edges.map((edge) => edge.label.length));

        rows.push(
          [
            `${fixture.name} / ${mode}`.padEnd(42),
            `spread-overlap ${String(overlapCount).padStart(3)}`,
            `longest ${String(longest).padStart(3)} chars`,
          ].join("  "),
        );

        if (mode === "verb") verbOverlaps += overlapCount;
      }
    }

    console.info(`\nASL edge label comparison\n${rows.join("\n")}\n`);

    // The shipped option is `verb`; the assertion is on the option we ship.
    expect(verbOverlaps).toBe(0);
  });
});
