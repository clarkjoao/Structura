import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Persistence in the chat goes through `IStoragePort` (F18): no file in
 * features/llm touches `localStorage` or `sessionStorage` directly. Tests may,
 * to seed and inspect what the adapters wrote.
 */
const LLM = resolve(__dirname);
const DIRECT_ACCESS = /\b(?:localStorage|sessionStorage)\s*(?:\.|\[)/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry) ? [full] : [];
  });
}

describe("llm -> browser storage boundary", () => {
  it("no source file in features/llm uses localStorage or sessionStorage directly", () => {
    const offenders = sourceFiles(LLM)
      .filter((file) =>
        readFileSync(file, "utf8")
          .split("\n")
          // Comments may name the old storage; code may not use it.
          .filter((line) => !/^\s*(?:\/\/|\*|\/\*)/.test(line))
          .some((line) => DIRECT_ACCESS.test(line)),
      )
      .map((file) => relative(LLM, file));
    expect(offenders).toEqual([]);
  });
});
