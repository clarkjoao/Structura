/**
 * Drift guard (no past regression to cite): the host's ELK options and the copies kept for
 * code that cannot import the host must not drift apart silently.
 *
 *  - `src/lib/opscr-layout/elk-layout.ts` keeps its own `ELK_OPTIONS` (not exported; read
 *    from source through the TypeScript AST).
 *  - `extensions/vscode-opscr/src/arrange.ts` mirrors the arrange defaults and bounds of
 *    `src/features/diagram/model/layout-settings.ts`.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import {
  REFERENCE_MODES,
  LAYOUT_DENSITIES,
  REF_FORWARD_COLUMNS,
  REF_MIN_KEEP_DEFAULT,
  REF_MIN_KEEP_MAX,
  REF_MIN_KEEP_MIN,
  REF_NEIGHBOR_COLUMNS_DEFAULT,
  REF_NEIGHBOR_COLUMNS_MAX,
  REF_NEIGHBOR_COLUMNS_MIN,
} from "@/features/diagram/model/layout-settings";
import {
  DEFAULT_ARRANGE,
  readArrangeSettings,
} from "../../../../extensions/vscode-opscr/src/arrange";
import { ELK_OPTIONS_INTERACTIVE } from "./layoutEngine";

const ROOT = resolve(__dirname, "../../../..");

/** The string/number/boolean literal properties of `const <name> = { ... }` in a source file. */
function literalObject(file: string, name: string): Record<string, string | number | boolean> {
  const source = ts.createSourceFile(
    file,
    readFileSync(resolve(ROOT, file), "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  let found: Record<string, string | number | boolean> | undefined;
  const visit = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === name &&
      node.initializer &&
      ts.isObjectLiteralExpression(node.initializer)
    ) {
      found = {};
      for (const prop of node.initializer.properties) {
        if (!ts.isPropertyAssignment(prop)) continue;
        const key =
          ts.isStringLiteral(prop.name) || ts.isIdentifier(prop.name) ? prop.name.text : undefined;
        const v = prop.initializer;
        if (key === undefined) continue;
        if (ts.isStringLiteral(v) || ts.isNoSubstitutionTemplateLiteral(v)) found[key] = v.text;
        else if (ts.isNumericLiteral(v)) found[key] = Number(v.text);
        else if (v.kind === ts.SyntaxKind.TrueKeyword) found[key] = true;
        else if (v.kind === ts.SyntaxKind.FalseKeyword) found[key] = false;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  if (!found) throw new Error(`${name} not found in ${file}`);
  return found;
}

/**
 * Host-only keys the opscr copy legitimately lacks: the view layout has no ports and no
 * inter-layer edge spacing tuning, and `portPort` derives from the host's `HANDLE_PITCH`.
 */
const HOST_ONLY = [
  "elk.layered.spacing.edgeEdgeBetweenLayers",
  "elk.portConstraints",
  "elk.portAlignment.default",
  "elk.spacing.portPort",
];

describe("ELK options parity (host vs opscr-layout copy)", () => {
  const copy = literalObject("src/lib/opscr-layout/elk-layout.ts", "ELK_OPTIONS");

  it("the copy was actually extracted", () => {
    expect(Object.keys(copy).length).toBeGreaterThan(5);
  });

  it("every copy key exists in the host with the same value", () => {
    expect(copy).toEqual(
      Object.fromEntries(Object.entries(ELK_OPTIONS_INTERACTIVE).filter(([k]) => k in copy)),
    );
  });

  it("the host has no keys beyond the copy except the documented host-only ones", () => {
    const extra = Object.keys(ELK_OPTIONS_INTERACTIVE).filter((k) => !(k in copy));
    expect(extra.sort()).toEqual([...HOST_ONLY].sort());
  });
});

describe("VSCode arrange settings parity (extension vs host layout-settings)", () => {
  it("defaults match", () => {
    expect(DEFAULT_ARRANGE.refNeighborColumns).toBe(REF_NEIGHBOR_COLUMNS_DEFAULT);
    expect(DEFAULT_ARRANGE.refMinKeep).toBe(REF_MIN_KEEP_DEFAULT);
    expect(DEFAULT_ARRANGE.density).toBe("normal");
    expect(DEFAULT_ARRANGE.references).toBe(REFERENCE_MODES[0]);
    expect(DEFAULT_ARRANGE.refForward).toBe(true);
  });

  it("min and max limits match (probed through the clamping reader)", () => {
    const low = readArrangeSettings({ refNeighborColumns: -1000, refMinKeep: -1000 });
    const high = readArrangeSettings({ refNeighborColumns: 1000, refMinKeep: 1000 });
    expect(low.refNeighborColumns).toBe(REF_NEIGHBOR_COLUMNS_MIN);
    expect(high.refNeighborColumns).toBe(REF_NEIGHBOR_COLUMNS_MAX);
    expect(low.refMinKeep).toBe(REF_MIN_KEEP_MIN);
    expect(high.refMinKeep).toBe(REF_MIN_KEEP_MAX);
  });

  it("accepts exactly the host's densities and reference modes", () => {
    for (const density of LAYOUT_DENSITIES)
      expect(readArrangeSettings({ density }).density).toBe(density);
    for (const references of REFERENCE_MODES)
      expect(readArrangeSettings({ references }).references).toBe(references);
  });

  it("the forward-column constant is mirrored in the extension source", () => {
    const text = readFileSync(resolve(ROOT, "extensions/vscode-opscr/src/arrange.ts"), "utf8");
    expect(text).toMatch(new RegExp(`REF_FORWARD_COLUMNS = ${REF_FORWARD_COLUMNS};`));
  });
});
