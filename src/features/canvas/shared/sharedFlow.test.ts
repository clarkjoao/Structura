import { describe, expect, it } from "vitest";
import type { Component, Diagram, Flow } from "@/features/diagram";
import "@/features/elements/bootstrap";
import { resolveVersionSnapshot } from "@/features/diagram";
import { buildFlowHighlight } from "../flow/flowState";
import { compactContainerIdsOf } from "../flow/visibleTarget";
import { projectReadDiagram } from "../core/projectReadDiagram";

const comp = (partial: Record<string, unknown>): Component =>
  ({ description: "", parentId: null, type: "container", ...partial }) as unknown as Component;

/** Orders → Auth (badge) over gRPC, Billing → Auth through a reference, then Auth → DB. */
function diagram(mode: "badge" | "ref"): Diagram {
  const flow = {
    id: "f",
    name: "Login",
    entryStepId: "s1",
    steps: {
      s1: { id: "s1", type: "action", componentId: "orders", next: "s2" },
      s2: { id: "s2", type: "action", connectionId: "e1", next: "s3" },
      s3: { id: "s3", type: "action", componentId: "auth", next: "s4" },
      s4: { id: "s4", type: "action", componentId: "db" },
    },
  } as unknown as Flow;
  return {
    id: "d",
    name: "D",
    level: "container",
    createdAt: 0,
    updatedAt: 0,
    snapshot: {
      components: {
        auth: comp({ id: "auth", name: "Auth", shared: { mode } }),
        orders: comp({ id: "orders", name: "Orders" }),
        billing: comp({ id: "billing", name: "Billing" }),
        db: comp({ id: "db", name: "DB" }),
        r1: comp({ id: "r1", name: "Auth", type: "shared-ref", refOf: "auth" }),
      },
      connections: {
        e1: { id: "e1", sourceId: "orders", targetId: "auth", label: "gRPC" },
        e2: { id: "e2", sourceId: "billing", targetId: "r1", label: "HTTP" },
        e3: { id: "e3", sourceId: "auth", targetId: "db", label: "SQL" },
      },
      flows: { f: flow },
      iconLibrary: {},
    },
    nodeLayouts: {
      auth: { elementId: "auth", x: 400, y: 0, width: 200, height: 80 },
      orders: { elementId: "orders", x: 0, y: 0, width: 200, height: 80 },
      billing: { elementId: "billing", x: 0, y: 200, width: 200, height: 80 },
      db: { elementId: "db", x: 800, y: 0, width: 200, height: 80 },
      r1: { elementId: "r1", x: 250, y: 200, width: 200, height: 48 },
    },
    edgeLayouts: {},
    viewport: { x: 0, y: 0, zoom: 1 },
  } as Diagram;
}

function readingAt(d: Diagram, stepId: string, history: string[]) {
  const { components } = resolveVersionSnapshot(d, null);
  return {
    badges: null,
    highlight: buildFlowHighlight(d.snapshot.flows.f, stepId, history, {
      components,
      compactIds: compactContainerIdsOf(components),
    }),
  };
}

describe("F5 — a step on an edge a shared element hides", () => {
  it("reveals it while the step is read, and hides it again after", () => {
    const d = diagram("badge");
    const drawn = (stepId: string, history: string[]) =>
      projectReadDiagram(d, readingAt(d, stepId, history))
        .edges.map((e) => e.id)
        .sort();
    expect(drawn("s1", [])).toEqual(["e2", "e3"]);
    expect(drawn("s2", ["s1"])).toEqual(["e1", "e2", "e3"]);
    expect(drawn("s3", ["s1", "s2"])).toEqual(["e2", "e3"]);
    expect(
      projectReadDiagram(d)
        .edges.map((e) => e.id)
        .sort(),
    ).toEqual(["e2", "e3"]);
  });
});

describe("a step on a shared element", () => {
  it("lights the original and its visible references", () => {
    const d = diagram("ref");
    const reading = readingAt(d, "s3", ["s1", "s2"]);
    expect(reading.highlight.activeNodeId).toBe("auth");
    expect([...reading.highlight.litNodeIds].sort()).toEqual(["auth", "r1"]);
    const { nodes } = projectReadDiagram(d, reading);
    expect(nodes.find((n) => n.id === "r1")?.style?.opacity).toBe(1);
    expect(nodes.find((n) => n.id === "auth")?.style?.opacity).toBe(1);
    expect(nodes.find((n) => n.id === "billing")?.style?.opacity).not.toBe(1);
  });
});
