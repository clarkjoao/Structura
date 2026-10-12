import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import en from "@/infrastructure/i18n/locales/en.json";
import ptBR from "@/infrastructure/i18n/locales/pt-BR.json";

/**
 * The chat used to ship `t(key, { defaultValue: "English" })` calls whose keys
 * existed in neither locale, so pt-BR users read English. These checks pin the
 * keys the chat actually uses to both locale files.
 */
const LLM_DIR = resolve(__dirname);
const COMPONENTS_DIR = join(LLM_DIR, "components");
const CANVAS_CHAT_DIR = resolve(__dirname, "../canvas/chat");

function flattenKeys(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return [prefix];
  }
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    flattenKeys(child, prefix ? `${prefix}.${key}` : key),
  );
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      return entry === "ir" ? [] : sourceFiles(full);
    }
    return /\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry) ? [full] : [];
  });
}

const enKeys = new Set(flattenKeys(en));
const ptKeys = new Set(flattenKeys(ptBR));

function hasKey(keys: Set<string>, key: string): boolean {
  // i18next plural forms: `key` resolves through `key_one` / `key_other`.
  return keys.has(key) || (keys.has(`${key}_one`) && keys.has(`${key}_other`));
}

describe("llmChat i18n", () => {
  it("every llmChat key exists in both locales", () => {
    const enChat = [...enKeys].filter((key) => key.startsWith("llmChat."));
    const ptChat = [...ptKeys].filter((key) => key.startsWith("llmChat."));
    expect(enChat.filter((key) => !ptKeys.has(key))).toEqual([]);
    expect(ptChat.filter((key) => !enKeys.has(key))).toEqual([]);
  });

  it("every literal llmChat key used by the chat exists in both locales", () => {
    const files = [...sourceFiles(LLM_DIR), ...sourceFiles(CANVAS_CHAT_DIR)];
    const missing: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(/\bt\(\s*"(llmChat\.[A-Za-z0-9_.]+)"/g)) {
        const key = match[1];
        if (!hasKey(enKeys, key) || !hasKey(ptKeys, key)) {
          missing.push(`${file}: ${key}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it("no defaultValue fallbacks remain in the chat components", () => {
    const offenders = sourceFiles(COMPONENTS_DIR).filter((file) =>
      readFileSync(file, "utf8").includes("defaultValue:"),
    );
    expect(offenders).toEqual([]);
  });
});
