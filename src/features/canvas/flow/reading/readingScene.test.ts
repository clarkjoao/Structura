import { describe, expect, it } from "vitest";
import type { Component, Connection, FlowStep } from "@/features/diagram";
import { describeStepHeading, describeStepTarget, type StepHeadingLabels } from "./readingScene";

function component(id: string, name: string, type: string, technology?: string): Component {
  return { id, name, description: "", parentId: null, type, technology } as Component;
}

function step(over: Partial<FlowStep> = {}): FlowStep {
  return { id: "s1", type: "action", ...over };
}

const COMPONENTS: Record<string, Component> = {
  gateway: component("gateway", "API Gateway", "container", "Kong"),
  antifraud: component("antifraud", "Antifraude", "system"),
  lambda: component("lambda", "Criar Pedido", "aws-compute", "AWS Lambda"),
  board: component("board", "Checkout", "panel"),
};

const CONNECTIONS: Record<string, Connection> = {
  c1: { id: "c1", sourceId: "gateway", targetId: "antifraud", label: "POST /v2/score" },
  unnamed: { id: "unnamed", sourceId: "gateway", targetId: "lambda", label: "" },
};

const LABELS: StepHeadingLabels = {
  componentRemoved: "component removed",
  endpointRemoved: "rota removida",
  connectionRemoved: "connection removed",
  connection: "Connection",
  untitled: "Untitled step",
  conditionKinds: {
    alt: "Choice",
    opt: "Optional",
    loop: "Loop",
    par: "Parallel",
    critical: "Critical",
    break: "Break",
  },
};

describe("where the step lands", () => {
  it("is the node itself for a step that points at one", () => {
    const target = describeStepTarget(step({ componentId: "gateway" }), COMPONENTS, CONNECTIONS);

    expect(target?.name).toBe("API Gateway");
  });

  it("is the far end of the edge for a request", () => {
    const target = describeStepTarget(
      step({ connectionId: "c1", payloadDirection: "request" }),
      COMPONENTS,
      CONNECTIONS,
    );

    expect(target?.name).toBe("Antifraude");
  });

  it("is the near end again for the response coming back", () => {
    const target = describeStepTarget(
      step({ connectionId: "c1", payloadDirection: "response" }),
      COMPONENTS,
      CONNECTIONS,
    );

    expect(target?.name).toBe("API Gateway");
  });

  it("treats an edge that says nothing about direction as a request", () => {
    const target = describeStepTarget(step({ connectionId: "c1" }), COMPONENTS, CONNECTIONS);

    expect(target?.name).toBe("Antifraude");
  });

  it("carries the element's technology so the line can say what it is", () => {
    const target = describeStepTarget(step({ componentId: "lambda" }), COMPONENTS, CONNECTIONS);

    expect(target?.detail).toBe("AWS Lambda");
  });

  it("says nothing about technology for an element that carries none", () => {
    const target = describeStepTarget(step({ componentId: "antifraud" }), COMPONENTS, CONNECTIONS);

    expect(target?.detail).toBeUndefined();
  });

  it("takes the swatch from the C4 palette", () => {
    const target = describeStepTarget(step({ componentId: "gateway" }), COMPONENTS, CONNECTIONS);

    expect(target?.color).toBe("hsl(var(--node-container))");
  });

  it("takes the swatch from the cloud category for a cloud element", () => {
    const target = describeStepTarget(step({ componentId: "lambda" }), COMPONENTS, CONNECTIONS);

    expect(target?.color).toBe("hsl(var(--aws-compute))");
  });

  it("has nowhere to point when the element is gone from the view", () => {
    expect(describeStepTarget(step({ componentId: "ghost" }), COMPONENTS, CONNECTIONS)).toBeNull();
  });

  it("lets the call decide where it lands, not the sender the importer wrote down", () => {
    // The Mermaid importer puts the message's sender in `componentId`, so a
    // step carries both. The connection is the one that says where it arrives.
    const step = {
      id: "s1",
      type: "action",
      componentId: "gateway",
      connectionId: "c1",
      payloadDirection: "request",
    } as FlowStep;

    expect(describeStepTarget(step, COMPONENTS, CONNECTIONS)?.name).toBe("Antifraude");
  });

  it("still lands on the sender when that same step is the response", () => {
    const step = {
      id: "s1",
      type: "action",
      componentId: "gateway",
      connectionId: "c1",
      payloadDirection: "response",
    } as FlowStep;

    expect(describeStepTarget(step, COMPONENTS, CONNECTIONS)?.name).toBe("API Gateway");
  });

  it("falls back to the element it names when the connection is gone", () => {
    const step = {
      id: "s1",
      type: "action",
      componentId: "gateway",
      connectionId: "vanished",
    } as FlowStep;

    expect(describeStepTarget(step, COMPONENTS, CONNECTIONS)?.name).toBe("API Gateway");
  });

  it("has nowhere to point for a step that names no element at all", () => {
    expect(describeStepTarget(step({ note: "just a remark" }), COMPONENTS, CONNECTIONS)).toBeNull();
  });
});

describe("the one line that names a step", () => {
  const heading = (over: Partial<FlowStep>) =>
    describeStepHeading(step(over), COMPONENTS, CONNECTIONS, LABELS);

  it("is the author's own title whenever there is one", () => {
    expect(heading({ title: "Consulta de risco", componentId: "gateway" })).toBe(
      "Consulta de risco",
    );
  });

  it("treats a title of only spaces as no title", () => {
    expect(heading({ title: "   ", componentId: "gateway" })).toBe("API Gateway");
  });

  it("names the node for a step that points at one", () => {
    expect(heading({ componentId: "antifraud" })).toBe("Antifraude");
  });

  it("names the connection for a step that points at an edge", () => {
    expect(heading({ connectionId: "c1" })).toBe("POST /v2/score");
  });

  it("says the element is gone rather than showing an id", () => {
    expect(heading({ componentId: "ghost" })).toBe("component removed");
    expect(heading({ connectionId: "ghost" })).toBe("connection removed");
  });

  it("calls an unnamed edge a connection", () => {
    expect(heading({ connectionId: "unnamed" })).toBe("Connection");
  });

  it("falls back to the question a condition asks", () => {
    expect(heading({ type: "condition", conditionLabel: "Cartão aprovado?" })).toBe(
      "Cartão aprovado?",
    );
  });

  it("lets the question outrank the node the condition is asked on", () => {
    expect(
      heading({
        type: "condition",
        componentId: "lambda",
        conditionLabel: "Cartão aprovado?",
        branches: [
          { label: "Aprovado", nextId: "a" },
          { label: "Recusado", nextId: "b" },
        ],
      }),
    ).toBe("Cartão aprovado?");
  });

  it("falls back to the note when the step is only a remark", () => {
    expect(heading({ type: "note", note: "Só o caminho feliz." })).toBe("Só o caminho feliz.");
  });

  it("says the step is untitled rather than printing its type at the reader", () => {
    expect(heading({})).toBe("Untitled step");
  });
});

/**
 * A call, headed by what it calls.
 *
 * The spine used to name a call by the node the step sits on — which in a
 * recorded script is the sender — or by the edge's label, which names a channel
 * rather than an operation. A route outranks both, and nothing an author has
 * already written changes, because a step names a route only once someone
 * points it at one.
 */
describe("a step that names a route", () => {
  const WITH_ROUTE: Record<string, Component> = {
    ...COMPONENTS,
    group: {
      id: "group",
      name: "Management API",
      description: "",
      parentId: null,
      type: "api-group",
    } as Component,
    post: {
      id: "post",
      name: "Criar URL",
      description: "",
      parentId: "group",
      type: "endpoint",
      method: "POST",
      path: "/urls",
      handlers: [],
    } as Component,
  };

  it("is headed by its method and path", () => {
    const heading = describeStepHeading(
      step({ endpointId: "post", componentId: "gateway", connectionId: "c1" }),
      WITH_ROUTE,
      CONNECTIONS,
      LABELS,
    );

    expect(heading).toBe("POST /urls");
  });

  it("still loses to a heading the author wrote", () => {
    const heading = describeStepHeading(
      step({ endpointId: "post", title: "Cria o link curto" }),
      WITH_ROUTE,
      CONNECTIONS,
      LABELS,
    );

    expect(heading).toBe("Cria o link curto");
  });

  it("says the route is gone rather than quietly reverting to the node", () => {
    const heading = describeStepHeading(
      step({ endpointId: "deleted", componentId: "gateway" }),
      WITH_ROUTE,
      CONNECTIONS,
      LABELS,
    );

    expect(heading).toBe(LABELS.endpointRemoved);
  });

  it("changes nothing for a step that names none", () => {
    const plain = step({ componentId: "gateway", connectionId: "c1" });

    expect(describeStepHeading(plain, WITH_ROUTE, CONNECTIONS, LABELS)).toBe(
      describeStepHeading(plain, COMPONENTS, CONNECTIONS, LABELS),
    );
  });
});
