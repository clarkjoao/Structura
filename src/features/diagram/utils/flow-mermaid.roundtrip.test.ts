import { describe, expect, it } from "vitest";
import type { Component, Connection } from "../model/diagram.types";
import type { Flow, FlowStep } from "../model/flow.types";
import { parseMermaidSequence } from "./import-mermaid-sequence";
import { stepsToMermaid } from "./flow-mermaid";
import { buildFlowOutline } from "./flow-outline";

/**
 * Mermaid in, Mermaid out, after teaching the importer to mark requests.
 *
 * The risk the change carried: a request used to leave `payloadDirection`
 * unset and now says `"request"`, so anything that read the absence as
 * meaning something would quietly change what it writes. These pin the
 * round trip rather than reading the export and hoping.
 */

const CHECKOUT = [
  "sequenceDiagram",
  "participant Cliente",
  "participant API",
  "participant Pagamentos",
  "Cliente->>API: POST /checkout",
  "API->>Pagamentos: cobrar(pedido)",
  "Pagamentos-->>API: pago",
  "API-->>Cliente: 201 Created",
].join("\n");

/** Imports a sequence and gives back everything the exporter needs. */
function importPlan(text: string) {
  const plan = parseMermaidSequence(text, {}, {}, { x: 0, y: 0 });
  expect(plan.errors).toEqual([]);

  const components: Record<string, Component> = {};
  for (const component of plan.newComponents) components[component.id] = component;
  const connections: Record<string, Connection> = {};
  for (const connection of plan.newConnections) connections[connection.id] = connection;

  const flow: Flow = {
    id: "f1",
    name: "Checkout",
    mermaid: "",
    diagramId: "d1",
    entryStepId: plan.entryStepId,
    steps: plan.steps,
  };
  return { flow, components, connections };
}

/** The flow's steps in reading order. */
function buildOrder(flow: Flow): FlowStep[] {
  return buildFlowOutline(flow).rows.map((row) => flow.steps[row.stepId]!);
}

/** Just the message lines, which is what a round trip has to preserve. */
function messages(mermaid: string): string[] {
  return mermaid
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^\w+(->>|-->>|-\)|--\)|-->|-x|--x|=>>)\w+:/.test(line));
}

describe("a sequence survives the round trip", () => {
  it("writes the same messages back out, in the same order and the same directions", () => {
    const { flow, components, connections } = importPlan(CHECKOUT);

    const exported = stepsToMermaid(flow, components, connections);

    // Participants come back as the aliases the exporter assigns.
    expect(messages(exported)).toEqual([
      "C->>A: POST /checkout",
      "A->>P: cobrar(pedido)",
      "P-->>A: pago",
      "A-->>C: 201 Created",
    ]);
  });

  it("never loses a message, however many times it goes round", () => {
    const first = importPlan(CHECKOUT);
    const once = stepsToMermaid(first.flow, first.components, first.connections);
    const second = importPlan(once);
    const twice = stepsToMermaid(second.flow, second.components, second.connections);
    const third = importPlan(twice);
    const thrice = stepsToMermaid(third.flow, third.components, third.connections);

    expect(messages(once)).toHaveLength(4);
    expect(messages(twice)).toHaveLength(4);
    expect(messages(thrice)).toHaveLength(4);
  });

  it("is settled from the first pass — nothing drifts", () => {
    const first = importPlan(CHECKOUT);
    const once = stepsToMermaid(first.flow, first.components, first.connections);
    const second = importPlan(once);
    const twice = stepsToMermaid(second.flow, second.components, second.connections);

    expect(twice).toBe(once);
  });

  it("keeps a response pointing the way it came, not the way the connection runs", () => {
    const { flow, components, connections } = importPlan(CHECKOUT);
    const exported = stepsToMermaid(flow, components, connections);

    // `pago` travels Pagamentos → API even though the connection is API → Pagamentos.
    expect(exported).toContain("P-->>A: pago");
    expect(exported).not.toContain("A-->>P: pago");
  });

  it("writes a request the same way it did when the direction was simply absent", () => {
    const { flow, components, connections } = importPlan(CHECKOUT);
    const withDirections = stepsToMermaid(flow, components, connections);

    // The state the importer used to leave behind: requests with no direction.
    const stripped: Record<string, FlowStep> = {};
    for (const [id, step] of Object.entries(flow.steps)) {
      stripped[id] =
        step.payloadDirection === "request"
          ? { ...step, payloadDirection: undefined }
          : { ...step };
    }
    const asBefore = stepsToMermaid({ ...flow, steps: stripped }, components, connections);

    expect(withDirections).toBe(asBefore);
  });
});

describe("what Mermaid has no room for is lost, and that is the whole list", () => {
  it("drops a step's context, because a sequence diagram cannot say it", () => {
    const { flow, components, connections } = importPlan(CHECKOUT);
    const [firstId] = Object.keys(flow.steps);
    flow.steps[firstId!]!.context = { sets: { cliente_id: "c_8f3a" }, reads: ["token"] };

    const exported = stepsToMermaid(flow, components, connections);
    const reimported = importPlan(exported);

    expect(messages(exported)).toHaveLength(4);
    expect(Object.values(reimported.flow.steps).every((step) => step.context === undefined)).toBe(
      true,
    );
  });
});

describe("each arrow carries what it means, both ways", () => {
  /**
   * The glyph says two things at once: a dashed stem means the message is
   * travelling back, and a `)` head means nobody waits for it. Reading `-->>`
   * as async conflated them — every imported reply claimed to be a call nobody
   * returns, and the arrow degraded on each round trip, `-->>` to `-)` to `-x`.
   */
  it("reads a reply as a reply, not as a call nobody returns", () => {
    const { flow } = importPlan(CHECKOUT);
    const responses = Object.values(flow.steps).filter(
      (step) => step.payloadDirection === "response",
    );

    expect(responses).toHaveLength(2);
    expect(responses.every((step) => step.isAsync === true)).toBe(false);
    expect(responses.every((step) => step.isAsync === false)).toBe(true);
  });

  it("keeps every arrow shape it was given", () => {
    const source = [
      "sequenceDiagram",
      "participant A",
      "participant B",
      "A->>B: chama",
      "B-->>A: responde",
      "A-)B: dispara",
      "B--)A: responde solto",
      "A-xB: perdida",
    ].join("\n");

    const { flow, components, connections } = importPlan(source);
    const exported = stepsToMermaid(flow, components, connections);

    expect(messages(exported)).toEqual([
      "A->>B: chama",
      "B-->>A: responde",
      "A-)B: dispara",
      "B--)A: responde solto",
      "A-xB: perdida",
    ]);
  });

  it("marks as fire-and-forget only the arrows that mean it", () => {
    const source = [
      "sequenceDiagram",
      "participant A",
      "participant B",
      "A->>B: chama",
      "B-->>A: responde",
      "A-)B: dispara",
      "A-xB: perdida",
    ].join("\n");

    const { flow } = importPlan(source);
    const order = buildOrder(flow);

    expect(order.map((step) => step.isAsync)).toEqual([false, false, true, false]);
  });
});

/**
 * A block keyword survives the round trip on its own field.
 *
 * It used to travel in `conditionLabel`, which meant importing `par Notificar`
 * threw the block's own name away and kept only the word `par` — and the export
 * then depended on nobody having edited that label into a question.
 */
const BLOCKS = [
  "sequenceDiagram",
  "participant App",
  "participant Fila",
  "participant Email",
  "App->>Fila: enfileira",
  "par Notificações",
  "  Fila->>Email: envia e-mail",
  "and Métricas",
  "  Fila->>App: registra",
  "end",
].join("\n");

/** The block-structure lines, which is what a conditional round trip has to keep. */
function blocks(mermaid: string): string[] {
  return mermaid
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^(alt|opt|loop|par|critical|break|else|and|option|end)\b/.test(line));
}

describe("a conditional block survives the round trip", () => {
  it("keeps the keyword on the step rather than in its label", () => {
    const { flow } = importPlan(BLOCKS);

    const condition = Object.values(flow.steps).find((step) => step.type === "condition")!;

    expect(condition.conditionKind).toBe("par");
    expect(condition.conditionLabel).toBeUndefined();
  });

  it("keeps the block's own name, which used to be overwritten by the keyword", () => {
    const { flow } = importPlan(BLOCKS);

    const condition = Object.values(flow.steps).find((step) => step.type === "condition")!;

    expect(condition.branches?.map((branch) => branch.label)).toEqual(["Notificações", "Métricas"]);
  });

  it("writes the same block back out, keyword and separator alike", () => {
    const { flow, components, connections } = importPlan(BLOCKS);

    expect(blocks(stepsToMermaid(flow, components, connections))).toEqual([
      "par Notificações",
      "and Métricas",
      "end",
    ]);
  });

  it("is byte-stable from the first pass", () => {
    const first = importPlan(BLOCKS);
    const once = stepsToMermaid(first.flow, first.components, first.connections);
    const second = importPlan(`sequenceDiagram\n${once.split("\n").slice(1).join("\n")}`);
    const twice = stepsToMermaid(second.flow, second.components, second.connections);

    expect(twice).toBe(once);
  });

  it("does not turn every other block into a choice", () => {
    const { flow } = importPlan(BLOCKS.replace("par Notificações", "loop Notificações"));

    const condition = Object.values(flow.steps).find((step) => step.type === "condition")!;

    expect(condition.conditionKind).toBe("loop");
  });
});

/**
 * A block inside a block.
 *
 * These used to be dropped on import — `Nested alt block skipped`, pushed to
 * the errors and thrown away. That is data loss on the shape a real concurrent
 * flow actually has: deciding something inside one thread of a `par` is the
 * ordinary case, not the exotic one.
 */
const NESTED_BLOCKS = [
  "sequenceDiagram",
  "participant App",
  "participant Fila",
  "participant Email",
  "App->>Fila: enfileira",
  "par Notificações",
  "  alt Tem e-mail",
  "    Fila->>Email: envia",
  "  else Sem e-mail",
  "    Fila->>App: registra falha",
  "  end",
  "and Métricas",
  "  Fila->>App: registra",
  "end",
].join("\n");

describe("a block inside a block survives the import", () => {
  it("reports no error, where it used to report the block it discarded", () => {
    const plan = parseMermaidSequence(NESTED_BLOCKS, {}, {}, { x: 0, y: 0 });

    expect(plan.errors).toEqual([]);
  });

  it("keeps both branch points, each with its own kind", () => {
    const { flow } = importPlan(NESTED_BLOCKS);

    const kinds = Object.values(flow.steps)
      .filter((step) => step.type === "condition")
      .map((step) => step.conditionKind);

    expect(kinds.sort()).toEqual(["alt", "par"]);
  });

  it("puts the inner block inside the outer one's first thread", () => {
    const { flow } = importPlan(NESTED_BLOCKS);

    const par = Object.values(flow.steps).find((step) => step.conditionKind === "par")!;
    const inner = flow.steps[par.branches![0]!.nextId]!;

    expect(inner.conditionKind).toBe("alt");
    expect(inner.branches?.map((branch) => branch.label)).toEqual(["Tem e-mail", "Sem e-mail"]);
  });

  it("keeps every message, including the ones the discard used to take with it", () => {
    const { flow, components, connections } = importPlan(NESTED_BLOCKS);

    expect(messages(stepsToMermaid(flow, components, connections))).toEqual([
      "A->>F: enfileira",
      "F->>E: envia",
      "F->>A: registra falha",
      "F->>A: registra",
    ]);
  });

  it("writes the nesting back out in the same order", () => {
    const { flow, components, connections } = importPlan(NESTED_BLOCKS);

    expect(blocks(stepsToMermaid(flow, components, connections))).toEqual([
      "par Notificações",
      "alt Tem e-mail",
      "else Sem e-mail",
      "end",
      "and Métricas",
      "end",
    ]);
  });

  it("is byte-stable from the first pass", () => {
    const first = importPlan(NESTED_BLOCKS);
    const once = stepsToMermaid(first.flow, first.components, first.connections);
    const second = importPlan(`sequenceDiagram\n${once.split("\n").slice(1).join("\n")}`);

    expect(stepsToMermaid(second.flow, second.components, second.connections)).toBe(once);
  });
});
