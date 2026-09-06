import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { FlowStep } from "./flow.types";

/**
 * Every optional field of a step, and the code that puts it there.
 *
 * Three times over this feature a piece was built before anything produced the
 * data it reads. `context` shipped with a derivation, a panel and a fold, and
 * no editor. `payloadDirection` was paired by the reading months before the
 * recorder wrote one, so every script recorded in the app read as flat. And a
 * thread already read was marked from `history`, which `goBack` shortens, so
 * the mark never once appeared in the running editor. Each was found by hand,
 * late, and each had green unit tests the whole time — testing the piece is no
 * proof that anything reaches it.
 *
 * So the table below is the claim, and TypeScript is what enforces it: adding
 * an optional field to `FlowStep` breaks this file until someone names where it
 * is written and where it is read. The runtime check is deliberately weak — the
 * file exists and mentions the field — because the point is not to verify the
 * path automatically. It is to make skipping the question impossible.
 */

type OptionalKeys<T> = {
  [K in keyof T]-?: Record<string, never> extends Pick<T, K> ? K : never;
}[keyof T];

interface FieldProvenance {
  /** Where a value for this field comes from — authoring, recording, import. */
  producers: string[];
  /** What the product does with it once it is there. */
  consumers: string[];
  /**
   * Set when the field exists only so an import can be exported unchanged, and
   * nothing in the product reads it. Legitimate, and worth having to say out
   * loud rather than leaving as an absence.
   */
  roundTripOnly?: string;
}

const S = "src/features";
const DIAGRAM = `${S}/diagram/utils`;
const READING = `${S}/canvas/flow/reading`;
const SCRIPT = `${S}/canvas/flow/script`;

const PROVENANCE: Record<OptionalKeys<FlowStep>, FieldProvenance> = {
  next: {
    producers: [`${DIAGRAM}/flow-edit.ts`],
    consumers: [`${DIAGRAM}/flow-traversal.ts`],
  },
  branches: {
    producers: [`${DIAGRAM}/flow-condition.ts`],
    consumers: [`${DIAGRAM}/flow-outline.ts`],
  },
  title: {
    producers: [`${SCRIPT}/FlowScriptRow.tsx`],
    consumers: [`${READING}/readingScene.ts`],
  },
  componentId: {
    producers: [`${S}/canvas/flow/useFlowRecording.ts`],
    consumers: [`${READING}/readingScene.ts`],
  },
  connectionId: {
    producers: [`${S}/canvas/flow/useFlowRecording.ts`],
    consumers: [`${DIAGRAM}/flow-call-stack.ts`],
  },
  description: {
    producers: [`${SCRIPT}/FlowScriptRow.tsx`],
    consumers: [`${READING}/FlowReadingScene.tsx`],
  },
  note: {
    producers: [`${SCRIPT}/FlowScriptRow.tsx`],
    consumers: [`${READING}/FlowReadingScene.tsx`],
  },
  handleId: {
    producers: [`${S}/canvas/flow/useFlowRecording.ts`],
    consumers: [`${S}/canvas/flow/flowState.ts`],
  },
  duration: {
    producers: [`${SCRIPT}/FlowScriptRow.tsx`],
    consumers: [`${READING}/FlowReadingScene.tsx`],
  },
  payload: {
    producers: [`${SCRIPT}/FlowScriptRow.tsx`],
    consumers: [`${READING}/readingVariables.ts`],
  },
  payloadDirection: {
    producers: [`${S}/canvas/flow/useFlowRecording.ts`, `${DIAGRAM}/import-mermaid-sequence.ts`],
    consumers: [`${DIAGRAM}/flow-call-stack.ts`],
  },
  isAsync: {
    producers: [`${SCRIPT}/FlowScriptRow.tsx`],
    consumers: [`${DIAGRAM}/flow-call-stack.ts`],
  },
  connectionIntent: {
    producers: [`${DIAGRAM}/import-mermaid-sequence.ts`],
    consumers: [`${DIAGRAM}/flow-mermaid.ts`],
    roundTripOnly:
      "Written by the Mermaid importer and read only by the Mermaid exporter, so an " +
      "imported arrow comes back out as the arrow it went in as. Nothing in the reading " +
      "or the script panel shows it, and no author can set it.",
  },
  context: {
    producers: [`${SCRIPT}/StepContextEditor.tsx`],
    consumers: [`${READING}/readingVariables.ts`],
  },
  conditionLabel: {
    producers: [`${SCRIPT}/FlowScriptRow.tsx`],
    consumers: [`${READING}/readingScene.ts`],
  },
  conditionKind: {
    producers: [`${SCRIPT}/FlowScriptRow.tsx`, `${DIAGRAM}/import-mermaid-sequence.ts`],
    consumers: [`${DIAGRAM}/flow-condition-kind.ts`],
  },
};

const entries = Object.entries(PROVENANCE) as [string, FieldProvenance][];

/** Loose on purpose: the table is the claim, this only catches a stale path. */
function mentions(path: string, field: string): boolean {
  if (!existsSync(path)) return false;
  return new RegExp(`\\b${field}\\b`).test(readFileSync(path, "utf8"));
}

describe("every optional field of a step has a way in and a reason to exist", () => {
  it("covers the whole model, which is what the type above enforces", () => {
    expect(entries.length).toBeGreaterThan(10);
  });

  it("names a producer that exists and mentions the field", () => {
    const broken = entries.flatMap(([field, { producers }]) =>
      producers.filter((path) => !mentions(path, field)).map((path) => `${field}: ${path}`),
    );
    expect(broken).toEqual([]);
  });

  it("names a consumer that exists and mentions the field", () => {
    const broken = entries.flatMap(([field, { consumers }]) =>
      consumers.filter((path) => !mentions(path, field)).map((path) => `${field}: ${path}`),
    );
    expect(broken).toEqual([]);
  });

  it("gives every field at least one of each", () => {
    const empty = entries
      .filter(([, entry]) => entry.producers.length === 0 || entry.consumers.length === 0)
      .map(([field]) => field);
    expect(empty).toEqual([]);
  });

  it("keeps the list of round-trip-only fields down to the one we know about", () => {
    const roundTrip = entries.filter(([, entry]) => entry.roundTripOnly).map(([field]) => field);
    expect(roundTrip).toEqual(["connectionIntent"]);
  });
});
