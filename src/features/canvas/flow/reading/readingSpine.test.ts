import { describe, expect, it } from "vitest";
import type { Flow, FlowStep } from "@/features/diagram";
import { buildReadingSpine } from "./readingSpine";

/**
 * The spine is the rail's only progress indicator, which is why it describes
 * the reading rather than the script: what was walked, what is in hand, and
 * only as much of what is ahead as anyone can honestly promise.
 */

function flow(steps: Record<string, FlowStep>, entryStepId = "s1"): Flow {
  return { id: "f1", name: "Checkout", mermaid: "", diagramId: "d1", entryStepId, steps };
}

const heading = (step: FlowStep) => step.title ?? step.conditionLabel ?? step.id;

const LINEAR = flow({
  s1: { id: "s1", type: "action", title: "Cliente abre o checkout", next: "s2" },
  s2: { id: "s2", type: "action", title: "Gateway valida o token", next: "s3" },
  s3: { id: "s3", type: "action", title: "Consulta de risco", next: "s4" },
  s4: { id: "s4", type: "action", title: "Cobrança" },
});

const FORKED = flow({
  s1: { id: "s1", type: "action", title: "Cliente abre o checkout", next: "c" },
  c: {
    id: "c",
    type: "condition",
    conditionLabel: "Cartão aprovado?",
    branches: [
      { label: "Aprovado", nextId: "a1" },
      { label: "Recusado", nextId: "b1" },
    ],
  },
  a1: { id: "a1", type: "action", title: "Grava o pedido", next: "a2" },
  a2: { id: "a2", type: "action", title: "Publica o evento" },
  b1: { id: "b1", type: "action", title: "Devolve 402" },
});

describe("the spine tells the reading apart from the script", () => {
  it("lists what was walked, in the order it was walked", () => {
    const spine = buildReadingSpine(LINEAR, "s3", ["s1", "s2"], heading);

    expect(spine.past.map((row) => row.heading)).toEqual([
      "Cliente abre o checkout",
      "Gateway valida o token",
    ]);
  });

  it("puts the step in hand on its own", () => {
    const spine = buildReadingSpine(LINEAR, "s3", ["s1", "s2"], heading);

    expect(spine.current?.stepId).toBe("s3");
  });

  it("runs the rest of the path out ahead of the reader", () => {
    const spine = buildReadingSpine(LINEAR, "s2", ["s1"], heading);

    expect(spine.upcoming.map((row) => row.stepId)).toEqual(["s3", "s4"]);
  });

  it("numbers the rows from the graph rather than from the reading", () => {
    const spine = buildReadingSpine(LINEAR, "s3", ["s1", "s2"], heading);

    expect(spine.current?.number).toBe("3");
    expect(spine.past.map((row) => row.number)).toEqual(["1", "2"]);
  });

  it("keeps the branch numbering the script panel uses", () => {
    const spine = buildReadingSpine(FORKED, "a1", ["s1", "c"], heading);

    expect(spine.current?.number).toBe("2a");
  });

  it("has nothing in hand when the reading points at a step the script lost", () => {
    const spine = buildReadingSpine(LINEAR, "vanished", [], heading);

    expect(spine.current).toBeNull();
  });

  it("drops a walked step the script no longer holds rather than showing a blank row", () => {
    const spine = buildReadingSpine(LINEAR, "s3", ["s1", "vanished", "s2"], heading);

    expect(spine.past.map((row) => row.stepId)).toEqual(["s1", "s2"]);
  });
});

describe("the spine stops where the reading stops being predictable", () => {
  it("runs ahead only as far as the choice", () => {
    const spine = buildReadingSpine(FORKED, "s1", [], heading);

    expect(spine.upcoming.map((row) => row.stepId)).toEqual(["c"]);
  });

  it("marks the row that opens the choice, and says how many ways out it has", () => {
    const spine = buildReadingSpine(FORKED, "s1", [], heading);

    expect(spine.upcoming[0]).toMatchObject({ isCondition: true, exits: 2 });
  });

  it("summarises the branches waiting at the end of what it shows", () => {
    const spine = buildReadingSpine(FORKED, "s1", [], heading);

    expect(spine.branches.map((branch) => branch.label)).toEqual(["Aprovado", "Recusado"]);
  });

  it("offers the same branches directly when the choice is the step in hand", () => {
    const spine = buildReadingSpine(FORKED, "c", ["s1"], heading);

    expect(spine.upcoming).toEqual([]);
    expect(spine.branches.map((branch) => branch.label)).toEqual(["Aprovado", "Recusado"]);
  });

  it("counts everything a branch holds, not only its first step", () => {
    const spine = buildReadingSpine(FORKED, "c", ["s1"], heading);

    expect(spine.branches.map((branch) => branch.stepCount)).toEqual([2, 1]);
  });

  it("leads each branch with where it goes, not only how far", () => {
    const spine = buildReadingSpine(FORKED, "c", ["s1"], heading);

    expect(spine.branches.map((branch) => branch.lead)).toEqual(["Grava o pedido", "Devolve 402"]);
  });

  it("gives each branch the color the canvas gives it", () => {
    const spine = buildReadingSpine(FORKED, "c", ["s1"], heading);

    expect(spine.branches.map((branch) => branch.color)).toEqual(["#06b6d4", "#f59e0b"]);
  });

  it("has no branches to offer on a script with nothing to choose", () => {
    const spine = buildReadingSpine(LINEAR, "s1", [], heading);

    expect(spine.branches).toEqual([]);
  });

  it("stops rather than walking a loop forever", () => {
    const looped = flow({
      s1: { id: "s1", type: "action", title: "one", next: "s2" },
      s2: { id: "s2", type: "action", title: "two", next: "s1" },
    });

    const spine = buildReadingSpine(looped, "s1", [], heading);

    expect(spine.upcoming.map((row) => row.stepId)).toEqual(["s2"]);
  });

  it("does not list a step ahead that the reading has already been through", () => {
    const looped = flow({
      s1: { id: "s1", type: "action", title: "one", next: "s2" },
      s2: { id: "s2", type: "action", title: "two", next: "s1" },
    });

    const spine = buildReadingSpine(looped, "s2", ["s1"], heading);

    expect(spine.upcoming).toEqual([]);
  });
});
