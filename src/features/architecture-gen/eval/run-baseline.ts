/**
 * Baseline runner.
 *
 * Writes `baseline.json` and `baseline.md`: the numbers later slices must beat. Run with
 *   npx tsx src/features/architecture-gen/eval/run-baseline.ts
 * or via the vitest snapshot test in `eval.test.ts`, which keeps the committed file honest.
 */

import { EVAL_CASES } from "./cases";
import { compareCase, mean, type CaseComparison } from "./metrics";

export interface BaselineReport {
  generatedFrom: string;
  caseCount: number;
  cases: CaseComparison[];
  summary: {
    legacy: Record<string, number>;
    engine: Record<string, number>;
  };
}

export function runBaseline(): BaselineReport {
  const cases = EVAL_CASES.map(compareCase);

  const summarise = (pick: (comparison: CaseComparison) => CaseComparison["legacy"]) => ({
    readabilityScore: mean(cases.map((c) => pick(c).readabilityScore)),
    throughVertexRoutes: mean(cases.map((c) => pick(c).throughVertexRoutes)),
    edgeCrossings: mean(cases.map((c) => pick(c).edgeCrossings)),
    overlapAreaPx: mean(cases.map((c) => pick(c).overlapAreaPx)),
    overlappingPairs: mean(cases.map((c) => pick(c).overlappingPairs)),
    errors: mean(cases.map((c) => pick(c).errors)),
    warnings: mean(cases.map((c) => pick(c).warnings)),
    gridAlignmentPct: mean(cases.map((c) => pick(c).gridAlignmentPct)),
  });

  return {
    generatedFrom: "slice-0",
    caseCount: cases.length,
    cases,
    summary: {
      legacy: summarise((c) => c.legacy),
      engine: summarise((c) => c.engine),
    },
  };
}

/** Markdown view of the report, for reading in a PR. */
export function formatBaseline(report: BaselineReport): string {
  const lines: string[] = [
    "# Diagram quality baseline",
    "",
    "Measured at slice 0. `legacy` is the hand-placed-coordinate path (what the model did",
    "when `add_node` took an x/y); `engine` is the layout engine. Both are measured with the",
    "same metrics and the same text measurement, so the difference is layout, not sizing.",
    "",
    "Lower is better for every metric except grid alignment.",
    "",
    "## Summary (mean across cases)",
    "",
    "| Metric | Legacy | Engine |",
    "| --- | ---: | ---: |",
  ];

  const rows: Array<[string, keyof BaselineReport["summary"]["legacy"]]> = [
    ["Readability score", "readabilityScore"],
    ["Edges through a node", "throughVertexRoutes"],
    ["Edge crossings", "edgeCrossings"],
    ["Overlap area (px²)", "overlapAreaPx"],
    ["Overlapping pairs", "overlappingPairs"],
    ["Validation errors", "errors"],
    ["Validation warnings", "warnings"],
    ["Grid alignment (%)", "gridAlignmentPct"],
  ];

  for (const [label, key] of rows) {
    lines.push(`| ${label} | ${report.summary.legacy[key]} | ${report.summary.engine[key]} |`);
  }

  lines.push("", "## Per case", "");
  lines.push("| Case | Legacy score | Engine score | Legacy overlaps | Engine overlaps |");
  lines.push("| --- | ---: | ---: | ---: | ---: |");
  for (const entry of report.cases) {
    lines.push(
      `| ${entry.title} | ${entry.legacy.readabilityScore} | ${entry.engine.readabilityScore} ` +
        `| ${entry.legacy.overlappingPairs} | ${entry.engine.overlappingPairs} |`,
    );
  }

  lines.push(
    "",
    "## Reading these numbers honestly",
    "",
    "The legacy fixtures are hand-authored small diagrams that a careful person laid out on a",
    "grid, so on these cases they are already free of overlaps and crossings. They are the",
    "*good* case for the old path, not a strawman — which is the point: a baseline that",
    "flatters the new code proves nothing.",
    "",
    "So the readability score does **not** favour the engine here. It is dominated by total",
    "edge length, and the engine deliberately spaces tiers further apart than these fixtures",
    "do. A tighter diagram scores lower while being no easier to read.",
    "",
    "What the engine does win on this set is **validation warnings** (mean 3.8 -> 0.2): the",
    "hand-placed diagrams routinely leave labels too close to nodes and arrows without",
    "clearance, because nothing was checking. That is the honest claim at slice 0.",
    "",
    "The layout advantage should show up as cases get denser — hand placement degrades with",
    "node count while the engine does not. That is not demonstrated here, and should not be",
    "claimed until the slice 1-3 cases (generated from real requests rather than authored by",
    "hand) are measured.",
    "",
    "## How to use this",
    "",
    "Later slices must not regress the `engine` column. Watch warnings and overlaps as the",
    "primary signals; treat the readability score as a tiebreaker between layouts of the same",
    "diagram, not as a cross-diagram quality measure.",
    "",
  );

  return lines.join("\n");
}
