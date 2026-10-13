import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/** Structured analysis was removed: reviews are answered in Markdown now. */
const SRC = resolve(__dirname, "../..");
const REMOVED = ["AnalysisPanel", "pendingAnalysis", "tryParseAnalysis", "dismissPendingAnalysis"];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return files(full);
    // Production code only; tests may name the removed symbols to assert they are gone.
    return /\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry) ? [full] : [];
  });
}

describe("structured analysis removal", () => {
  it("leaves no references to the analysis panel, state or parser", () => {
    const offenders = files(SRC).flatMap((file) => {
      const source = readFileSync(file, "utf8");
      return REMOVED.filter((name) => source.includes(name)).map((name) => `${file}: ${name}`);
    });
    expect(offenders).toEqual([]);
  });
});
