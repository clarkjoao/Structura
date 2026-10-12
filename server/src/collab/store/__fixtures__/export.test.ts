import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { GO_FIXTURES_PATH, mergeFixturesJson } from "./export.js";

describe.skipIf(!existsSync(path.dirname(GO_FIXTURES_PATH)))("Go merge fixtures", () => {
  it("match the TypeScript fixtures (run scripts/export-merge-fixtures.ts after a change)", () => {
    expect(readFileSync(GO_FIXTURES_PATH, "utf8")).toBe(mergeFixturesJson());
  });
});
