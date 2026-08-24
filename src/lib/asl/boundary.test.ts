import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The ASL conversion is a boundary converter (ADR-0006): it knows the format,
 * the model never knows the format exists. Enforcing it here keeps the module
 * pure, testable without a store, and reusable by an isolated build later on
 * (the reason `export-core` carries the same guard).
 */

const HERE = dirname(fileURLToPath(import.meta.url));

function sourceFiles(): string[] {
  return readdirSync(HERE).filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts"));
}

describe("src/lib/asl boundary", () => {
  it("imports nothing from @/features", () => {
    for (const file of sourceFiles()) {
      const source = readFileSync(join(HERE, file), "utf8");
      expect(source, `${file} must not import from @/features`).not.toMatch(
        /from\s+["']@\/features\//,
      );
    }
  });

  it("never touches storage directly", () => {
    for (const file of sourceFiles()) {
      // `asl-fixtures` reads the reference document from disk; it is test-only
      // and never reachable from application code.
      if (file === "asl-fixtures.ts") continue;
      const source = readFileSync(join(HERE, file), "utf8");
      expect(source, `${file} must not use localStorage`).not.toMatch(/localStorage/);
    }
  });

  it("carries no user-visible strings — only issue codes", () => {
    const validator = readFileSync(join(HERE, "asl-validator.ts"), "utf8");
    expect(validator).not.toMatch(/\bt\(["']/);
    expect(validator).toMatch(/code:\s*"/);
  });
});
