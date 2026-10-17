import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The llm feature must not import the canvas feature (F20): the canvas mounts
 * the chat and hands it a DiagramToolHost instead.
 *
 * `ir/` is excluded: it still imports canvas layout code, and this phase is not
 * allowed to touch it. That edge is the one that remains.
 */
const LLM = resolve(__dirname);
const EXCLUDED_DIRS = new Set([join(LLM, "ir")]);
const CANVAS_IMPORT = /from\s+["']@\/features\/canvas(\/|["'])|import\(\s*["']@\/features\/canvas/;

function files(dir: string): string[] {
  if (EXCLUDED_DIRS.has(dir)) return [];
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return files(full);
    return /\.tsx?$/.test(entry) ? [full] : [];
  });
}

describe("llm -> canvas import boundary", () => {
  it("no file in features/llm (outside ir/) imports features/canvas", () => {
    const offenders = files(LLM)
      .filter((file) => CANVAS_IMPORT.test(readFileSync(file, "utf8")))
      .map((file) => relative(LLM, file));
    expect(offenders).toEqual([]);
  });
});
