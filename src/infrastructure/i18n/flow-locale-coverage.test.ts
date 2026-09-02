import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import en from "./locales/en.json";
import ptBR from "./locales/pt-BR.json";

/**
 * The flow UI used to reach for keys that existed in neither locale, hidden
 * behind inline defaults written in a mix of English and Portuguese: the
 * string on screen looked deliberate, so nothing said the translation was
 * missing. These three checks are what stops that coming back.
 */

const FLOW_NAMESPACES = [
  "flowScript",
  "flowRefusal",
  "flowSew",
  "flowRecorder",
  "brokenFlow",
  "flowStepNav",
] as const;
const FLOW_DIRS = ["src/features/canvas/flow"];

function flatten(value: Record<string, unknown>, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, child] of Object.entries(value)) {
    const path = `${prefix}${key}`;
    if (child !== null && typeof child === "object") {
      Object.assign(out, flatten(child as Record<string, unknown>, `${path}.`));
    } else {
      out[path] = String(child);
    }
  }
  return out;
}

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      out.push(...sourceFiles(path));
      continue;
    }
    if (!/\.tsx?$/.test(entry) || /\.test\.tsx?$/.test(entry)) continue;
    out.push(path);
  }
  return out;
}

const files = FLOW_DIRS.flatMap(sourceFiles);
const sources = files.map((path) => readFileSync(path, "utf8"));

/** Keys named as plain literals; a key built from a value is checked by its own map. */
function keysUsed(): Set<string> {
  const pattern = new RegExp(
    `["'\`]((?:${FLOW_NAMESPACES.join("|")})\\.[A-Za-z0-9_.]+)["'\`]`,
    "g",
  );
  const used = new Set<string>();
  for (const source of sources) {
    for (const match of source.matchAll(pattern)) used.add(match[1]!);
  }
  return used;
}

/** i18next resolves `key` through `key_one` / `key_other` when it is a count. */
function has(locale: Record<string, string>, key: string): boolean {
  if (key in locale) return true;
  return Object.keys(locale).some((candidate) => candidate.replace(/_\w+$/, "") === key);
}

describe("the flow UI's strings are translated in both locales", () => {
  const flatEn = flatten(en as Record<string, unknown>);
  const flatPt = flatten(ptBR as Record<string, unknown>);

  it("reads keys from the flow feature at all", () => {
    expect(files.length).toBeGreaterThan(5);
    expect(keysUsed().size).toBeGreaterThan(20);
  });

  it("defines every key the flow UI asks for, in both locales", () => {
    const missingEn = [...keysUsed()].filter((key) => !has(flatEn, key)).sort();
    const missingPt = [...keysUsed()].filter((key) => !has(flatPt, key)).sort();
    expect({ missingEn, missingPt }).toEqual({ missingEn: [], missingPt: [] });
  });

  it("keeps the two locales on the same set of flow keys", () => {
    for (const namespace of FLOW_NAMESPACES) {
      const inEn = Object.keys(flatEn).filter((key) => key.startsWith(`${namespace}.`));
      const inPt = Object.keys(flatPt).filter((key) => key.startsWith(`${namespace}.`));
      expect({ namespace, keys: inPt.sort() }).toEqual({ namespace, keys: inEn.sort() });
    }
  });

  it("has no inline default standing in for a missing translation", () => {
    const withDefault = /\bt\(\s*["'`][^"'`]+["'`]\s*,\s*(?:["'`]|\{[^}]*defaultValue)/;
    const offenders = files.filter((_, index) => withDefault.test(sources[index]!));
    expect(offenders).toEqual([]);
  });
});
