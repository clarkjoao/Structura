import { describe, expect, it } from "vitest";
import type { Flow, FlowStep } from "../model/flow.types";
import { conditionKindOf, isParallelStep, parseConditionKind } from "./flow-condition-kind";
import { migrateFlow } from "./flow-migration";
import { stepsToMermaid } from "./flow-mermaid";

/**
 * What a branch point is, said in a field instead of a magic string.
 *
 * The keyword used to live in `conditionLabel`: the Mermaid importer wrote
 * `par` there, which destroyed whatever the block was called, and the exporter
 * sniffed the label back out to decide what to emit. Anything that was not one
 * of six words silently became `alt`. So a condition could be a loop only by
 * being named "loop", and nothing in the model said the ways out of a `par` all
 * happen rather than one being chosen.
 */

const condition = (over: Partial<FlowStep> = {}): FlowStep => ({
  id: "c1",
  type: "condition",
  branches: [
    { label: "a", nextId: "s1" },
    { label: "b", nextId: "s2" },
  ],
  ...over,
});

describe("the kind a branch point is", () => {
  it("is a choice for a condition that never said otherwise", () => {
    expect(conditionKindOf(condition())).toBe("alt");
  });

  it("is whatever the step declares", () => {
    expect(conditionKindOf(condition({ conditionKind: "par" }))).toBe("par");
  });

  it("is not read off the label any more", () => {
    expect(conditionKindOf(condition({ conditionLabel: "loop" }))).toBe("alt");
  });
});

describe("whether the ways out all happen", () => {
  it("is true only of a parallel branch point", () => {
    expect(isParallelStep(condition({ conditionKind: "par" }))).toBe(true);
    expect(isParallelStep(condition({ conditionKind: "alt" }))).toBe(false);
    expect(isParallelStep(condition())).toBe(false);
  });

  it("is false for a step that carries the kind but forks nowhere", () => {
    const orphan: FlowStep = { id: "s1", type: "action", conditionKind: "par" };

    expect(isParallelStep(orphan)).toBe(false);
  });
});

describe("naming a kind from text", () => {
  it("accepts each keyword, however it is cased or padded", () => {
    expect(parseConditionKind("par")).toBe("par");
    expect(parseConditionKind(" LOOP ")).toBe("loop");
  });

  it("names none for a question, which is what a label usually is", () => {
    expect(parseConditionKind("Cache hit?")).toBeUndefined();
    expect(parseConditionKind(undefined)).toBeUndefined();
    expect(parseConditionKind("")).toBeUndefined();
  });
});

describe("a flow saved before the field existed", () => {
  const flowWith = (steps: Record<string, FlowStep>): Flow => ({
    id: "f1",
    name: "Upload",
    mermaid: "",
    diagramId: "d1",
    entryStepId: "c1",
    steps,
  });

  it("moves a keyword out of the label it was hiding in", () => {
    const migrated = migrateFlow(flowWith({ c1: condition({ conditionLabel: "par" }) }));

    expect(migrated.steps.c1!.conditionKind).toBe("par");
    expect(migrated.steps.c1!.conditionLabel).toBeUndefined();
  });

  it("leaves a real question exactly where the author wrote it", () => {
    const migrated = migrateFlow(flowWith({ c1: condition({ conditionLabel: "Cache hit?" }) }));

    expect(migrated.steps.c1!.conditionKind).toBeUndefined();
    expect(migrated.steps.c1!.conditionLabel).toBe("Cache hit?");
  });

  it("keeps a kind that is already there, whatever the label says", () => {
    const migrated = migrateFlow(
      flowWith({ c1: condition({ conditionKind: "alt", conditionLabel: "loop" }) }),
    );

    expect(migrated.steps.c1!.conditionKind).toBe("alt");
    expect(migrated.steps.c1!.conditionLabel).toBe("loop");
  });

  it("reads the same after migrating twice, since it runs on every load", () => {
    const once = migrateFlow(flowWith({ c1: condition({ conditionLabel: "loop" }) }));
    const twice = migrateFlow(structuredClone(once));

    expect(twice).toEqual(once);
  });

  it("still exports the block it always exported", () => {
    const migrated = migrateFlow(
      flowWith({
        c1: condition({ conditionLabel: "loop", branches: [{ label: "chunks", nextId: "s1" }] }),
        s1: { id: "s1", type: "action", componentId: "app", note: "envia" },
      }),
    );

    const mermaid = stepsToMermaid(
      migrated,
      { app: { id: "app", name: "App", type: "system", description: "", parentId: null } },
      {},
    );

    expect(mermaid).toContain("loop chunks");
  });
});
