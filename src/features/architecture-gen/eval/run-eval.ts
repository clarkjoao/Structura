/**
 * Evaluation runner — CLI entry point.
 *
 * Measures the current code against the committed baseline and reports regressions.
 * Run with:
 *   npx tsx src/features/architecture-gen/eval/run-eval.ts
 *   npx tsx src/features/architecture-gen/eval/run-eval.ts --cases=aws
 *   npx tsx src/features/architecture-gen/eval/run-eval.ts --cases=baseline --verbose
 *   npx tsx src/features/architecture-gen/eval/run-eval.ts --ci
 *
 * CI mode outputs GitHub Actions workflow commands so failures surface as annotations
 * in the PR run page.
 */

import { C4_CONTEXT_CASES } from "./c4-context-cases";
import { C4_CONTAINER_CASES } from "./c4-container-cases";
import { AWS_CASES } from "./aws-cases";
import { runBaseline, formatBaseline, type BaselineReport } from "./run-baseline";
import { ProposalSession } from "../session";
import { layoutDiagram, approximateMeasureText } from "../../../lib/layout-engine";
import { toLayoutInput } from "../ir";
import { segmentIntersectsRect } from "../../../lib/validators/geometry";

// ─── Arguments ─────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const ci = args.includes("--ci");
const verbose = args.includes("--verbose");
const caseFilter = args.find((a) => a.startsWith("--cases="))?.split("=")[1];

// ─── Suites ───────────────────────────────────────────────────────────────────

interface SuiteResult {
  name: string;
  id: string;
  cases: number;
  errors: number;
  report?: BaselineReport;
}

function runBaselineSuite(): SuiteResult {
  const report = runBaseline();
  const errors = report.cases.filter((c) => c.engine.errors > 0).length;
  return {
    name: "Baseline comparison",
    id: "baseline",
    cases: report.cases.length,
    errors,
    report,
  };
}

function runReferenceSuite<T extends { id: string; ir: unknown }>(
  name: string,
  cases: readonly T[],
): SuiteResult {
  let errors = 0;
  for (const c of cases) {
    const result = new ProposalSession().propose(
      c.ir as Parameters<typeof ProposalSession.prototype.propose>[0],
    );
    if (result.errors > 0) errors++;
  }
  return { name, id: name, cases: cases.length, errors };
}

// ─── Property tests ──────────────────────────────────────────────────────────────

/** Checks determinism: same IR → identical LayoutResult across N runs. */
function runPropertyTests(): SuiteResult {
  const allCases = [...C4_CONTEXT_CASES, ...C4_CONTAINER_CASES, ...AWS_CASES];
  const DETERMINISM_RUNS = 5;

  const failures: string[] = [];

  for (const c of allCases) {
    const input = toLayoutInput(c.ir);
    const first = layoutDiagram(input, { measureText: approximateMeasureText });

    for (let run = 1; run < DETERMINISM_RUNS; run++) {
      const next = layoutDiagram(input, { measureText: approximateMeasureText });
      const diff = layoutResultDiff(first, next);
      if (diff.length > 0) {
        failures.push(`${c.id} (run ${run}): ${diff.join("; ")}`);
      }
    }
  }

  // Invariant: no polyline segment intersects a non-endpoint node bbox.
  for (const c of allCases) {
    const result = layoutDiagram(toLayoutInput(c.ir), { measureText: approximateMeasureText });
    const violations = checkInvariant(result);
    for (const v of violations) {
      failures.push(`${c.id}: ${v}`);
    }
  }

  return {
    name: "Property tests",
    id: "property",
    cases: allCases.length,
    errors: failures.length,
  };
}

/** Returns a list of field differences between two LayoutResults. */
function layoutResultDiff(
  a: ReturnType<typeof layoutDiagram>,
  b: ReturnType<typeof layoutDiagram>,
): string[] {
  const diffs: string[] = [];

  // Compare node positions
  for (const [id, nodeA] of a.state.nodes) {
    const nodeB = b.state.nodes.get(id);
    if (!nodeB) { diffs.push(`node ${id} missing in second run`); continue; }
    if (nodeA.x !== nodeB.x || nodeA.y !== nodeB.y) {
      diffs.push(`node ${id} position: (${nodeA.x},${nodeA.y}) vs (${nodeB.x},${nodeB.y})`);
    }
  }

  // Compare column orders
  const aOrder = a.state.columns.map((c) => c.nodeIds.join(",")).join("|");
  const bOrder = b.state.columns.map((c) => c.nodeIds.join(",")).join("|");
  if (aOrder !== bOrder) diffs.push(`column order: ${aOrder} vs ${bOrder}`);

  // Compare waypoints
  for (const connA of a.state.connections) {
    const connB = b.state.connections.find((c) => c.id === connA.id);
    if (!connB) continue;
    const wpA = connA.waypoints;
    const wpB = connB.waypoints;
    if (!wpA && !wpB) continue;
    if (!wpA || !wpB) { diffs.push(`conn ${connA.id} waypoints: ${wpA ? "present" : "missing"} vs ${wpB ? "present" : "missing"}`); continue; }
    if (wpA.length !== wpB.length) { diffs.push(`conn ${connA.id} waypoints length: ${wpA.length} vs ${wpB.length}`); continue; }
    for (let i = 0; i < wpA.length; i++) {
      if (wpA[i]!.x !== wpB[i]!.x || wpA[i]!.y !== wpB[i]!.y) {
        diffs.push(`conn ${connA.id} wp[${i}]: (${wpA[i]!.x},${wpA[i]!.y}) vs (${wpB[i]!.x},${wpB[i]!.y})`);
        break;
      }
    }
  }

  return diffs;
}

/** Checks the routing invariant: no polyline segment intersects a non-endpoint node. */
function checkInvariant(result: ReturnType<typeof layoutDiagram>): string[] {
  const violations: string[] = [];
  const state = result.state;

  for (const conn of state.connections) {
    const waypoints = conn.waypoints;
    if (!waypoints || waypoints.length < 2) continue;
    if (conn.routing === "suppressed") continue;

    for (let i = 0; i < waypoints.length - 1; i++) {
      const a = waypoints[i]!;
      const b = waypoints[i + 1]!;

      for (const node of state.nodes.values()) {
        // Skip endpoint nodes
        if (node.id === conn.from || node.id === conn.to) continue;

        if (segmentIntersectsRect({ a, b }, { x: node.x, y: node.y, width: node.width, height: node.height })) {
          violations.push(`conn ${conn.id} seg${i} (${Math.round(a.x)},${Math.round(a.y)})→(${Math.round(b.x)},${Math.round(b.y)}) hits "${node.name}" (${node.id})`);
        }
      }
    }
  }

  return violations;
}

const suites: SuiteResult[] = [
  runReferenceSuite("C4 Context", C4_CONTEXT_CASES),
  runReferenceSuite("C4 Container", C4_CONTAINER_CASES),
  runReferenceSuite("AWS", AWS_CASES),
  runBaselineSuite(),
  runPropertyTests(),
];

const activeSuites = caseFilter
  ? suites.filter((s) => s.id.toLowerCase() === caseFilter.toLowerCase())
  : suites;

// ─── Main ─────────────────────────────────────────────────────────────────────

const totalCases = activeSuites.reduce((s, r) => s + r.cases, 0);
const totalErrors = activeSuites.reduce((s, r) => s + r.errors, 0);
const pass = totalErrors === 0;

// ─── Output ───────────────────────────────────────────────────────────────────

if (ci) {
  console.log(`::group::Diagram eval`);
  for (const r of activeSuites) {
    const pct = r.cases > 0 ? Math.round(((r.cases - r.errors) / r.cases) * 100) : 100;
    const tag = r.errors > 0 ? "warning" : "notice";
    const icon = r.errors === 0 ? "✅" : "⚠️ ";
    console.log(`::${tag}::${icon} ${r.name}: ${r.cases - r.errors}/${r.cases} cases (${pct}%)`);
  }
  console.log(`::endgroup::`);

  if (!pass) {
    console.log(`::error::Diagram eval failed — ${totalErrors} case(s) returned errors`);
    process.exit(1);
  } else {
    console.log(`::notice::Diagram eval passed: ${totalCases} cases, 0 errors`);
    process.exit(0);
  }
}

if (verbose) {
  console.log();
  for (const r of activeSuites) {
    if (r.report) {
      console.log(formatBaseline(r.report));
      console.log();
    } else {
      const pct = r.cases > 0 ? Math.round(((r.cases - r.errors) / r.cases) * 100) : 100;
      const icon = r.errors === 0 ? "✅" : "❌";
      console.log(`${icon} ${r.name}: ${r.cases - r.errors}/${r.cases} cases (${pct}%)`);
    }
  }
}

const summaryIcon = pass ? "✅" : "❌";
console.log(
  `${summaryIcon} eval — ${totalCases - totalErrors}/${totalCases} cases, ${totalErrors} error(s)`,
);

if (!pass) process.exit(1);
