import { describe, expect, it } from "vitest";
import type { Flow } from "../model/flow.types";
import { parseMermaidSequence } from "./import-mermaid-sequence";
import { buildFlowOutline } from "./flow-outline";
import { buildCallStack } from "./flow-call-stack";

/**
 * An imported sequence has to arrive readable as calls, not only as steps.
 *
 * Mermaid already draws the distinction — `->>` goes out, `-->>` comes back —
 * and the importer already reuses the reversed connection for the way back. It
 * simply never wrote the outward half down, so every imported response was an
 * answer to a call nobody had made and the reading came out flat.
 */

const CHECKOUT = [
  "sequenceDiagram",
  "participant Cliente",
  "participant API",
  "participant Pagamentos",
  "participant Antifraude",
  "Cliente->>API: POST /checkout",
  "API->>Pagamentos: cobrar(pedido)",
  "Pagamentos->>Antifraude: POST /score",
  "Antifraude-->>Pagamentos: score 0.12",
  "Pagamentos-->>API: pago",
  "API-->>Cliente: 201 Created",
].join("\n");

function imported(text: string): Flow {
  const plan = parseMermaidSequence(text, {}, {}, { x: 0, y: 0 });
  expect(plan.errors).toEqual([]);
  return {
    id: "f1",
    name: "Imported",
    mermaid: text,
    diagramId: "d1",
    entryStepId: plan.entryStepId,
    steps: plan.steps,
  };
}

/** Steps in reading order, so expectations can be written as sequences. */
function ordered(flow: Flow): string[] {
  return buildFlowOutline(flow).rows.map((row) => row.stepId);
}

describe("an imported sequence says which way each message travels", () => {
  it("marks the outward messages as requests", () => {
    const flow = imported(CHECKOUT);
    const order = ordered(flow);

    expect(order.slice(0, 3).map((id) => flow.steps[id]!.payloadDirection)).toEqual([
      "request",
      "request",
      "request",
    ]);
  });

  it("still marks the messages that come back as responses", () => {
    const flow = imported(CHECKOUT);
    const order = ordered(flow);

    expect(order.slice(3).map((id) => flow.steps[id]!.payloadDirection)).toEqual([
      "response",
      "response",
      "response",
    ]);
  });

  it("puts each answer on the connection its call went out over", () => {
    const flow = imported(CHECKOUT);
    const order = ordered(flow);

    // The third call and the first answer are the same conversation.
    expect(flow.steps[order[2]!]!.connectionId).toBe(flow.steps[order[3]!]!.connectionId);
    expect(flow.steps[order[1]!]!.connectionId).toBe(flow.steps[order[4]!]!.connectionId);
    expect(flow.steps[order[0]!]!.connectionId).toBe(flow.steps[order[5]!]!.connectionId);
  });
});

describe("an imported sequence reads as the nested calls it describes", () => {
  it("nests three levels deep and comes back out", () => {
    const flow = imported(CHECKOUT);
    const stack = buildCallStack(flow, buildFlowOutline(flow));

    expect(ordered(flow).map((id) => stack.byStep.get(id)!.callDepth)).toEqual([0, 1, 2, 2, 1, 0]);
  });

  it("leaves no answer without a call", () => {
    const flow = imported(CHECKOUT);
    const stack = buildCallStack(flow, buildFlowOutline(flow));

    expect(stack.orphanResponses).toEqual([]);
    expect(stack.derivedReturnsBefore.size).toBe(0);
  });

  it("reads a flat exchange flat, so nothing gained a level it did not have", () => {
    const flow = imported(
      ["sequenceDiagram", "participant A", "participant B", "A->>B: ping"].join("\n"),
    );
    const stack = buildCallStack(flow, buildFlowOutline(flow));

    expect(ordered(flow).map((id) => stack.byStep.get(id)!.callDepth)).toEqual([0]);
  });
});
