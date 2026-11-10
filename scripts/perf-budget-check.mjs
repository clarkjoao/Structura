// Fails when a perf:large report exceeds the ceilings in
// openspec/changes/large-diagram-performance/budgets.json.
//   PERF_OUT=perf-report.json npm run perf:large && node scripts/perf-budget-check.mjs perf-report.json
import { readFileSync } from "node:fs";

const reportPath = process.argv[2];
if (!reportPath) {
  console.error("usage: node scripts/perf-budget-check.mjs <report.json>");
  process.exit(2);
}
const report = JSON.parse(readFileSync(reportPath, "utf8"));
const budgets = JSON.parse(
  readFileSync(
    new URL("../openspec/changes/large-diagram-performance/budgets.json", import.meta.url),
    "utf8",
  ),
);
const read = (path) => path.split(".").reduce((value, key) => value?.[key], report);

const failures = [];
for (const [path, limit] of Object.entries(budgets.limits)) {
  const value = read(path);
  const ok = typeof value === "number" && value <= limit;
  console.log(`${ok ? "ok  " : "FAIL"} ${path} = ${value} (limit ${limit})`);
  if (!ok) failures.push(path);
}
for (const path of budgets.mustBeTrue) {
  const ok = read(path) === true;
  console.log(`${ok ? "ok  " : "FAIL"} ${path} = ${read(path)} (must be true)`);
  if (!ok) failures.push(path);
}
if (failures.length) {
  console.error(`\n${failures.length} perf budget(s) exceeded: ${failures.join(", ")}`);
  process.exit(1);
}
