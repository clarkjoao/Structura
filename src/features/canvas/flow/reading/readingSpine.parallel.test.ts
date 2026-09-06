import { describe, expect, it } from "vitest";
import type { Flow, FlowStep } from "@/features/diagram";
import { buildReadingSpine } from "./readingSpine";

/**
 * A fork in the road and a fork into threads are different facts.
 *
 * The spine carried neither: every branch point was a question, so the rail
 * drew `◇` and asked the reader to choose even where all the ways out happen.
 * The kind now travels on the row, and which threads have already been read
 * travels on the branch — a reader inside one thread of a `par` still needs to
 * see that the others ran.
 */

function flow(steps: Record<string, FlowStep>, entryStepId = "s1"): Flow {
  return { id: "f1", name: "Upload", mermaid: "", diagramId: "d1", entryStepId, steps };
}

const heading = (step: FlowStep) => step.title ?? step.conditionLabel ?? step.id;

const branches = [
  { label: "Notificações", nextId: "a1" },
  { label: "Métricas", nextId: "b1" },
];

const FORK = (kind: FlowStep["conditionKind"]) =>
  flow({
    s1: { id: "s1", type: "action", title: "Enfileira o vídeo", next: "c" },
    c: { id: "c", type: "condition", conditionKind: kind, branches },
    a1: { id: "a1", type: "action", title: "Envia o e-mail" },
    b1: { id: "b1", type: "action", title: "Registra a métrica" },
  });

describe("the spine says what kind of branch point a row is", () => {
  it("carries the kind on a condition row", () => {
    const spine = buildReadingSpine(FORK("par"), "s1", [], heading);

    expect(spine.upcoming[0]?.conditionKind).toBe("par");
  });

  it("calls a condition that never said otherwise a choice", () => {
    const spine = buildReadingSpine(FORK(undefined), "s1", [], heading);

    expect(spine.upcoming[0]?.conditionKind).toBe("alt");
  });

  it("says nothing about a row that is not a branch point at all", () => {
    const spine = buildReadingSpine(FORK("par"), "s1", [], heading);

    expect(spine.current?.conditionKind).toBeUndefined();
    expect(spine.current?.isCondition).toBe(false);
  });
});

describe("which ways out the reading has already been down", () => {
  it("marks none before the reader has taken any", () => {
    const spine = buildReadingSpine(FORK("par"), "c", ["s1"], heading);

    expect(spine.branches.map((branch) => branch.visited)).toEqual([false, false]);
  });

  it("marks the one the reading entered, and only that one", () => {
    const spine = buildReadingSpine(FORK("par"), "c", ["s1", "c", "a1"], heading);

    expect(spine.branches.map((branch) => branch.visited)).toEqual([true, false]);
  });

  it("marks both once the reader has been through both threads", () => {
    const spine = buildReadingSpine(FORK("par"), "c", ["s1", "c", "a1", "c", "b1"], heading);

    expect(spine.branches.map((branch) => branch.visited)).toEqual([true, true]);
  });
});
