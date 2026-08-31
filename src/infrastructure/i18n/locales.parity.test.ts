import { describe, expect, it } from "vitest";
import en from "./locales/en.json";
import ptBR from "./locales/pt-BR.json";

/**
 * pt-BR is the fallback language, so a key missing from `en` degrades silently
 * into Portuguese for an English user, and a key missing from pt-BR renders as
 * the raw dotted key. Neither shows up in a unit test of the feature that added
 * the key — only in the running app, in the other language.
 */
function flattenKeys(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return [prefix];
  }
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    flattenKeys(child, prefix ? `${prefix}.${key}` : key),
  );
}

const enKeys = flattenKeys(en);
const ptKeys = flattenKeys(ptBR);

describe("locale parity", () => {
  it("every en key exists in pt-BR", () => {
    const missing = enKeys.filter((key) => !ptKeys.includes(key));
    expect(missing, `missing from pt-BR: ${missing.join(", ")}`).toEqual([]);
  });

  it("every pt-BR key exists in en", () => {
    const missing = ptKeys.filter((key) => !enKeys.includes(key));
    expect(missing, `missing from en: ${missing.join(", ")}`).toEqual([]);
  });

  it("carries the generation truncation strings in both locales", () => {
    // Named explicitly: the parity checks above pass just as happily when the
    // key is absent from both files.
    for (const key of ["llmChat.ir.truncated", "llmChat.ir.issue.responseTruncated"]) {
      expect(enKeys, `en is missing ${key}`).toContain(key);
      expect(ptKeys, `pt-BR is missing ${key}`).toContain(key);
    }
  });
});
