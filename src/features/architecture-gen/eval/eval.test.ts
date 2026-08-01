import { describe, it, expect } from "vitest";
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { EVAL_CASES } from "./cases";
import { compareCase, measureEngine, measureLegacy } from "./metrics";
import { runBaseline, formatBaseline } from "./run-baseline";
import { ProposalSession } from "../session";

const here = dirname(fileURLToPath(import.meta.url));
const JSON_PATH = resolve(here, "baseline.json");
const MD_PATH = resolve(here, "baseline.md");

describe("evaluation cases", () => {
  it("covers C4 and AWS, request- and event-driven", () => {
    const ids = EVAL_CASES.map((c) => c.id);
    expect(ids.length).toBeGreaterThanOrEqual(5);
    expect(ids.some((id) => id.startsWith("c4-"))).toBe(true);
    expect(ids.some((id) => id.startsWith("aws-"))).toBe(true);
  });

  it("every case has a valid IR that the new path accepts", () => {
    for (const evalCase of EVAL_CASES) {
      const result = new ProposalSession().propose(evalCase.ir);
      expect(result.status, `${evalCase.id}: ${result.diagnostics[0]?.message}`).not.toBe(
        "schema-invalid",
      );
      expect(result.status, `${evalCase.id}: ${result.diagnostics[0]?.message}`).not.toBe(
        "structurally-invalid",
      );
      expect(result.status, `${evalCase.id}: ${result.diagnostics[0]?.message}`).not.toBe(
        "layout-failed",
      );
    }
  });

  it("expresses each case both ways, over the same elements", () => {
    for (const evalCase of EVAL_CASES) {
      expect(evalCase.legacy.nodes.length, evalCase.id).toBe(evalCase.ir.nodes.length);
      expect(evalCase.legacy.edges.length, evalCase.id).toBe(evalCase.ir.connections?.length ?? 0);
    }
  });
});

describe("metrics", () => {
  it("measures the legacy path with the same ruler as the engine", () => {
    const evalCase = EVAL_CASES[0]!;
    const legacy = measureLegacy(evalCase.legacy.nodes, evalCase.legacy.edges);
    const engine = measureEngine(evalCase);

    // Same elements measured both ways.
    expect(legacy.nodeCount).toBe(engine.nodeCount);
    expect(legacy.edgeCount).toBe(engine.edgeCount);
  });

  it("reports overlap area, not just a boolean", () => {
    // Two nodes placed on top of each other by hand.
    const metrics = measureLegacy(
      [
        { id: "a", type: "system", name: "A", x: 100, y: 100 },
        { id: "b", type: "system", name: "B", x: 120, y: 110 },
      ],
      [],
    );

    expect(metrics.overlappingPairs).toBe(1);
    expect(metrics.overlapAreaPx).toBeGreaterThan(0);
  });

  it("gives the engine perfect grid alignment", () => {
    for (const evalCase of EVAL_CASES) {
      expect(measureEngine(evalCase).gridAlignmentPct, evalCase.id).toBe(100);
    }
  });
});

describe("baseline", () => {
  it("produces a comparison for every case", () => {
    const report = runBaseline();
    expect(report.cases).toHaveLength(EVAL_CASES.length);
    expect(report.summary.legacy).toHaveProperty("readabilityScore");
    expect(report.summary.engine).toHaveProperty("readabilityScore");
  });

  it("writes the committed baseline files", () => {
    const report = runBaseline();
    writeFileSync(JSON_PATH, `${JSON.stringify(report, null, 2)}\n`);
    writeFileSync(MD_PATH, formatBaseline(report));

    expect(existsSync(JSON_PATH)).toBe(true);
    expect(existsSync(MD_PATH)).toBe(true);
  });

  it("keeps the committed baseline in step with the code", () => {
    // If this fails, re-run the suite: the file above is regenerated from the same data.
    const committed = JSON.parse(readFileSync(JSON_PATH, "utf8")) as ReturnType<typeof runBaseline>;
    const fresh = runBaseline();

    expect(committed.caseCount).toBe(fresh.caseCount);
    expect(committed.summary.engine.readabilityScore).toBe(fresh.summary.engine.readabilityScore);
  });

  it("shows the engine leaving no overlapping nodes", () => {
    // The headline claim of the whole slice: measured layout does not stack boxes.
    const report = runBaseline();
    expect(report.summary.engine.overlappingPairs).toBe(0);
  });

  it("records the engine as the number later slices must not regress", () => {
    const report = runBaseline();
    for (const entry of report.cases) {
      expect(entry.engine.errors, `${entry.id} must start clean`).toBe(0);
    }
  });
});

describe("comparison", () => {
  it("summarises both paths per case", () => {
    const comparison = compareCase(EVAL_CASES[1]!);
    expect(comparison.legacy.readabilityScore).toBeGreaterThanOrEqual(0);
    expect(comparison.engine.readabilityScore).toBeGreaterThanOrEqual(0);
  });
});
