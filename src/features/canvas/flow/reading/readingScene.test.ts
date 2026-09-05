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
  connectionRemoved: "connection removed",
  connection: "Connection",
  untitled: "Untitled step",
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
