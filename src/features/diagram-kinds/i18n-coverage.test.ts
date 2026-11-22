import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import en from "@/infrastructure/i18n/locales/en.json";
import ptBR from "@/infrastructure/i18n/locales/pt-BR.json";

/**
 * Every `diagramKinds.*` key the kind modules and their UI name exists in both
 * shipped locales, including the ones built from a code (`issues.${code}`).
 */

const SRC = path.resolve(__dirname, "../..");
const FILES = [
  "features/diagram-kinds",
  "features/canvas/chrome/KindModeBar.tsx",
  "features/canvas/chrome/KindTextPanel.tsx",
  "features/canvas/chrome/kindTextCapture.ts",
  "features/canvas/hooks/useCanvasMediaPaste.ts",
  "features/canvas/panels/ElementPanel/components/KindInspectorTab.tsx",
  "features/canvas/catalog/CanvasBottomToolbar.tsx",
  "features/canvas/flow/FlowPanel.tsx",
  "components/ShortcutsModal.tsx",
  "pages/dashboard/AddDiagramDialog.tsx",
].map((p) => path.join(SRC, p));

function sources(target: string): string[] {
  const stat = fs.statSync(target);
  if (stat.isFile()) return [target];
  return fs.readdirSync(target, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(target, entry.name);
    if (entry.isDirectory()) return sources(full);
    if (!/\.(ts|tsx)$/.test(entry.name) || /\.test\.tsx?$/.test(entry.name)) return [];
    return [full];
  });
}

function lookup(bundle: unknown, key: string): unknown {
  return key.split(".").reduce<unknown>((node, segment) => {
    if (typeof node !== "object" || node === null) return undefined;
    return (node as Record<string, unknown>)[segment];
  }, bundle);
}

const DYNAMIC: Record<string, readonly string[]> = {
  "diagramKinds.guided.issues": [
    "noLane",
    "unknownElement",
    "nestedLane",
    "outsideLane",
    "notAStep",
    "noStart",
    "extraStart",
    "connectionNotBetweenSteps",
  ],
  "diagramKinds.guided.refused": [
    "selectOneStep",
    "endHasNoNext",
    "keepStart",
    "keepLastLane",
    "outlineClosesPath",
    "oneStart",
  ],
  "diagramKinds.guided.stepKinds": [
    "rectangle",
    "start",
    "end",
    "event",
    "diamond",
    "subroutine",
    "cylinder",
    "document",
  ],
  "diagramKinds.guided.outline.errors": [
    "exitOutsideDecision",
    "exitExpected",
    "decisionWithoutExits",
    "exitWithoutTarget",
    "indentUnderStep",
    "emptyName",
    "unreachableLine",
    "unknownJump",
    "ambiguousJump",
    "mermaidUnclosedSubgraph",
    "mermaidStrayEnd",
    "mermaidUnreadable",
    "mermaidTaskWithoutScore",
    "mermaidScoreOutOfRange",
    "mermaidEmpty",
    "experienceOutOfRange",
  ],
};

/** A key, or its plural forms (`_one` / `_other`, as i18next resolves a `count`). */
const has = (bundle: unknown, key: string) =>
  typeof lookup(bundle, key) === "string" ||
  (typeof lookup(bundle, `${key}_one`) === "string" &&
    typeof lookup(bundle, `${key}_other`) === "string");

describe("diagram kind locale coverage", () => {
  it("has every key in en and pt-BR", () => {
    const keys = new Set<string>();
    for (const file of FILES.flatMap(sources)) {
      const text = fs.readFileSync(file, "utf8");
      for (const match of text.matchAll(/["'`](diagramKinds\.[A-Za-z0-9_.]+)["'`]/g))
        keys.add(match[1]!);
    }
    for (const [prefix, codes] of Object.entries(DYNAMIC)) {
      for (const code of codes) keys.add(`${prefix}.${code}`);
    }
    expect(keys.size).toBeGreaterThan(30);
    const missing = [...keys].flatMap((key) =>
      [
        ["en", en],
        ["pt-BR", ptBR],
      ].flatMap(([locale, bundle]) => (has(bundle, key) ? [] : [`${String(locale)}: ${key}`])),
    );
    expect(missing).toEqual([]);
  });
});
