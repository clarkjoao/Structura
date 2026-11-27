import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { afterEach, describe, expect, it, vi } from "vitest";
import i18n from "@/infrastructure/i18n";
import {
  createCatalogIndex,
  registryCatalogEntries,
} from "@/features/elements/search/catalog-index";

/**
 * Locks "the LLM chunk must not snapshot the element registry at module scope".
 *
 * History: F5c read `allElements()` at module scope for the IR allowlist; the LLM
 * feature is its own lazy chunk, the registry was empty at chunk load, and every
 * `aws-compute` IR was rejected while vitest stayed green. Reverted in 42ec2267
 * (introduced with 49416c0b; the IR it guarded was removed in DC-070); AGENTS.md "Known
 * sharp edges". Related: ac72766c (rebuild catalog indexes when the second locale
 * bundle loads) and 49416c0b (same-turn catalog gate dropping valid nodes).
 */

const LLM_DIR = join(process.cwd(), "src/features/llm");

describe("LLM readers see elements registered after they were imported", () => {
  it("catalog readers resolve the registry at call time, not import time", async () => {
    vi.resetModules();
    // Readers first: the registry is still empty, exactly like a lazy chunk load.
    const catalog = await import("./component-catalog");
    const validation = await import("./add-node-validation");
    const query = await import("./element-catalog-query");
    const prompt = await import("./prompt-builder");
    const tools = await import("./tools");
    const registry = await import("@/features/elements/element.registry");

    expect(registry.allElements()).toHaveLength(0);
    expect(catalog.isValidNodeType("note")).toBe(false);

    await import("@/features/elements/bootstrap");
    expect(registry.allElements().length).toBeGreaterThan(0);

    expect(catalog.isValidNodeType("note")).toBe(true);
    expect(catalog.allComponentTypes().map((d) => d.nodeType)).toContain("note");
    expect(validation.validateAddNodeAgainstRegistry("note")).toEqual({ ok: true });
    expect(catalog.buildComponentTypeCatalog()).toContain('nodeType: "note"');
    expect(prompt.buildSystemPrompt).toBeTypeOf("function");
    expect(query.searchElements({ query: "note" }).results.map((r) => r.elementType)).toContain(
      "note",
    );
    const families = query.listElementFamilies().families;
    expect(families.some((f) => f.elementCount > 0)).toBe(true);
    expect(tools.ALL_TOOLS.length).toBeGreaterThan(0);
  });
});

/** Registry getters that must not run in a top-level initialiser. */
const REGISTRY_GETTERS = new Set([
  "allElements",
  "offeredElements",
  "registeredElementIds",
  "getElement",
  "hasElement",
  "allCloudFamilies",
  "nonCatalogFamilyIds",
  "familyOwnElements",
]);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return full.endsWith(".ts") && !/\.(test|spec)\.ts$/.test(full) ? [full] : [];
  });
}

/** Calls to registry getters reachable without entering a function body. */
function topLevelRegistryCalls(file: string): string[] {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isFunctionLike(node) || ts.isClassDeclaration(node) || ts.isClassExpression(node)) {
      return;
    }
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      if (REGISTRY_GETTERS.has(node.expression.text)) found.push(node.expression.text);
    }
    ts.forEachChild(node, visit);
  };
  source.statements.forEach((statement) => {
    if (ts.isVariableStatement(statement) || ts.isExpressionStatement(statement)) visit(statement);
  });
  return found;
}

describe("static guard: no module-scope registry reads in features/llm", () => {
  it("finds none in the shipped sources", () => {
    const offenders = sourceFiles(LLM_DIR)
      .map((file) => ({ file: relative(process.cwd(), file), calls: topLevelRegistryCalls(file) }))
      .filter((entry) => entry.calls.length > 0)
      .map((entry) => `${entry.file}: ${entry.calls.join(", ")}`);
    expect(offenders, `module-scope registry snapshot in:\n${offenders.join("\n")}`).toEqual([]);
  });
});

describe("catalog index follows the language (ac72766c)", () => {
  const original = i18n.language;
  afterEach(async () => {
    await i18n.changeLanguage(original);
  });

  it("an index built in en is stale after pt-BR loads; a rebuild reflects pt-BR", async () => {
    await i18n.changeLanguage("en");
    const build = () => {
      const { groups, entries } = registryCatalogEntries();
      return createCatalogIndex(groups, entries);
    };
    const english = build();
    await i18n.changeLanguage("pt-BR");
    const portuguese = build();

    const labels = (index: ReturnType<typeof build>) => index.entries.map((e) => e.label);
    expect(labels(portuguese)).not.toEqual(labels(english));
    const groupLabels = (index: ReturnType<typeof build>) => index.groups.map((g) => g.label);
    expect(groupLabels(portuguese)).not.toEqual(groupLabels(english));
  });
});
