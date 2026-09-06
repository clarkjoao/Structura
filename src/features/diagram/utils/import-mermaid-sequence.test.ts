import { describe, expect, it, vi } from "vitest";
import type { Component, Connection } from "../model/diagram.types";
import { parseMermaidSequence } from "./import-mermaid-sequence";

const { generateIdMock } = vi.hoisted(() => ({
  generateIdMock: vi.fn(),
}));

vi.mock("./generate-id", () => ({
  generateId: (prefix: string) => generateIdMock(prefix),
}));

function component(id: string, name: string): Component {
  return {
    id,
    name,
    description: "",
    parentId: null,
    type: "component",
  };
}

function connection(id: string, sourceId: string, targetId: string, label: string): Connection {
  return {
    id,
    sourceId,
    targetId,
    label,
    intent: "call",
  };
}

describe("parseMermaidSequence", () => {
  it("matches existing component by name (case-insensitive)", () => {
    generateIdMock.mockImplementation((prefix: string) => `${prefix}-x`);
    const input = ["sequenceDiagram", "participant P as payment api", "P->>P: ping"].join("\n");
    const existingComponents = {
      c1: component("c1", "Payment API"),
    };

    const result = parseMermaidSequence(input, existingComponents, {}, { x: 0, y: 0 });

    expect(result.newComponents).toHaveLength(0);
  });

  it("creates new component for unknown participant", () => {
    let sequence = 0;
    generateIdMock.mockImplementation((prefix: string) => `${prefix}-${sequence++}`);
    const input = ["sequenceDiagram", "participant A as Unknown Service", "A->>A: ping"].join("\n");

    const result = parseMermaidSequence(input, {}, {}, { x: 0, y: 0 });

    expect(result.newComponents).toHaveLength(1);
    expect(result.newComponents[0]).toMatchObject({ type: "component", name: "Unknown Service" });
  });

  it("creates new connection when not found", () => {
    let sequence = 0;
    generateIdMock.mockImplementation((prefix: string) => `${prefix}-${sequence++}`);
    const input = [
      "sequenceDiagram",
      "participant A as Service A",
      "participant B as Service B",
      "A->>B: Get Data",
    ].join("\n");

    const result = parseMermaidSequence(input, {}, {}, { x: 0, y: 0 });

    expect(result.newConnections).toHaveLength(1);
    expect(result.newConnections[0].label).toBe("Get Data");
  });

  it("reuses existing connection", () => {
    let sequence = 0;
    generateIdMock.mockImplementation((prefix: string) => `${prefix}-${sequence++}`);
    const existingComponents = {
      c1: component("c1", "Service A"),
      c2: component("c2", "Service B"),
    };
    const existingConnections = {
      conn1: connection("conn1", "c1", "c2", "Old label"),
    };
    const input = [
      "sequenceDiagram",
      "participant A as Service A",
      "participant B as Service B",
      "A->>B: New label",
    ].join("\n");

    const result = parseMermaidSequence(input, existingComponents, existingConnections, {
      x: 0,
      y: 0,
    });

    expect(result.newConnections).toHaveLength(0);
    const step = Object.values(result.steps)[0];
    expect(step.connectionId).toBe("conn1");
    expect(step.note).toBe("New label");
  });

  it("links steps via next", () => {
    let sequence = 0;
    generateIdMock.mockImplementation((prefix: string) => `${prefix}-${sequence++}`);
    const input = [
      "sequenceDiagram",
      "participant A",
      "participant B",
      "A->>B: one",
      "A->>B: two",
      "A->>B: three",
    ].join("\n");

    const result = parseMermaidSequence(input, {}, {}, { x: 0, y: 0 });
    const first = result.steps[result.entryStepId];
    const second = first.next ? result.steps[first.next] : undefined;
    const third = second?.next ? result.steps[second.next] : undefined;

    expect(Object.keys(result.steps)).toHaveLength(3);
    expect(first.note).toBe("one");
    expect(second?.note).toBe("two");
    expect(third?.note).toBe("three");
    expect(third?.next).toBeUndefined();
  });

  it("alt block creates condition step with branches", () => {
    let sequence = 0;
    generateIdMock.mockImplementation((prefix: string) => `${prefix}-${sequence++}`);
    const input = [
      "sequenceDiagram",
      "participant A",
      "participant B",
      "alt success",
      "A->>B: ok",
      "else fail",
      "A->>B: error",
      "end",
    ].join("\n");

    const result = parseMermaidSequence(input, {}, {}, { x: 0, y: 0 });
    const condition = Object.values(result.steps).find((step) => step.type === "condition");

    expect(condition).toBeDefined();
    expect(condition?.branches).toHaveLength(2);
  });

  it("returns error for non-sequence diagram", () => {
    generateIdMock.mockImplementation((prefix: string) => `${prefix}-x`);
    const result = parseMermaidSequence("graph TD\nA-->B", {}, {}, { x: 0, y: 0 });

    expect(result.errors.length).toBeGreaterThan(0);
    expect(Object.keys(result.steps)).toHaveLength(0);
  });

  it("sets action step componentId from source participant", () => {
    generateIdMock.mockImplementation((prefix: string) => `${prefix}-x`);
    const aliceId = "alice-id";
    const johnId = "john-id";
    const input = ["sequenceDiagram", "Alice->>John: Hello"].join("\n");
    const existingComponents = {
      [aliceId]: component(aliceId, "Alice"),
      [johnId]: component(johnId, "John"),
    };

    const result = parseMermaidSequence(input, existingComponents, {}, { x: 0, y: 0 });
    const step = result.steps[result.entryStepId];

    expect(step.type).toBe("action");
    expect(step.componentId).toBe(aliceId);
  });

  it("sets action step componentId to self on self-loop", () => {
    generateIdMock.mockImplementation((prefix: string) => `${prefix}-x`);
    const johnId = "john-id";
    const input = ["sequenceDiagram", "John->>John: Think"].join("\n");
    const existingComponents = {
      [johnId]: component(johnId, "John"),
    };

    const result = parseMermaidSequence(input, existingComponents, {}, { x: 0, y: 0 });
    const step = result.steps[result.entryStepId];

    expect(step.type).toBe("action");
    expect(step.componentId).toBe(johnId);
  });

  it("sets action step componentId inside condition branches", () => {
    let sequence = 0;
    generateIdMock.mockImplementation((prefix: string) => `${prefix}-${sequence++}`);
    const aliceId = "alice-id";
    const johnId = "john-id";
    const input = ["sequenceDiagram", "loop", "Alice->>John: msg", "end"].join("\n");
    const existingComponents = {
      [aliceId]: component(aliceId, "Alice"),
      [johnId]: component(johnId, "John"),
    };

    const result = parseMermaidSequence(input, existingComponents, {}, { x: 0, y: 0 });
    const actionStep = Object.values(result.steps).find(
      (step) => step.type === "action" && step.note === "msg",
    );

    expect(actionStep).toBeDefined();
    expect(actionStep?.componentId).toBe(aliceId);
  });

  it("-->> arrow answers a call rather than firing one off", () => {
    // `-->>` is Mermaid's reply arrow, not an async message. With no call to
    // answer it still creates the connection, but as an ordinary one and
    // without claiming the step is fire-and-forget.
    let sequence = 0;
    generateIdMock.mockImplementation((prefix: string) => `${prefix}-${sequence++}`);
    const input = ["sequenceDiagram", "Alice-->>John: Great!"].join("\n");

    const result = parseMermaidSequence(input, {}, {}, { x: 0, y: 0 });

    expect(result.newConnections).toHaveLength(1);
    expect(result.newConnections[0].intent).toBe("call");
    expect(Object.values(result.steps)[0].isAsync).toBe(false);
  });

  it("-->> pairs with the call it answers when there is one", () => {
    let sequence = 0;
    generateIdMock.mockImplementation((prefix: string) => `${prefix}-${sequence++}`);
    const input = ["sequenceDiagram", "A->>B: ask", "B-->>A: answer"].join("\n");

    const result = parseMermaidSequence(input, {}, {}, { x: 0, y: 0 });
    const steps = Object.values(result.steps);

    expect(result.newConnections).toHaveLength(1);
    expect(steps.map((step) => step.payloadDirection)).toEqual(["request", "response"]);
  });

  it("--> arrow creates connection with dependency intent", () => {
    let sequence = 0;
    generateIdMock.mockImplementation((prefix: string) => `${prefix}-${sequence++}`);
    const input = ["sequenceDiagram", "Alice-->John: Depends on"].join("\n");

    const result = parseMermaidSequence(input, {}, {}, { x: 0, y: 0 });

    expect(result.newConnections).toHaveLength(1);
    expect(result.newConnections[0].intent).toBe("dependency");
  });

  it("-x arrow creates connection with event intent", () => {
    let sequence = 0;
    generateIdMock.mockImplementation((prefix: string) => `${prefix}-${sequence++}`);
    const input = ["sequenceDiagram", "Alice-xJohn: Fired"].join("\n");

    const result = parseMermaidSequence(input, {}, {}, { x: 0, y: 0 });

    expect(result.newConnections).toHaveLength(1);
    expect(result.newConnections[0].intent).toBe("event");
  });

  it("does not drop -->> steps when mixed with ->>", () => {
    let sequence = 0;
    generateIdMock.mockImplementation((prefix: string) => `${prefix}-${sequence++}`);
    const input = ["sequenceDiagram", "Alice->>John: First", "John-->>Alice: Great!"].join("\n");

    const result = parseMermaidSequence(input, {}, {}, { x: 0, y: 0 });

    expect(Object.keys(result.steps)).toHaveLength(2);
  });

  it("sets componentId on each action step from source participant", () => {
    let sequence = 0;
    generateIdMock.mockImplementation((prefix: string) => `${prefix}-${sequence++}`);
    const aliceId = "alice-id";
    const johnId = "john-id";
    const input = ["sequenceDiagram", "Alice->>John: Hello", "John->>Alice: Hi"].join("\n");
    const existingComponents = {
      [aliceId]: component(aliceId, "Alice"),
      [johnId]: component(johnId, "John"),
    };

    const result = parseMermaidSequence(input, existingComponents, {}, { x: 0, y: 0 });
    const actionSteps = Object.values(result.steps).filter((step) => step.type === "action");

    expect(actionSteps).toHaveLength(2);
    expect(actionSteps[0].componentId).toBe(aliceId);
    expect(actionSteps[1].componentId).toBe(johnId);
  });

  it("sets componentId inside loop branch for -->>", () => {
    let sequence = 0;
    generateIdMock.mockImplementation((prefix: string) => `${prefix}-${sequence++}`);
    const aliceId = "alice-id";
    const johnId = "john-id";
    const input = ["sequenceDiagram", "loop", "Alice-->>John: ok", "end"].join("\n");
    const existingComponents = {
      [aliceId]: component(aliceId, "Alice"),
      [johnId]: component(johnId, "John"),
    };

    const result = parseMermaidSequence(input, existingComponents, {}, { x: 0, y: 0 });
    const actionStep = Object.values(result.steps).find(
      (step) => step.type === "action" && step.note === "ok",
    );

    expect(actionStep).toBeDefined();
    expect(actionStep?.componentId).toBe(aliceId);
  });

  it("-->> reuses existing connection when endpoints match", () => {
    let sequence = 0;
    generateIdMock.mockImplementation((prefix: string) => `${prefix}-${sequence++}`);
    const aliceId = "alice-id";
    const johnId = "john-id";
    const existingComponents = {
      [aliceId]: component(aliceId, "Alice"),
      [johnId]: component(johnId, "John"),
    };
    const existingConnections = {
      conn1: connection("conn1", aliceId, johnId, "existing"),
    };
    const input = ["sequenceDiagram", "Alice-->>John: Great!"].join("\n");

    const result = parseMermaidSequence(input, existingComponents, existingConnections, {
      x: 0,
      y: 0,
    });

    expect(result.newConnections).toHaveLength(0);
    const step = result.steps[result.entryStepId];
    expect(step.connectionId).toBe("conn1");
  });

  it("uses grid layout for multiple new components", () => {
    let sequence = 0;
    generateIdMock.mockImplementation((prefix: string) => `${prefix}-${sequence++}`);
    const input = [
      "sequenceDiagram",
      "participant A as Alpha",
      "participant B as Beta",
      "participant C as Gamma",
      "participant D as Delta",
    ].join("\n");

    const result = parseMermaidSequence(input, {}, {}, { x: 100, y: 200 });

    expect(result.newComponents).toHaveLength(4);
    expect(result.layouts[0]).toMatchObject({ x: 100, y: 200 });
    expect(result.layouts[1]).toMatchObject({ x: 300, y: 200 });
    expect(result.layouts[2]).toMatchObject({ x: 500, y: 200 });
    expect(result.layouts[3]).toMatchObject({ x: 100, y: 320 });
  });

  it("maps ->> to call intent", () => {
    let sequence = 0;
    generateIdMock.mockImplementation((prefix: string) => `${prefix}-${sequence++}`);
    const result = parseMermaidSequence("sequenceDiagram\nA->>B: msg", {}, {}, { x: 0, y: 0 });
    expect(result.newConnections[0].intent).toBe("call");
  });

  it("maps -> to call intent", () => {
    let sequence = 0;
    generateIdMock.mockImplementation((prefix: string) => `${prefix}-${sequence++}`);
    const result = parseMermaidSequence("sequenceDiagram\nA->B: msg", {}, {}, { x: 0, y: 0 });
    expect(result.newConnections[0].intent).toBe("call");
  });

  it("maps -) to a call nobody waits for", () => {
    // `-)` is Mermaid's own fire-and-forget arrow — the one glyph that really
    // does mean async. `-x` and `--x`, the lost-message arrows, stay events.
    let sequence = 0;
    generateIdMock.mockImplementation((prefix: string) => `${prefix}-${sequence++}`);
    const result = parseMermaidSequence("sequenceDiagram\nA-)B: msg", {}, {}, { x: 0, y: 0 });
    expect(result.newConnections[0].intent).toBe("async-message");
    expect(Object.values(result.steps)[0].isAsync).toBe(true);
  });

  it("keeps -x as a lost message rather than an async one", () => {
    let sequence = 0;
    generateIdMock.mockImplementation((prefix: string) => `${prefix}-${sequence++}`);
    const result = parseMermaidSequence("sequenceDiagram\nA-xB: msg", {}, {}, { x: 0, y: 0 });
    expect(result.newConnections[0].intent).toBe("event");
    expect(Object.values(result.steps)[0].isAsync).toBe(false);
  });

  it("handles activation suffix in ->>+ without errors", () => {
    let sequence = 0;
    generateIdMock.mockImplementation((prefix: string) => `${prefix}-${sequence++}`);
    const result = parseMermaidSequence("sequenceDiagram\nA->>+B: msg", {}, {}, { x: 0, y: 0 });
    expect(result.newConnections[0].intent).toBe("call");
    expect(result.errors).toEqual([]);
  });

  it("handles deactivation suffix in -->>- without errors", () => {
    let sequence = 0;
    generateIdMock.mockImplementation((prefix: string) => `${prefix}-${sequence++}`);
    const result = parseMermaidSequence("sequenceDiagram\nA-->>-B: msg", {}, {}, { x: 0, y: 0 });
    expect(result.newConnections[0].intent).toBe("call");
    expect(result.errors).toEqual([]);
  });

  it("supports actor keyword like participant", () => {
    let sequence = 0;
    generateIdMock.mockImplementation((prefix: string) => `${prefix}-${sequence++}`);
    const result = parseMermaidSequence(
      "sequenceDiagram\nactor Alice\nAlice->>Alice: ping",
      {},
      {},
      { x: 0, y: 0 },
    );
    expect(result.newComponents[0].name).toBe("Alice");
  });

  it("supports actor alias with display name", () => {
    let sequence = 0;
    generateIdMock.mockImplementation((prefix: string) => `${prefix}-${sequence++}`);
    const result = parseMermaidSequence(
      "sequenceDiagram\nactor A as Alice\nA->>A: ping",
      {},
      {},
      { x: 0, y: 0 },
    );
    expect(result.newComponents[0].name).toBe("Alice");
  });

  it("skips activate line silently", () => {
    let sequence = 0;
    generateIdMock.mockImplementation((prefix: string) => `${prefix}-${sequence++}`);
    const input = [
      "sequenceDiagram",
      "participant John",
      "activate John",
      "John->>John: ping",
    ].join("\n");
    const result = parseMermaidSequence(input, {}, {}, { x: 0, y: 0 });
    expect(result.errors).toEqual([]);
    expect(Object.keys(result.steps)).toHaveLength(1);
  });

  it("skips deactivate line silently", () => {
    let sequence = 0;
    generateIdMock.mockImplementation((prefix: string) => `${prefix}-${sequence++}`);
    const input = [
      "sequenceDiagram",
      "participant John",
      "deactivate John",
      "John->>John: ping",
    ].join("\n");
    const result = parseMermaidSequence(input, {}, {}, { x: 0, y: 0 });
    expect(result.errors).toEqual([]);
    expect(Object.keys(result.steps)).toHaveLength(1);
  });

  it("ignores rect and link lines", () => {
    let sequence = 0;
    generateIdMock.mockImplementation((prefix: string) => `${prefix}-${sequence++}`);
    const input = [
      "sequenceDiagram",
      "participant Alice",
      "participant John",
      "rect rgb(0,0,0)",
      "link Alice: Dashboard @ https://example.com",
      "Alice->>John: Hello",
    ].join("\n");
    const result = parseMermaidSequence(input, {}, {}, { x: 0, y: 0 });
    expect(result.errors).toEqual([]);
    expect(Object.keys(result.steps)).toHaveLength(1);
  });

  it("par block creates condition step with two branches", () => {
    let sequence = 0;
    generateIdMock.mockImplementation((prefix: string) => `${prefix}-${sequence++}`);
    const input = [
      "sequenceDiagram",
      "participant Alice",
      "participant John",
      "par first",
      "Alice->>John: one",
      "and second",
      "John->>Alice: two",
      "end",
    ].join("\n");
    const result = parseMermaidSequence(input, {}, {}, { x: 0, y: 0 });
    const condition = Object.values(result.steps).find((step) => step.type === "condition");
    expect(condition?.branches).toHaveLength(2);
  });

  it("critical block creates condition step with two branches", () => {
    let sequence = 0;
    generateIdMock.mockImplementation((prefix: string) => `${prefix}-${sequence++}`);
    const input = [
      "sequenceDiagram",
      "participant Alice",
      "participant John",
      "critical base",
      "Alice->>John: one",
      "option fallback",
      "John->>Alice: two",
      "end",
    ].join("\n");
    const result = parseMermaidSequence(input, {}, {}, { x: 0, y: 0 });
    const condition = Object.values(result.steps).find((step) => step.type === "condition");
    expect(condition?.branches).toHaveLength(2);
  });

  it("break block creates condition step with one branch", () => {
    let sequence = 0;
    generateIdMock.mockImplementation((prefix: string) => `${prefix}-${sequence++}`);
    const input = [
      "sequenceDiagram",
      "participant Alice",
      "participant John",
      "break stop",
      "Alice->>John: one",
      "end",
    ].join("\n");
    const result = parseMermaidSequence(input, {}, {}, { x: 0, y: 0 });
    const condition = Object.values(result.steps).find((step) => step.type === "condition");
    expect(condition?.branches).toHaveLength(1);
  });

  it("sets componentId on every action step from source component", () => {
    let sequence = 0;
    generateIdMock.mockImplementation((prefix: string) => `${prefix}-${sequence++}`);
    const aliceId = "alice-id";
    const johnId = "john-id";
    const existingComponents = {
      [aliceId]: component(aliceId, "Alice"),
      [johnId]: component(johnId, "John"),
    };
    const input = ["sequenceDiagram", "Alice->>John: one", "John->>Alice: two"].join("\n");
    const result = parseMermaidSequence(input, existingComponents, {}, { x: 0, y: 0 });
    const actionSteps = Object.values(result.steps).filter((step) => step.type === "action");
    expect(actionSteps[0].componentId).toBe(aliceId);
    expect(actionSteps[1].componentId).toBe(johnId);
  });

  it("sets componentId inside par branches", () => {
    let sequence = 0;
    generateIdMock.mockImplementation((prefix: string) => `${prefix}-${sequence++}`);
    const aliceId = "alice-id";
    const johnId = "john-id";
    const existingComponents = {
      [aliceId]: component(aliceId, "Alice"),
      [johnId]: component(johnId, "John"),
    };
    const input = [
      "sequenceDiagram",
      "par a",
      "Alice->>John: left",
      "and b",
      "John->>Alice: right",
      "end",
    ].join("\n");
    const result = parseMermaidSequence(input, existingComponents, {}, { x: 0, y: 0 });
    const left = Object.values(result.steps).find((step) => step.note === "left");
    const right = Object.values(result.steps).find((step) => step.note === "right");
    expect(left?.componentId).toBe(aliceId);
    expect(right?.componentId).toBe(johnId);
  });

  it("parses full async sequence regression with five steps", () => {
    let sequence = 0;
    generateIdMock.mockImplementation((prefix: string) => `${prefix}-${sequence++}`);
    const input = [
      "sequenceDiagram",
      "Alice->>John: Hello John, how are you?",
      "John-->>Alice: Great!",
      "Alice-)John: See you later!",
      "Alice->>Bob: Hello Bob, how are you?",
      "Bob-->>John: Jolly good!",
    ].join("\n");
    const result = parseMermaidSequence(input, {}, {}, { x: 0, y: 0 });
    const actionSteps = Object.values(result.steps).filter((step) => step.type === "action");
    expect(actionSteps).toHaveLength(5);
  });

  it("reuses a single connection for request and response pair", () => {
    let sequence = 0;
    generateIdMock.mockImplementation((prefix: string) => `${prefix}-${sequence++}`);
    const input = ["sequenceDiagram", "A->>B: Authenticate", "B-->>A: Token"].join("\n");

    const result = parseMermaidSequence(input, {}, {}, { x: 0, y: 0 });
    const steps = Object.values(result.steps).filter((step) => step.type === "action");

    expect(result.newConnections).toHaveLength(1);
    expect(steps).toHaveLength(2);
    expect(steps[0].connectionId).toBe(steps[1].connectionId);
    expect(steps[1].payloadDirection).toBe("response");
  });

  it("reuses reverse existing connection for async response", () => {
    let sequence = 0;
    generateIdMock.mockImplementation((prefix: string) => `${prefix}-${sequence++}`);
    const existingComponents = {
      a: component("a", "A"),
      b: component("b", "B"),
    };
    const existingConnections = {
      conn1: connection("conn1", "a", "b", "Authenticate"),
    };
    const input = ["sequenceDiagram", "B-->>A: Token"].join("\n");

    const result = parseMermaidSequence(input, existingComponents, existingConnections, {
      x: 0,
      y: 0,
    });
    const step = result.steps[result.entryStepId];

    expect(result.newConnections).toHaveLength(0);
    expect(step.connectionId).toBe("conn1");
    expect(step.payloadDirection).toBe("response");
  });
});
