import { describe, expect, it } from "vitest";
import type { Flow, FlowStep } from "@/features/diagram";
import { buildReadingSpine } from "./readingSpine";

/**
 * What the spine adds once the calls are paired.
 *
 * The rows are the same rows; each now says how deep in open calls it sits and
 * which calls end just before it. A script that declares no directions comes
 * back exactly as it did before any of this existed, and that is the case with
 * the most to lose, so it is asserted rather than assumed.
 */

function flow(steps: Record<string, Partial<FlowStep>>, entryStepId = "s1"): Flow {
  const built: Record<string, FlowStep> = {};
  for (const [id, step] of Object.entries(steps)) {
    built[id] = { id, type: "action", ...step } as FlowStep;
  }
  return { id: "f1", name: "Checkout", mermaid: "", diagramId: "d1", entryStepId, steps: built };
}

const heading = (step: FlowStep) => step.title ?? step.id;

/** The three-level checkout the design's depth rule is stated against. */
const CHECKOUT = flow({
  s1: { connectionId: "c1", payloadDirection: "request", title: "POST /checkout", next: "s2" },
  s2: { connectionId: "c2", payloadDirection: "request", title: "cobrar(pedido)", next: "s3" },
  s3: { connectionId: "c3", payloadDirection: "request", title: "POST /score", next: "s4" },
  s4: { connectionId: "c3", payloadDirection: "response", title: "score 0.12", next: "s5" },
  s5: { connectionId: "c4", payloadDirection: "request", title: "authorize", next: "s7" },
  s7: { connectionId: "c2", payloadDirection: "response", title: "pago", next: "s8" },
  s8: {
    connectionId: "c5",
    payloadDirection: "request",
    isAsync: true,
    title: "reservar estoque",
    next: "s9",
  },
  s9: { connectionId: "c1", payloadDirection: "response", title: "201 Created" },
});

/** Every row of one reading, in order, whichever section it landed in. */
function allRows(flowToRead: Flow, currentStepId: string, history: string[]) {
  const spine = buildReadingSpine(flowToRead, currentStepId, history, heading);
  return [...spine.past, ...(spine.current ? [spine.current] : []), ...spine.upcoming];
}

describe("the spine says how deep each row sits", () => {
  it("carries the depth of a three-level script onto its rows", () => {
    const rows = allRows(CHECKOUT, "s1", []);

    expect(Object.fromEntries(rows.map((row) => [row.stepId, row.callDepth]))).toEqual({
      s1: 0,
      s2: 1,
      s3: 2,
      s4: 2,
      s5: 2,
      s7: 1,
      s8: 1,
      s9: 0,
    });
  });

  it("marks which rows open and close a call", () => {
    const rows = allRows(CHECKOUT, "s1", []);
    const byId = Object.fromEntries(rows.map((row) => [row.stepId, row]));

    expect(byId.s2).toMatchObject({ opensFrame: true, closesFrame: false });
    expect(byId.s4).toMatchObject({ opensFrame: false, closesFrame: true });
  });

  it("carries the depth into rows already walked", () => {
    const spine = buildReadingSpine(CHECKOUT, "s3", ["s1", "s2"], heading);

    expect(spine.past.map((row) => row.callDepth)).toEqual([0, 1]);
    expect(spine.current?.callDepth).toBe(2);
  });
});

describe("a call that ends without a step to say so gets a row of its own", () => {
  it("hangs the return off the row it precedes, naming the connection that ends", () => {
    const rows = allRows(CHECKOUT, "s1", []);
    const paid = rows.find((row) => row.stepId === "s7")!;

    expect(paid.returnsBefore).toEqual([{ frameId: "s5", callDepth: 2, connectionId: "c4" }]);
  });

  it("adds no return where the author wrote the response", () => {
    const rows = allRows(CHECKOUT, "s1", []);

    expect(rows.find((row) => row.stepId === "s4")!.returnsBefore).toBeUndefined();
    expect(rows.find((row) => row.stepId === "s9")!.returnsBefore).toBeUndefined();
  });

  it("leaves the flow's own steps untouched", () => {
    const before = JSON.stringify(CHECKOUT.steps);

    buildReadingSpine(CHECKOUT, "s5", ["s1", "s2", "s3", "s4"], heading);

    expect(JSON.stringify(CHECKOUT.steps)).toBe(before);
    expect(Object.keys(CHECKOUT.steps)).toHaveLength(8);
  });
});

describe("a script with no directions is the script it always was", () => {
  it("puts every row at depth zero with nothing owed", () => {
    const flat = flow({
      s1: { title: "Cliente cola a URL", componentId: "a", next: "s2" },
      s2: { title: "Gera o slug", connectionId: "c1", next: "s3" },
      s3: { title: "Devolve o link", componentId: "b" },
    });

    const rows = allRows(flat, "s1", []);

    expect(rows.map((row) => row.callDepth)).toEqual([0, 0, 0]);
    expect(rows.every((row) => !row.opensFrame && !row.closesFrame)).toBe(true);
    expect(rows.every((row) => row.returnsBefore === undefined)).toBe(true);
  });
});
