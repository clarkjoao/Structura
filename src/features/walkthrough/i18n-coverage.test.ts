import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve as resolvePath } from "node:path";
import en from "@/infrastructure/i18n/locales/en.json";
import ptBR from "@/infrastructure/i18n/locales/pt-BR.json";

/**
 * Every `walkthrough.*` key the module reads exists in both locales.
 *
 * The repository's rule is that no user-visible string is hardcoded, and
 * `t("key", "English default")` quietly satisfies TypeScript while leaving
 * pt-BR readers with English. The module shipped with a dozen such keys, all
 * of them invisible until someone switched language. This test is what makes
 * the next one visible on the way in.
 */
/** Vitest runs from the repository root. */
const MODULE_DIR = resolvePath(process.cwd(), "src/features/walkthrough");

function sourceFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      found.push(...sourceFiles(full));
      continue;
    }
    if (!/\.tsx?$/.test(entry)) continue;
    if (/\.test\.tsx?$/.test(entry)) continue;
    found.push(full);
  }
  return found;
}

function usedKeys(): Set<string> {
  const keys = new Set<string>();
  for (const file of sourceFiles(MODULE_DIR)) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(/["'](walkthrough\.[A-Za-z0-9_.]+)["']/g)) {
      keys.add(match[1]);
    }
  }
  return keys;
}

function resolve(catalogue: unknown, key: string): unknown {
  let cursor: unknown = catalogue;
  for (const part of key.split(".")) {
    if (typeof cursor !== "object" || cursor === null) return undefined;
    cursor = (cursor as Record<string, unknown>)[part];
  }
  return cursor;
}

describe("walkthrough i18n coverage", () => {
  const keys = [...usedKeys()].sort();

  it("reads at least the keys the module is known to use", () => {
    // Guards the scraper itself: a regex that silently matched nothing would
    // make every assertion below vacuously true.
    expect(keys.length).toBeGreaterThan(20);
  });

  it.each([
    ["en", en],
    ["pt-BR", ptBR],
  ])("resolves every key in %s", (_locale, catalogue) => {
    const missing = keys.filter((key) => typeof resolve(catalogue, key) !== "string");
    expect(missing).toEqual([]);
  });

  it("carries no inline English fallback alongside a key", () => {
    // `t("walkthrough.x", "Some English")` renders the fallback when the key is
    // missing, which is exactly the failure this suite exists to surface.
    const offenders: string[] = [];
    for (const file of sourceFiles(MODULE_DIR)) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(
        /t\(\s*["']walkthrough\.[A-Za-z0-9_.]+["']\s*,\s*["']/g,
      )) {
        offenders.push(`${file.slice(MODULE_DIR.length + 1)}: ${match[0].trim()}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
