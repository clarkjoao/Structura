import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { cloudServiceIdClearingPatch, cloudServiceIdWrite } from "./cloud-service-id";

/**
 * F6b: `cloudServiceId` has exactly one producer.
 *
 * The audit found thirteen unconditional write sites and no technical gate —
 * the release rule lived only in ADR prose. Concentrating the writes is what
 * makes the gate reviewable, and this test is what keeps them concentrated: a
 * fourteenth site cannot be added without turning this suite red and reading
 * why.
 *
 * The build-side half of the gate lives in `vite.config.ts`
 * (`cloudServiceIdReleaseGate`), which refuses a production bundle unless
 * `VITE_ENABLE_CLOUD_SERVICE_ID_WRITE=true`.
 */

const SRC = path.resolve(__dirname, "../../../");

/** The control point itself, plus files that legitimately name the field. */
const ALLOWED = new Set(
  [
    // The single producer.
    "features/diagram/model/cloud-service-id.ts",
    // This test.
    "features/diagram/model/cloud-service-id.write-gate.test.ts",
    // The v13 migration: it *is* the cutover, and it writes the field by
    // definition when upgrading a stored payload.
    "features/diagram/store/persist.config.ts",
    // Builds the tolerant-*read* input (`CloudServiceIdFields`) for
    // `resolveCloudServiceId`. The key appears on the way in, not on the way
    // to storage.
    "features/element-presets/components/ElementPresetPreviewCard.tsx",
  ].map((p) => path.join(SRC, p)),
);

/**
 * Stored payloads rather than code paths.
 *
 * Seed workspaces, the built-in pattern catalog and test fixtures are
 * persisted documents that already contain the field, the same way a user's
 * saved file does — `patterns.slice.ts` is the code that *inserts* them, and
 * it goes through the control point. Gating these would gate data, not writes.
 */
const ALLOWED_DIRS = [path.join(SRC, "fixtures"), path.join(SRC, "lib", "catalogs")];

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules") continue;
      out.push(...sourceFiles(full));
    } else if (/\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Writes look like `cloudServiceId: <value>` in an object literal.
 *
 * A read (`comp.cloudServiceId`, `resolveCloudServiceId(…)`) never matches —
 * the field is preceded by a dot. Shorthand (`{ cloudServiceId }`) does not
 * match either, because it carries no colon.
 */
const WRITE_PATTERN = /(^|[^.\w])cloudServiceId\s*\??\s*:/;

/**
 * …but a *declaration* also carries a colon: `cloudServiceId?: string` on an
 * interface, `cloudServiceId: string | undefined` on a parameter. Those name
 * the field without ever persisting it, so they are not write sites.
 */
const DECLARATION_PATTERN = /cloudServiceId\s*\??\s*:\s*(string|number|boolean|unknown)\b/;

describe("F6b — cloudServiceId has one write path", () => {
  it("no source file outside the control point emits the field", () => {
    const offenders: string[] = [];

    for (const file of sourceFiles(SRC)) {
      if (ALLOWED.has(file)) continue;
      if (ALLOWED_DIRS.some((dir) => file.startsWith(dir + path.sep))) continue;
      // Test fixtures build components the way a stored file does; they are
      // data, and none of them is a production write path.
      if (/\.test\.tsx?$/.test(file)) continue;

      const lines = fs.readFileSync(file, "utf8").split("\n");
      lines.forEach((line, index) => {
        if (line.trimStart().startsWith("*") || line.trimStart().startsWith("//")) return;
        if (!WRITE_PATTERN.test(line)) return;
        if (DECLARATION_PATTERN.test(line)) return;
        offenders.push(`${path.relative(SRC, file)}:${index + 1} — ${line.trim()}`);
      });
    }

    expect(
      offenders,
      "Write `cloudServiceId` through `cloudServiceIdWrite()` / " +
        "`cloudServiceIdClearingPatch()` in features/diagram/model/cloud-service-id.ts. " +
        "That single producer is what the F6b release gate is reviewed against.\n" +
        offenders.join("\n"),
    ).toEqual([]);
  });
});

describe("the control point itself", () => {
  it("omits the field when there is no service, so component literals keep their shape", () => {
    expect(cloudServiceIdWrite(undefined)).toEqual({});
    expect(cloudServiceIdWrite("")).toEqual({});
    expect(cloudServiceIdWrite("   ")).toEqual({});
    expect("cloudServiceId" in cloudServiceIdWrite(undefined)).toBe(false);
  });

  it("writes a trimmed value when there is one", () => {
    expect(cloudServiceIdWrite("lambda")).toEqual({ cloudServiceId: "lambda" });
    expect(cloudServiceIdWrite("  lambda  ")).toEqual({ cloudServiceId: "lambda" });
  });

  it("keeps the key present in a patch, so clearing the select erases the field", () => {
    // `updateComponent` merges: an omitted key would leave the old service in
    // place, which is the opposite of what the user asked for.
    expect(cloudServiceIdClearingPatch("")).toEqual({ cloudServiceId: undefined });
    expect("cloudServiceId" in cloudServiceIdClearingPatch("")).toBe(true);
    expect(cloudServiceIdClearingPatch("rds")).toEqual({ cloudServiceId: "rds" });
  });
});
