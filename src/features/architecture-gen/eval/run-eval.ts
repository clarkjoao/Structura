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

const suites: SuiteResult[] = [
  runReferenceSuite("C4 Context", C4_CONTEXT_CASES),
  runReferenceSuite("C4 Container", C4_CONTAINER_CASES),
  runReferenceSuite("AWS", AWS_CASES),
  runBaselineSuite(),
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
